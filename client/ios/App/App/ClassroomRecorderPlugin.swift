import AVFoundation
import Capacitor
import Foundation

@objc(ClassroomRecorderPlugin)
public final class ClassroomRecorderPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "ClassroomRecorderPlugin"
    public let jsName = "ClassroomRecorder"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "checkPermissions", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "requestPermissions", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "start", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "pause", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "resume", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "stop", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getStatus", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "listChunks", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "readChunk", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "acknowledgeChunk", returnType: CAPPluginReturnPromise)
    ]

    private enum RecorderState: String {
        case idle, recording, paused, stopped, interrupted, failed
    }

    private let audioEngine = AVAudioEngine()
    private let processingQueue = DispatchQueue(label: "rocks.riven.classroom-recorder.audio")
    private var converter: AVAudioConverter?
    private var outputFormat: AVAudioFormat?
    private var pendingPCM = Data()
    private var chunkBytes = 160_000
    private var chunkDurationMs = 5_000
    private var sequence = 0
    private var sessionId: String?
    private var state: RecorderState = .idle
    private var startedAt: Date?
    private var interruptionObserver: NSObjectProtocol?

    public override func load() {
        if let saved = UserDefaults.standard.dictionary(forKey: "riven.classroomRecorder.status") {
            sessionId = saved["sessionId"] as? String
            sequence = saved["sequence"] as? Int ?? 0
            if let timestamp = saved["startedAt"] as? TimeInterval {
                startedAt = Date(timeIntervalSince1970: timestamp)
            }
            let savedState = RecorderState(rawValue: saved["state"] as? String ?? "") ?? .idle
            // A process relaunch cannot still own the previous AVAudioEngine. Mark it
            // stopped so JavaScript replays every durable file and discloses only the
            // not-yet-flushed (< one chunk) tail as potentially lost.
            state = [.recording, .paused, .interrupted].contains(savedState) ? .stopped : savedState
        }
        interruptionObserver = NotificationCenter.default.addObserver(
            forName: AVAudioSession.interruptionNotification,
            object: AVAudioSession.sharedInstance(),
            queue: nil
        ) { [weak self] notification in
            self?.handleInterruption(notification)
        }
    }

    deinit {
        if let interruptionObserver {
            NotificationCenter.default.removeObserver(interruptionObserver)
        }
    }

    @objc public override func checkPermissions(_ call: CAPPluginCall) {
        call.resolve(["microphone": permissionState()])
    }

    @objc public override func requestPermissions(_ call: CAPPluginCall) {
        let completion: (Bool) -> Void = { [weak self] granted in
            call.resolve(["microphone": granted ? "granted" : "denied"])
            if !granted { self?.state = .failed }
        }
        if #available(iOS 17.0, *) {
            AVAudioApplication.requestRecordPermission(completionHandler: completion)
        } else {
            AVAudioSession.sharedInstance().requestRecordPermission(completion)
        }
    }

    @objc public func start(_ call: CAPPluginCall) {
        guard state != .recording && state != .paused else {
            call.reject("A classroom recording is already active")
            return
        }
        guard let requestedSessionId = call.getString("sessionId"), !requestedSessionId.isEmpty else {
            call.reject("sessionId is required")
            return
        }

        do {
            let requestedSampleRate = Double(call.getInt("sampleRate") ?? 16_000)
            let requestedChannels = AVAudioChannelCount(call.getInt("channels") ?? 1)
            chunkDurationMs = max(1_000, call.getInt("chunkDurationMs") ?? 5_000)
            chunkBytes = Int(requestedSampleRate) * Int(requestedChannels) * 2 * chunkDurationMs / 1_000
            sessionId = requestedSessionId
            sequence = nextSequence(for: requestedSessionId)
            pendingPCM.removeAll(keepingCapacity: true)

            let audioSession = AVAudioSession.sharedInstance()
            try audioSession.setCategory(
                .playAndRecord,
                mode: .spokenAudio,
                options: [.allowBluetoothHFP, .defaultToSpeaker]
            )
            try audioSession.setPreferredSampleRate(requestedSampleRate)
            try audioSession.setPreferredIOBufferDuration(0.02)
            try audioSession.setActive(true, options: .notifyOthersOnDeactivation)

            let input = audioEngine.inputNode
            let inputFormat = input.outputFormat(forBus: 0)
            guard let targetFormat = AVAudioFormat(
                commonFormat: .pcmFormatInt16,
                sampleRate: requestedSampleRate,
                channels: requestedChannels,
                interleaved: true
            ), let audioConverter = AVAudioConverter(from: inputFormat, to: targetFormat) else {
                call.reject("Unable to configure classroom audio format")
                return
            }
            outputFormat = targetFormat
            converter = audioConverter

            input.removeTap(onBus: 0)
            input.installTap(onBus: 0, bufferSize: 4_096, format: inputFormat) { [weak self] buffer, _ in
                self?.convertAndAppend(buffer)
            }
            audioEngine.prepare()
            try audioEngine.start()
            state = .recording
            startedAt = Date()
            persistStatus()
            call.resolve(["started": true, "sequence": sequence])
        } catch {
            state = .failed
            tearDownAudioSession()
            call.reject("Unable to start classroom recording", nil, error)
        }
    }

    @objc public func pause(_ call: CAPPluginCall) {
        guard state == .recording else {
            call.reject("No active recording to pause")
            return
        }
        audioEngine.pause()
        state = .paused
        persistStatus()
        call.resolve()
    }

    @objc public func resume(_ call: CAPPluginCall) {
        guard state == .paused || state == .interrupted else {
            call.reject("No paused recording to resume")
            return
        }
        do {
            try AVAudioSession.sharedInstance().setActive(true)
            try audioEngine.start()
            state = .recording
            persistStatus()
            call.resolve()
        } catch {
            state = .failed
            call.reject("Unable to resume classroom recording", nil, error)
        }
    }

    @objc public func stop(_ call: CAPPluginCall) {
        guard state == .recording || state == .paused || state == .interrupted else {
            call.resolve(["durationMs": 0, "chunkCount": sequence])
            return
        }
        processingQueue.sync {
            if !pendingPCM.isEmpty {
                emitChunk(pendingPCM, durationMs: durationForByteCount(pendingPCM.count))
                pendingPCM.removeAll()
            }
        }
        audioEngine.stop()
        audioEngine.inputNode.removeTap(onBus: 0)
        tearDownAudioSession()
        state = .stopped
        persistStatus()
        let duration = Int((Date().timeIntervalSince(startedAt ?? Date())) * 1_000)
        call.resolve(["durationMs": duration, "chunkCount": sequence])
    }

    @objc public func getStatus(_ call: CAPPluginCall) {
        var snapshot: [String: Any] = [
            "state": state.rawValue,
            "sequence": sequence
        ]
        if let sessionId { snapshot["sessionId"] = sessionId }
        if let startedAt { snapshot["startedAt"] = startedAt.timeIntervalSince1970 }
        call.resolve(snapshot)
    }

    @objc public func listChunks(_ call: CAPPluginCall) {
        guard let id = call.getString("sessionId") ?? sessionId else {
            call.resolve(["chunks": []])
            return
        }
        let files = (try? FileManager.default.contentsOfDirectory(
            at: sessionDirectory(for: id),
            includingPropertiesForKeys: [.fileSizeKey],
            options: [.skipsHiddenFiles]
        )) ?? []
        let chunks: [[String: Any]] = files.sorted { $0.lastPathComponent < $1.lastPathComponent }.map { url in
            let number = Int(url.deletingPathExtension().lastPathComponent) ?? 0
            let size = (try? url.resourceValues(forKeys: [.fileSizeKey]).fileSize) ?? 0
            return ["sequence": number, "byteSize": size]
        }
        call.resolve(["chunks": chunks])
    }

    @objc public func readChunk(_ call: CAPPluginCall) {
        guard let id = call.getString("sessionId") ?? sessionId,
              let requestedSequence = call.getInt("sequence") else {
            call.reject("sessionId and sequence are required")
            return
        }
        do {
            let data = try Data(contentsOf: chunkURL(sessionId: id, sequence: requestedSequence))
            call.resolve([
                "sequence": requestedSequence,
                "dataBase64": data.base64EncodedString(),
                "mimeType": "application/octet-stream",
                "durationMs": durationForByteCount(data.count)
            ])
        } catch {
            call.reject("Recording chunk was not found", nil, error)
        }
    }

    @objc public func acknowledgeChunk(_ call: CAPPluginCall) {
        guard let id = call.getString("sessionId") ?? sessionId,
              let acknowledgedSequence = call.getInt("sequence") else {
            call.reject("sessionId and sequence are required")
            return
        }
        do {
            try FileManager.default.removeItem(at: chunkURL(sessionId: id, sequence: acknowledgedSequence))
            call.resolve()
        } catch CocoaError.fileNoSuchFile {
            call.resolve()
        } catch {
            call.reject("Unable to clear uploaded recording chunk", nil, error)
        }
    }

    private func permissionState() -> String {
        if #available(iOS 17.0, *) {
            switch AVAudioApplication.shared.recordPermission {
            case .granted: return "granted"
            case .denied: return "denied"
            case .undetermined: return "prompt"
            @unknown default: return "prompt"
            }
        } else {
            switch AVAudioSession.sharedInstance().recordPermission {
            case .granted: return "granted"
            case .denied: return "denied"
            case .undetermined: return "prompt"
            @unknown default: return "prompt"
            }
        }
    }

    private func convertAndAppend(_ inputBuffer: AVAudioPCMBuffer) {
        guard state == .recording, let converter, let outputFormat else { return }
        let ratio = outputFormat.sampleRate / inputBuffer.format.sampleRate
        let capacity = AVAudioFrameCount(ceil(Double(inputBuffer.frameLength) * ratio)) + 32
        guard let outputBuffer = AVAudioPCMBuffer(pcmFormat: outputFormat, frameCapacity: capacity) else { return }
        var supplied = false
        var conversionError: NSError?
        let status = converter.convert(to: outputBuffer, error: &conversionError) { _, inputStatus in
            if supplied {
                inputStatus.pointee = .noDataNow
                return nil
            }
            supplied = true
            inputStatus.pointee = .haveData
            return inputBuffer
        }
        guard status != .error, conversionError == nil else { return }
        let audioBuffer = outputBuffer.audioBufferList.pointee.mBuffers
        guard let bytes = audioBuffer.mData, audioBuffer.mDataByteSize > 0 else { return }
        let converted = Data(bytes: bytes, count: Int(audioBuffer.mDataByteSize))
        processingQueue.async { [weak self] in
            guard let self else { return }
            self.pendingPCM.append(converted)
            while self.pendingPCM.count >= self.chunkBytes {
                let chunk = Data(self.pendingPCM.prefix(self.chunkBytes))
                self.pendingPCM.removeFirst(self.chunkBytes)
                self.emitChunk(chunk, durationMs: self.chunkDurationMs)
            }
        }
    }

    private func emitChunk(_ data: Data, durationMs: Int) {
        guard let sessionId else { return }
        let currentSequence = sequence
        do {
            let directory = sessionDirectory(for: sessionId)
            try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
            let url = chunkURL(sessionId: sessionId, sequence: currentSequence)
            try data.write(to: url, options: .atomic)
            // NSFileProtectionCompleteUntilFirstUserAuthentication keeps recovery files
            // encrypted at rest while still allowing background capture after first unlock.
            try FileManager.default.setAttributes(
                [.protectionKey: FileProtectionType.completeUntilFirstUserAuthentication],
                ofItemAtPath: url.path
            )
            sequence += 1
            persistStatus()
            DispatchQueue.main.async { [weak self] in
                self?.notifyListeners("chunkAvailable", data: [
                    "sequence": currentSequence,
                    "dataBase64": data.base64EncodedString(),
                    "mimeType": "application/octet-stream",
                    "durationMs": durationMs,
                    "byteSize": data.count
                ], retainUntilConsumed: true)
            }
        } catch {
            state = .failed
            DispatchQueue.main.async { [weak self] in
                self?.notifyListeners("recordingInterruption", data: [
                    "state": "failed",
                    "reason": "chunk_write_failed"
                ], retainUntilConsumed: true)
            }
        }
    }

    private func handleInterruption(_ notification: Notification) {
        guard let rawType = notification.userInfo?[AVAudioSessionInterruptionTypeKey] as? UInt,
              let type = AVAudioSession.InterruptionType(rawValue: rawType) else { return }
        switch type {
        case .began where state == .recording:
            audioEngine.pause()
            state = .interrupted
            persistStatus()
            notifyListeners("recordingInterruption", data: ["state": "paused", "reason": "system"])
        case .ended where state == .interrupted:
            let rawOptions = notification.userInfo?[AVAudioSessionInterruptionOptionKey] as? UInt ?? 0
            guard AVAudioSession.InterruptionOptions(rawValue: rawOptions).contains(.shouldResume) else { return }
            do {
                try AVAudioSession.sharedInstance().setActive(true)
                try audioEngine.start()
                state = .recording
                persistStatus()
                notifyListeners("recordingInterruption", data: ["state": "resumed", "reason": "system"])
            } catch {
                state = .failed
                notifyListeners("recordingInterruption", data: ["state": "failed", "reason": "resume_failed"])
            }
        default:
            break
        }
    }

    private func tearDownAudioSession() {
        try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
    }

    private func durationForByteCount(_ count: Int) -> Int {
        guard chunkBytes > 0 else { return 0 }
        return Int((Double(count) / Double(chunkBytes)) * Double(chunkDurationMs))
    }

    private func recordingsRoot() -> URL {
        let base = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
        return base.appendingPathComponent("ClassroomRecordings", isDirectory: true)
    }

    private func sessionDirectory(for id: String) -> URL {
        recordingsRoot().appendingPathComponent(id, isDirectory: true)
    }

    private func chunkURL(sessionId: String, sequence: Int) -> URL {
        sessionDirectory(for: sessionId).appendingPathComponent(String(format: "%08d.pcm", sequence))
    }

    private func nextSequence(for id: String) -> Int {
        let urls = (try? FileManager.default.contentsOfDirectory(at: sessionDirectory(for: id), includingPropertiesForKeys: nil)) ?? []
        return (urls.compactMap { Int($0.deletingPathExtension().lastPathComponent) }.max() ?? -1) + 1
    }

    private func persistStatus() {
        var snapshot: [String: Any] = [
            "state": state.rawValue,
            "sequence": sequence
        ]
        if let sessionId { snapshot["sessionId"] = sessionId }
        if let startedAt { snapshot["startedAt"] = startedAt.timeIntervalSince1970 }
        UserDefaults.standard.set(snapshot, forKey: "riven.classroomRecorder.status")
    }
}
