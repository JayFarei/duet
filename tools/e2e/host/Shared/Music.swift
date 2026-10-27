import ActivityKit

// A music-player Live Activity, the common case on a real Duo: album art leading, a level meter trailing.
struct MusicAttributes: ActivityAttributes {
  struct ContentState: Codable, Hashable {
    var title: String
    var artist: String
    var playing: Bool
  }
  var app: String
}
