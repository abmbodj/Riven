import ActivityKit
import Foundation

@available(iOS 16.2, *)
struct GenericAttributes: ActivityAttributes {
    struct ContentState: Codable, Hashable {
        var values: [String: String]
    }

    var id: String
    var staticValues: [String: String]
}
