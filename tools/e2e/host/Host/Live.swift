import ActivityKit
import AVFoundation
import Foundation
import UIKit

// Live Activity control for the e2e driver. The driver sets the wanted state on the beacon (POST /la {"on": bool});
// the host polls GET /la and reconciles, then reports back (POST /la/state). Polling, not a URL scheme, so the driver
// can end the activity while Safari or the preview is in front without bringing the host forward.
// ActivityKit only starts an activity from the foreground (from the background: ActivityAuthorizationError.visibility).
// With the host in front (its preview open) the poll starts it while the page stays visible; for Safari the driver
// brings the host forward (simctl launch, no URL scheme, which would prompt) and then Safari back, as a user does after
// starting music in another app; the page is not reloaded. simctl push cannot deliver a Live Activity push-to-start
// (only app remote pushes). Ending works from the background.
// A silent, mixable audio loop keeps the host running in the background so the poll keeps going.
@MainActor final class Live {
  static let shared = Live()
  let beacon = UserDefaults.standard.string(forKey: "beacon") ?? "http://localhost:3141"
  var player: AVAudioPlayer?
  var lastError: String?

  func start() {
    keepAlive()
    Task { while true { await tick(); try? await Task.sleep(for: .milliseconds(400)) } }
  }

  var running: [Activity<MusicAttributes>] { Activity<MusicAttributes>.activities.filter { $0.activityState == .active } }

  func set(_ on: Bool) async {
    if on, running.isEmpty, UIApplication.shared.applicationState == .active {
      do {
        _ = try Activity.request(attributes: MusicAttributes(app: "Duo e2e"),
          content: .init(state: .init(title: "Midnight City", artist: "M83", playing: true), staleDate: nil))
        lastError = nil
      } catch { lastError = "\(String(reflecting: error)) enabled=\(ActivityAuthorizationInfo().areActivitiesEnabled)" }
    } else if !on {
      for a in Activity<MusicAttributes>.activities { await a.end(nil, dismissalPolicy: .immediate) }
      lastError = nil
    }
  }

  func tick() async {
    guard let url = URL(string: beacon + "/la"), let (d, _) = try? await URLSession.shared.data(from: url),
          let want = (try? JSONSerialization.jsonObject(with: d)) as? [String: Any], let on = want["on"] as? Bool else { return }
    if on != !running.isEmpty { await set(on) }
    var req = URLRequest(url: URL(string: beacon + "/la/state")!)
    req.httpMethod = "POST"
    req.httpBody = try? JSONSerialization.data(withJSONObject: ["on": !running.isEmpty, "count": running.count, "error": (lastError as Any?) ?? NSNull()])
    _ = try? await URLSession.shared.data(for: req)
  }

  func keepAlive() {
    try? AVAudioSession.sharedInstance().setCategory(.playback, options: [.mixWithOthers])
    try? AVAudioSession.sharedInstance().setActive(true)
    player = try? AVAudioPlayer(data: silence())
    player?.numberOfLoops = -1
    player?.volume = 0
    player?.play()
  }

  /** One second of 8 kHz mono 16-bit silence as a WAV file. */
  func silence() -> Data {
    let n = 8000 * 2
    var d = Data()
    func u32(_ v: UInt32) { withUnsafeBytes(of: v.littleEndian) { d.append(contentsOf: $0) } }
    func u16(_ v: UInt16) { withUnsafeBytes(of: v.littleEndian) { d.append(contentsOf: $0) } }
    d.append(contentsOf: Array("RIFF".utf8)); u32(UInt32(36 + n)); d.append(contentsOf: Array("WAVEfmt ".utf8))
    u32(16); u16(1); u16(1); u32(8000); u32(16000); u16(2); u16(16)
    d.append(contentsOf: Array("data".utf8)); u32(UInt32(n)); d.append(Data(count: n))
    return d
  }
}
