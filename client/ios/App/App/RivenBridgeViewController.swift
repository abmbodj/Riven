import Capacitor

@objc(RivenBridgeViewController)
final class RivenBridgeViewController: CAPBridgeViewController {
    override func capacitorDidLoad() {
        bridge?.registerPluginInstance(ClassroomRecorderPlugin())
    }
}
