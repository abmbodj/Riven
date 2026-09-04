import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8');

describe('iOS classroom recorder', () => {
  it('owns a background-safe chunked recorder with pause, recovery, and interruptions', async () => {
    const source = await read('../../client/ios/App/App/ClassroomRecorderPlugin.swift');
    expect(source).toContain('class ClassroomRecorderPlugin: CAPPlugin, CAPBridgedPlugin');
    expect(source).toContain('AVAudioEngine');
    expect(source).toContain('chunkAvailable');
    expect(source).toContain('recordingInterruption');
    expect(source).toContain('AVAudioSession.interruptionNotification');
    expect(source).toContain('func pause(');
    expect(source).toContain('func resume(');
    expect(source).toContain('NSFileProtectionCompleteUntilFirstUserAuthentication');
  });

  it('registers the app-owned plugin in the Capacitor bridge target', async () => {
    const [bridge, storyboard, project] = await Promise.all([
      read('../../client/ios/App/App/RivenBridgeViewController.swift'),
      read('../../client/ios/App/App/Base.lproj/Main.storyboard'),
      read('../../client/ios/App/App.xcodeproj/project.pbxproj'),
    ]);
    expect(bridge).toContain('registerPluginInstance(ClassroomRecorderPlugin())');
    expect(storyboard).toContain('customClass="RivenBridgeViewController"');
    expect(project).toContain('ClassroomRecorderPlugin.swift in Sources');
    expect(project).toContain('RivenBridgeViewController.swift in Sources');
  });
});
