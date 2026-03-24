import ActivityKit
import WidgetKit
import SwiftUI

// MARK: - Riven Design Tokens (Defaults)

@available(iOS 16.2, *)
private enum RivenDefaults {
    static let bgDeep    = Color(red: 0.086, green: 0.165, blue: 0.192)   // #162a31
    static let surface   = Color(red: 0.118, green: 0.220, blue: 0.251)   // #1e3840
    static let border    = Color(red: 0.137, green: 0.243, blue: 0.275)   // #233e46
    static let parchment = Color(red: 0.894, green: 0.867, blue: 0.816)   // #e4ddd0
    static let secondary = Color(red: 0.561, green: 0.651, blue: 0.659)   // #8fa6a8
    static let gold      = Color(red: 0.871, green: 0.725, blue: 0.416)   // #deb96a
}

/// Resolved theme colors from the activity's static attributes, with fallbacks.
@available(iOS 16.2, *)
private struct ThemeColors {
    let bg: Color
    let surface: Color
    let text: Color
    let secondaryText: Color
    let border: Color
    let accent: Color

    init(from staticValues: [String: String]) {
        self.bg            = Self.parse(staticValues["bgColor"])            ?? RivenDefaults.bgDeep
        self.surface       = Self.parse(staticValues["surfaceColor"])       ?? RivenDefaults.surface
        self.text          = Self.parse(staticValues["textColor"])          ?? RivenDefaults.parchment
        self.secondaryText = Self.parse(staticValues["secondaryTextColor"]) ?? RivenDefaults.secondary
        self.border        = Self.parse(staticValues["borderColor"])        ?? RivenDefaults.border
        self.accent        = Self.parse(staticValues["accentColor"])        ?? RivenDefaults.gold
    }

    private static func parse(_ hex: String?) -> Color? {
        guard let hex = hex?.trimmingCharacters(in: .whitespacesAndNewlines),
              !hex.isEmpty else { return nil }

        let clean = hex.hasPrefix("#") ? String(hex.dropFirst()) : hex
        guard clean.count == 6, let value = UInt64(clean, radix: 16) else { return nil }

        let r = Double((value >> 16) & 0xFF) / 255.0
        let g = Double((value >> 8)  & 0xFF) / 255.0
        let b = Double( value        & 0xFF) / 255.0

        return Color(red: r, green: g, blue: b)
    }
}

// MARK: - Live Activity Widget

@available(iOS 16.2, *)
struct RivenWidgetLiveActivity: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: GenericAttributes.self) { context in
            let theme = ThemeColors(from: context.attributes.staticValues)

            // MARK: Lock Screen / Banner
            HStack(spacing: 14) {
                // Accent glow ring with waveform icon
                ZStack {
                    Circle()
                        .fill(theme.accent.opacity(0.18))
                        .frame(width: 36, height: 36)

                    Circle()
                        .strokeBorder(
                            LinearGradient(
                                colors: [theme.accent, theme.accent.opacity(0.3)],
                                startPoint: .topLeading,
                                endPoint: .bottomTrailing
                            ),
                            lineWidth: 1.5
                        )
                        .frame(width: 36, height: 36)

                    Image(systemName: "waveform")
                        .foregroundStyle(theme.accent)
                        .font(.system(size: 15, weight: .semibold))
                }

                VStack(alignment: .leading, spacing: 3) {
                    Text(context.statusLabel)
                        .font(.system(size: 10, weight: .semibold, design: .monospaced))
                        .tracking(1.2)
                        .foregroundStyle(theme.secondaryText)
                        .textCase(.uppercase)

                    Text(context.noteTitle)
                        .font(.system(size: 15, weight: .semibold, design: .serif))
                        .foregroundStyle(theme.text)
                        .lineLimit(1)
                }

                Spacer()

                RecordingElapsedTimeText(startDate: context.startedAt)
                    .foregroundStyle(theme.accent)
            }
            .padding(.horizontal, 20)
            .padding(.vertical, 14)
            .activityBackgroundTint(theme.bg)
            .activitySystemActionForegroundColor(theme.text)
            .widgetURL(context.deepLinkURL)

        } dynamicIsland: { context in
            let theme = ThemeColors(from: context.attributes.staticValues)

            DynamicIsland {
                // MARK: Expanded - Leading
                DynamicIslandExpandedRegion(.leading) {
                    ZStack {
                        Circle()
                            .fill(theme.accent.opacity(0.18))
                            .frame(width: 32, height: 32)

                        Image(systemName: "waveform")
                            .foregroundStyle(theme.accent)
                            .font(.system(size: 14, weight: .semibold))
                    }
                }

                // MARK: Expanded - Trailing
                DynamicIslandExpandedRegion(.trailing) {
                    RecordingElapsedTimeText(startDate: context.startedAt)
                        .foregroundStyle(theme.accent)
                }

                // MARK: Expanded - Bottom
                DynamicIslandExpandedRegion(.bottom) {
                    VStack(alignment: .leading, spacing: 3) {
                        Text(context.statusLabel)
                            .font(.system(size: 10, weight: .semibold, design: .monospaced))
                            .tracking(1.0)
                            .foregroundStyle(theme.secondaryText)
                            .textCase(.uppercase)

                        Text(context.noteTitle)
                            .font(.system(size: 14, weight: .medium, design: .serif))
                            .foregroundStyle(theme.text)
                            .lineLimit(1)

                        // Gradient separator — accent fade to border
                        Rectangle()
                            .fill(
                                LinearGradient(
                                    colors: [
                                        theme.accent.opacity(0.4),
                                        theme.border,
                                        Color.clear
                                    ],
                                    startPoint: .leading,
                                    endPoint: .trailing
                                )
                            )
                            .frame(height: 0.5)
                            .padding(.top, 2)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                }

            // MARK: Compact - Leading
            } compactLeading: {
                Image(systemName: "waveform")
                    .foregroundStyle(theme.accent)
                    .font(.system(size: 12, weight: .semibold))

            // MARK: Compact - Trailing
            } compactTrailing: {
                RecordingElapsedTimeText(startDate: context.startedAt, font: .caption2)
                    .foregroundStyle(theme.accent)

            // MARK: Minimal
            } minimal: {
                ZStack {
                    Circle()
                        .fill(theme.accent.opacity(0.15))
                    Image(systemName: "waveform")
                        .foregroundStyle(theme.accent)
                        .font(.system(size: 11, weight: .bold))
                }
            }
            .widgetURL(context.deepLinkURL)
            .keylineTint(theme.accent)
        }
    }
}

// MARK: - Elapsed Time Display

@available(iOS 16.2, *)
private struct RecordingElapsedTimeText: View {
    let startDate: Date?
    var font: Font = .system(size: 20, weight: .semibold, design: .monospaced)

    var body: some View {
        Group {
            if let startDate {
                Text(startDate, style: .timer)
            } else {
                Text("0:00")
            }
        }
        .font(font.monospacedDigit().weight(.semibold))
        .contentTransition(.numericText())
    }
}

// MARK: - Context Helpers

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
