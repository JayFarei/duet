import ActivityKit
import Foundation

// A countdown Live Activity (a kitchen timer), the second kind a real Duo shows, alone or beside music.
struct TimerAttributes: ActivityAttributes {
  struct ContentState: Codable, Hashable {
    var end: Date
  }
  var name: String
}
