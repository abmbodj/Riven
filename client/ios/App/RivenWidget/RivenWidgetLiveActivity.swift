//
//  RivenWidgetLiveActivity.swift
//  RivenWidget
//
//  Created by ab on 3/20/26.
//

import ActivityKit
import WidgetKit
import SwiftUI

struct RivenWidgetAttributes: ActivityAttributes {
    public struct ContentState: Codable, Hashable {
        // Dynamic stateful properties about your activity go here!
        var emoji: String
    }

    // Fixed non-changing properties about your activity go here!
    var name: String
}

struct RivenWidgetLiveActivity: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: RivenWidgetAttributes.self) { context in
            // Lock screen/banner UI goes here
            VStack {
                Text("Hello \(context.state.emoji)")
            }
            .activityBackgroundTint(Color.cyan)
            .activitySystemActionForegroundColor(Color.black)

        } dynamicIsland: { context in
            DynamicIsland {
                // Expanded UI goes here.  Compose the expanded UI through
                // various regions, like leading/trailing/center/bottom
                DynamicIslandExpandedRegion(.leading) {
                    Text("Leading")
                }
                DynamicIslandExpandedRegion(.trailing) {
                    Text("Trailing")
                }
                DynamicIslandExpandedRegion(.bottom) {
                    Text("Bottom \(context.state.emoji)")
                    // more content
                }
            } compactLeading: {
                Text("L")
            } compactTrailing: {
                Text("T \(context.state.emoji)")
            } minimal: {
                Text(context.state.emoji)
            }
            .widgetURL(URL(string: "http://www.apple.com"))
            .keylineTint(Color.red)
        }
    }
}

extension RivenWidgetAttributes {
    fileprivate static var preview: RivenWidgetAttributes {
        RivenWidgetAttributes(name: "World")
    }
}

extension RivenWidgetAttributes.ContentState {
    fileprivate static var smiley: RivenWidgetAttributes.ContentState {
        RivenWidgetAttributes.ContentState(emoji: "😀")
     }
     
     fileprivate static var starEyes: RivenWidgetAttributes.ContentState {
         RivenWidgetAttributes.ContentState(emoji: "🤩")
     }
}

#Preview("Notification", as: .content, using: RivenWidgetAttributes.preview) {
   RivenWidgetLiveActivity()
} contentStates: {
    RivenWidgetAttributes.ContentState.smiley
    RivenWidgetAttributes.ContentState.starEyes
}
