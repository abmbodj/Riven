import ActivityKit
import WidgetKit
import SwiftUI

@available(iOS 16.2, *)
struct RivenWidgetLiveActivity: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: GenericAttributes.self) { context in
            HStack(spacing: 14) {
                Image(systemName: "mic.fill")
                    .foregroundColor(.red)
                    .font(.title3.weight(.semibold))
                    .frame(width: 28, height: 28)

                VStack(alignment: .leading, spacing: 4) {
                    Text(context.statusLabel)
                        .font(.caption2.weight(.semibold))
                        .foregroundStyle(.white.opacity(0.72))
                        .textCase(.uppercase)

                    Text(context.noteTitle)
                        .font(.headline)
                        .foregroundStyle(.white)
                        .lineLimit(1)
                }

                Spacer()

                RecordingElapsedTimeText(startDate: context.startedAt)
                    .foregroundStyle(.white)
            }
            .padding(.horizontal, 18)
            .padding(.vertical, 14)
            .activityBackgroundTint(Color.black.opacity(0.85))
            .activitySystemActionForegroundColor(Color.white)
            .widgetURL(context.deepLinkURL)
        } dynamicIsland: { context in
            DynamicIsland {
                DynamicIslandExpandedRegion(.leading) {
                    Image(systemName: "mic.fill")
                        .foregroundColor(.red)
                        .font(.title3.weight(.semibold))
                }

                DynamicIslandExpandedRegion(.trailing) {
                    RecordingElapsedTimeText(startDate: context.startedAt)
                        .foregroundStyle(.white)
                }

                DynamicIslandExpandedRegion(.bottom) {
                    VStack(alignment: .leading, spacing: 2) {
                        Text(context.statusLabel)
                            .font(.caption2.weight(.semibold))
                            .foregroundStyle(.white.opacity(0.72))
                            .textCase(.uppercase)

                        Text(context.noteTitle)
                            .font(.subheadline)
                            .foregroundStyle(.white)
                            .lineLimit(1)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                }
            } compactLeading: {
                Image(systemName: "mic.fill")
                    .foregroundColor(.red)
            } compactTrailing: {
                RecordingElapsedTimeText(startDate: context.startedAt, font: .caption2)
                    .foregroundStyle(.red)
            } minimal: {
                Image(systemName: "mic.fill")
                    .foregroundColor(.red)
            }
            .widgetURL(context.deepLinkURL)
            .keylineTint(.red)
        }
    }
}

@available(iOS 16.2, *)
private struct RecordingElapsedTimeText: View {
    let startDate: Date?
    var font: Font = .title3.monospacedDigit()

    var body: some View {
        Group {
            if let startDate {
                Text(startDate, style: .timer)
            } else {
                Text("0:00")
            }
        }
        .font(font.monospacedDigit().weight(.semibold))
    }
}

@available(iOS 16.2, *)
private extension ActivityViewContext where Attributes == GenericAttributes {
    var noteTitle: String {
        state.values["noteTitle"] ?? "Untitled"
    }

    var statusLabel: String {
        state.values["status"] ?? "Recording note"
    }

    var startedAt: Date? {
        guard let rawValue = state.values["startedAt"], let seconds = Double(rawValue) else {
            return nil
        }

        return Date(timeIntervalSince1970: seconds)
    }

    var deepLinkURL: URL? {
        guard let noteId = attributes.staticValues["noteId"], !noteId.isEmpty else {
            return nil
        }

        let encodedNoteId = noteId.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? noteId
        return URL(string: "riven://note/\(encodedNoteId)")
    }
}
