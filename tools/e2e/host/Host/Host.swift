import SwiftUI
import SafariServices
import UIKit
import WebKit

// e2e test host: presents a page in SFSafariViewController the way an app's link preview does, or (style webview)
// in a full-screen WKWebView under the status area, the way X's own in-app browser did, or (style xsheet) the way
// it does now: the web view on the top 61%, X's bar and the tweet card below it.
//   launch args:  -url <page> -style default|full|over|sheet|webview|xsheet   (presents 1s after launch)
//                 -beacon <origin>                              (Live.swift, saved for later launches)
//   URL scheme:   duoe2e://present?style=sheet&url=<encoded>   (dismisses any open preview first)
//                 duoe2e://safari?url=<encoded>                (dismisses the preview, opens the page in Safari,
//                                                               same end state as the preview's "Open in Safari")
//                 duoe2e://dismiss
@main struct HostApp: App {
  var body: some Scene {
    WindowGroup {
      Links().onOpenURL { handle($0) }.task { Live.shared.start() }
    }
  }
}

@MainActor func topController() -> UIViewController? {
  let scene = UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }.first
  return scene?.keyWindow?.rootViewController
}

@MainActor func dismissAll(_ then: @escaping @MainActor () -> Void) {
  guard let root = topController(), root.presentedViewController != nil else { return then() }
  root.dismiss(animated: false) { MainActor.assumeIsolated { then() } }
}

@MainActor func present(_ style: String, _ s: String?) {
  guard let s, let url = URL(string: s) else { return }
  dismissAll {
    guard var top = topController() else { return }
    while let p = top.presentedViewController { top = p }
    if style == "webview" { return top.present(WebPreview(url), animated: true) }
    if style == "xsheet" { return top.present(XSheet(url), animated: true) }
    let vc = SFSafariViewController(url: url)
    switch style {
    case "full": vc.modalPresentationStyle = .fullScreen
    case "over": vc.modalPresentationStyle = .overFullScreen
    case "sheet": vc.modalPresentationStyle = .pageSheet
    default: break
    }
    top.present(vc, animated: true)
  }
}

// A WKWebView edge to edge, under the status area: no Safari token in its user agent, no browser chrome.
final class WebPreview: UIViewController {
  let url: URL
  init(_ url: URL) { self.url = url; super.init(nibName: nil, bundle: nil); modalPresentationStyle = .fullScreen }
  required init?(coder: NSCoder) { fatalError() }
  override func loadView() {
    let web = WKWebView(frame: .zero)
    web.isInspectable = true
    web.load(URLRequest(url: url))
    view = web
  }
}

// X's in-app browser as of 2026-10: full screen, the WKWebView on its top 61% (413 of the closed screen's 678pt),
// X's bar (back, site, reload) under it, the tweet card filling the rest.
final class XSheet: UIViewController {
  let url: URL, web = WKWebView(frame: .zero), bar = UILabel(), card = UIView()
  init(_ url: URL) { self.url = url; super.init(nibName: nil, bundle: nil); modalPresentationStyle = .fullScreen }
  required init?(coder: NSCoder) { fatalError() }
  override func viewDidLoad() {
    view.backgroundColor = .black
    web.isInspectable = true
    web.load(URLRequest(url: url))
    bar.text = "X    " + (url.host ?? "")
    bar.textColor = .white
    bar.textAlignment = .center
    bar.backgroundColor = UIColor(white: 0.12, alpha: 1)
    card.backgroundColor = UIColor(white: 0.08, alpha: 1)
    card.layer.cornerRadius = 24
    [web, bar, card].forEach(view.addSubview)
  }
  override func viewDidLayoutSubviews() {
    let b = view.bounds, h = (b.height * 0.61).rounded()
    web.frame = CGRect(x: 0, y: 0, width: b.width, height: h)
    bar.frame = CGRect(x: 0, y: h, width: b.width, height: 52)
    card.frame = CGRect(x: 0, y: h + 60, width: b.width, height: max(0, b.height - h - 60))
  }
}

@MainActor func handle(_ u: URL) {
  let q = URLComponents(url: u, resolvingAgainstBaseURL: false)?.queryItems ?? []
  func v(_ k: String) -> String? { q.first { $0.name == k }?.value }
  switch u.host {
  case "present": present(v("style") ?? "default", v("url"))
  case "safari": dismissAll { if let s = v("url"), let p = URL(string: s) { UIApplication.shared.open(p) } }
  case "dismiss": dismissAll {}
  default: break
  }
}

struct Links: View {
  var body: some View {
    NavigationStack {
      List {
        ForEach(["default", "full", "over", "sheet", "webview", "xsheet"], id: \.self) { st in
          Button("Open \(st)") { present(st, UserDefaults.standard.string(forKey: "url")) }
        }
        Button("Open in Safari") {
          if let s = UserDefaults.standard.string(forKey: "url"), let u = URL(string: s) { UIApplication.shared.open(u) }
        }
      }.navigationTitle("Duo e2e host")
    }
    .onAppear {
      if let st = UserDefaults.standard.string(forKey: "style") {
        DispatchQueue.main.asyncAfter(deadline: .now() + 1) { present(st, UserDefaults.standard.string(forKey: "url")) }
      }
    }
  }
}
