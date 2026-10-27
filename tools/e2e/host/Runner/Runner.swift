import XCTest

// The device side of the e2e driver (the WebDriverAgent pattern): one long-running UI test that long-polls the
// beacon for commands and runs them with XCUITest, the supported way to rotate the simulated device, tap native
// buttons in other apps (Safari, the in-app preview) and read their frames. Started by tools/e2e/run.sh.
//   {op:"rotate", value:"portrait|landscapeLeft|landscapeRight|portraitUpsideDown"}
//   {op:"launch", bundle, args:[...]}, {op:"activate", bundle}, {op:"terminate", bundle}, {op:"home"}
//   {op:"elements", bundle}          native (outside any web view) buttons / controls of an app, screen points
//   {op:"tap", bundle, label}        tap the first native button whose label contains `label`
//   {op:"tapAt", x, y}               tap a screen point
//   {op:"press", x, y, duration}     long-press a screen point
//   {op:"drag", x, y, x2, y2, hold}  press at a point for `hold` s, then drag to another (split view, window tiling)
//   {op:"find", bundle, label}       frames of every element whose label contains label (a query: reaches what a snapshot misses)
//   {op:"tree", bundle}              every element of an app with a frame (exploration, split-view controls)
//   {op:"stop"}
final class Runner: XCTestCase {
  let beacon = ProcessInfo.processInfo.environment["E2E_BEACON"] ?? "http://localhost:3141"

  func request(_ path: String, _ body: [String: Any]? = nil) -> [String: Any]? {
    var r = URLRequest(url: URL(string: beacon + path)!, timeoutInterval: 10)
    if let body { r.httpMethod = "POST"; r.httpBody = try? JSONSerialization.data(withJSONObject: body) }
    let done = expectation(description: path)
    var out: [String: Any]?
    URLSession.shared.dataTask(with: r) { d, _, _ in
      if let d { out = (try? JSONSerialization.jsonObject(with: d)) as? [String: Any] }
      done.fulfill()
    }.resume()
    wait(for: [done], timeout: 12)
    return out
  }

  func orientation(_ s: String) -> UIDeviceOrientation {
    switch s {
    case "landscapeLeft": return .landscapeLeft
    case "landscapeRight": return .landscapeRight
    case "portraitUpsideDown": return .portraitUpsideDown
    default: return .portrait
    }
  }

  func name(_ o: UIDeviceOrientation) -> String {
    switch o {
    case .landscapeLeft: return "landscapeLeft"
    case .landscapeRight: return "landscapeRight"
    case .portraitUpsideDown: return "portraitUpsideDown"
    case .portrait: return "portrait"
    default: return "other"
    }
  }

  func elements(_ bundle: String) -> [[String: Any]] {
    let app = XCUIApplication(bundleIdentifier: bundle)
    guard let snap = try? app.snapshot() else { return [] }
    var out: [[String: Any]] = []
    let kinds: Set<XCUIElement.ElementType> = [.button, .link, .textField, .searchField, .toolbar, .navigationBar]
    func walk(_ e: XCUIElementSnapshot, inWeb: Bool) {
      let web = inWeb || e.elementType == .webView
      if !web && kinds.contains(e.elementType) && e.frame.width > 0 {
        let f = e.frame
        out.append(["type": e.elementType.rawValue, "label": e.label, "id": e.identifier,
                    "x": f.minX, "y": f.minY, "w": f.width, "h": f.height])
      }
      for c in e.children { walk(c, inWeb: web) }
    }
    walk(snap, inWeb: false)
    return out
  }

  /** A screen point, through SpringBoard, which idles at once (see "tap"). */
  func point(_ x: Double, _ y: Double, _ bundle: String? = nil) -> XCUICoordinate {
    XCUIApplication(bundleIdentifier: bundle ?? "com.apple.springboard").coordinate(withNormalizedOffset: .zero).withOffset(CGVector(dx: x, dy: y))
  }

