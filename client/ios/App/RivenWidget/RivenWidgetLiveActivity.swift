import ActivityKit
import WidgetKit
import SwiftUI

// This maps to the JSON attributes we send from Capacitor
struct RivenWidgetAttributes: ActivityAttributes {
    public struct ContentState: Codable, Hashable {
        // Dynamic stateful properties (updates every second)
        var duration: Int
    }

    // Fixed properties set at the start of recording
    var type: String
    var title: String
}

extension Int {
    func timeString() -> String {
        let m = self / 60
        let s = self % 60
        return String(format: "%02d:%02d", m, s)
    }
}

@available(iOS 16.1, *)
struct RivenWidgetLiveActivity: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: RivenWidgetAttributes.self) { context in
            // Lock screen / Banner UI
            HStack {
                Image(systemName: "mic.fill")
                    .foregroundColor(.red)
                    .font(.title2)
                Text(context.attributes.title)
                    .font(.headline)
                    .foregroundColor(.white)
                Spacer()
                Text(context.state.duration.timeString())
                    .font(.title2.monospacedDigit())
                    .foregroundColor(.white)
            }
            .padding()
            .activityBackgroundTint(Color.black.opacity(0.85))
            .activitySystemActionForegroundColor(Color.white)

        } dynamicIsland: { context in
             // Dynamic Island UI
            DynamicIsland {
                // Expanded Form
                DynamicIslandExpandedRegion(.leading) {
                    Image(systemName: "mic.fill")
                        .foregroundColor(.red)
                        .font(.title2)
                        .padding(.leading, 8)
                }
                DynamicIslandExpandedRegion(.trailing) {
                    Text(context.state.duration.timeString())
                        .font(.title2.monospacedDigit())
                        .foregroundColor(.white)
                        .padding(.trailing, 8)
                }
                DynamicIslandExpandedRegion(.bottom) {
                    Text(context.attributes.title)
                        .font(.subheadline)
                        .foregroundColor(.gray)
                }
            } compactLeading: {
                // Compact Left
                Image(systemName: "mic.fill").foregroundColor(.red)
            } compactTrailing: {
                // Compact Right
                Text(context.state.duration.timeString())
                    .font(.caption2.monospacedDigit())
                    .foregroundStyle(.red)
            } minimal: {
                // Minimal (e.g. multiple live activities active)
                Image(systemName: "mic.fill").foregroundColor(.red)
            }
        }
    }
}

extension RivenWidgetAttributes {
    fileprivate static var preview: RivenWidgetAttributes {
        RivenWidgetAttributes(type: "audioRecording", title: "Recording Note")
    }
}

extension RivenWidgetAttributes.ContentState {
    fileprivate static var recording: RivenWidgetAttributes.ContentState {
        RivenWidgetAttributes.ContentState(duration: 125)
     }
}

#Preview("Notification", as: .content, using: RivenWidgetAttributes.preview) {
   RivenWidgetLiveActivity()
} contentStates: {
    RivenWidgetAttributes.ContentState.recording
}
