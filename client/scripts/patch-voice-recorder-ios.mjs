import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const targetPath = path.resolve(
  __dirname,
  '..',
  'node_modules',
  'capacitor-voice-recorder',
  'ios',
  'Plugin',
  'CustomMediaRecorder.swift'
);

// ── Patch 1: add Bluetooth options to AVAudioSession category ─────────────────

const oldCategory = `try recordingSession.setCategory(AVAudioSession.Category.playAndRecord)`;
const newCategory = `try recordingSession.setCategory(
                .playAndRecord,
                mode: .default,
                options: [.allowBluetooth, .allowBluetoothA2DP]
            )`;

// ── Patch 2: wire observer setup into startRecording ─────────────────────────

const oldRecordCall = `            audioRecorder.record()
            status = CurrentRecordingStatus.RECORDING
            return true`;
const newRecordCall = `            audioRecorder.record()
            status = CurrentRecordingStatus.RECORDING
            setupInterruptionObserver()
            return true`;

// ── Patch 3: tear down observer in stopRecording ──────────────────────────────

const oldStopStart = `    func stopRecording() {
        do {
            audioRecorder.stop()`;
const newStopStart = `    func stopRecording() {
        removeInterruptionObserver()
        do {
            audioRecorder.stop()`;

// ── Patch 4: new interruption-handling methods (injected before closing brace) ─

const closingBrace = `\n}\n`;
const interruptionMethods = `
    // MARK: - AVAudioSession interruption handling

    private func setupInterruptionObserver() {
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(handleInterruption(_:)),
            name: AVAudioSession.interruptionNotification,
            object: AVAudioSession.sharedInstance()
        )
    }

    private func removeInterruptionObserver() {
        NotificationCenter.default.removeObserver(
            self,
            name: AVAudioSession.interruptionNotification,
            object: AVAudioSession.sharedInstance()
        )
    }

    @objc private func handleInterruption(_ notification: Notification) {
        guard let info = notification.userInfo,
              let typeValue = info[AVAudioSessionInterruptionTypeKey] as? UInt,
              let type = AVAudioSession.InterruptionType(rawValue: typeValue) else { return }

        switch type {
        case .began:
            if status == .RECORDING {
                audioRecorder?.pause()
                status = CurrentRecordingStatus.PAUSED
            }
        case .ended:
            let optionsValue = info[AVAudioSessionInterruptionOptionKey] as? UInt ?? 0
            let shouldResume = AVAudioSession.InterruptionOptions(rawValue: optionsValue).contains(.shouldResume)
            if status == .PAUSED && shouldResume {
                try? recordingSession?.setActive(true)
                audioRecorder?.record()
                status = CurrentRecordingStatus.RECORDING
            }
        default:
            break
        }
    }
}\n`;

async function patchVoiceRecorderIOS() {
  const source = await readFile(targetPath, 'utf8');

  // Guard: skip if already patched (idempotent check)
  if (source.includes('setupInterruptionObserver')) {
    console.log('capacitor-voice-recorder iOS already patched');
    return;
  }

  if (!source.includes(oldCategory)) {
    throw new Error(
      `patch-voice-recorder-ios: could not find AVAudioSession category line in ${targetPath}`
    );
  }

  let updated = source
    .replace(oldCategory, newCategory)
    .replace(oldRecordCall, newRecordCall)
    .replace(oldStopStart, newStopStart)
    // Replace the final closing brace with our new methods + closing brace
    .replace(/\n\}\n$/, interruptionMethods);

  if (!updated.includes('setupInterruptionObserver')) {
    throw new Error('patch-voice-recorder-ios: patching failed — output check failed');
  }

  await writeFile(targetPath, updated, 'utf8');
  console.log('Patched capacitor-voice-recorder: added Bluetooth options + interruption handling');
}

patchVoiceRecorderIOS().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