  func run(_ c: [String: Any]) throws -> [String: Any] {
    let op = c["op"] as? String ?? "noop"
    switch op {
    case "rotate":
      XCUIDevice.shared.orientation = orientation(c["value"] as? String ?? "portrait")
      return ["orientation": name(XCUIDevice.shared.orientation)]
    case "launch":
      let app = XCUIApplication(bundleIdentifier: c["bundle"] as! String)
      app.launchArguments = c["args"] as? [String] ?? []
      app.launch()
      return [:]
    case "activate":
      XCUIApplication(bundleIdentifier: c["bundle"] as! String).activate(); return [:]
    case "terminate":
      XCUIApplication(bundleIdentifier: c["bundle"] as! String).terminate(); return [:]
    case "home":
      XCUIDevice.shared.press(.home); return [:]
    case "elements":
      return ["elements": elements(c["bundle"] as! String), "orientation": name(XCUIDevice.shared.orientation)]
    case "tap":
      let app = XCUIApplication(bundleIdentifier: c["bundle"] as! String)
      let label = c["label"] as! String
      let b = app.buttons.matching(NSPredicate(format: "label CONTAINS[c] %@", label)).firstMatch
      guard b.waitForExistence(timeout: 5) else { throw NSError(domain: "e2e", code: 1, userInfo: [NSLocalizedDescriptionKey: "no button \(label)"]) }
      // Tap the button's centre through SpringBoard, not b.tap(): XCUITest first waits for the target app to idle,
      // and SafariViewService over a page with running animations never reports idle (60s stall, then the beacon's
      // command timeout). SpringBoard idles at once and the touch lands on the same screen point.
      let f = b.frame
      XCUIApplication(bundleIdentifier: "com.apple.springboard").coordinate(withNormalizedOffset: .zero)
        .withOffset(CGVector(dx: f.midX, dy: f.midY)).tap()
      return ["x": f.midX, "y": f.midY]
    case "find":  // frames of the elements whose label contains `label`, any type, no wait (a query reaches buttons a snapshot misses)
      let app = XCUIApplication(bundleIdentifier: c["bundle"] as! String)
      let q = app.descendants(matching: .any).matching(NSPredicate(format: "label CONTAINS[c] %@", c["label"] as! String))
      return ["elements": q.allElementsBoundByIndex.filter { $0.exists && $0.frame.width > 0 }.map { e in
        ["type": e.elementType.rawValue, "label": e.label, "id": e.identifier, "x": e.frame.minX, "y": e.frame.minY, "w": e.frame.width, "h": e.frame.height]
      }]
    case "press":
      point(c["x"] as! Double, c["y"] as! Double, c["bundle"] as? String).press(forDuration: c["duration"] as? Double ?? 1.0)
      return [:]
    case "drag":
      point(c["x"] as! Double, c["y"] as! Double, c["bundle"] as? String).press(forDuration: c["hold"] as? Double ?? 0.6,
        thenDragTo: point(c["x2"] as! Double, c["y2"] as! Double, c["bundle"] as? String),
        withVelocity: XCUIGestureVelocity(rawValue: c["velocity"] as? Double ?? 600), thenHoldForDuration: 0.3)
      return [:]
    case "tree":
      let app = XCUIApplication(bundleIdentifier: c["bundle"] as! String)
      guard let snap = try? app.snapshot() else { return ["elements": []] }
      var out: [[String: Any]] = []
      func walk(_ e: XCUIElementSnapshot, _ depth: Int) {
        let f = e.frame
        if f.width > 0 && (!e.label.isEmpty || !e.identifier.isEmpty) {
          out.append(["type": e.elementType.rawValue, "label": e.label, "id": e.identifier, "depth": depth, "x": f.minX, "y": f.minY, "w": f.width, "h": f.height])
        }
        for ch in e.children { walk(ch, depth + 1) }
      }
      walk(snap, 0)
      return ["elements": out]
    case "tapAt":
      let sb = XCUIApplication(bundleIdentifier: "com.apple.springboard")
      sb.coordinate(withNormalizedOffset: .zero).withOffset(CGVector(dx: c["x"] as! Double, dy: c["y"] as! Double)).tap()
      return [:]
    default:
      return [:]
    }
  }

  func testServe() throws {
    continueAfterFailure = true
    executionTimeAllowance = 3 * 60 * 60
    var idle = Date()
    while Date().timeIntervalSince(idle) < 600 {
      guard let c = request("/cmd/next"), let op = c["op"] as? String else { sleep(1); continue }
      if op == "noop" { continue }
      idle = Date()
      if op == "stop" { _ = request("/cmd/done", ["id": c["id"] ?? 0, "ok": true]); return }
      var res: [String: Any] = ["id": c["id"] ?? 0]
      do { res.merge(try run(c)) { a, _ in a }; res["ok"] = true } catch { res["ok"] = false; res["error"] = "\(error.localizedDescription)" }
      _ = request("/cmd/done", res)
    }
  }
}
