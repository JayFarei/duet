import SwiftUI
import SafariServices
import UIKit

// e2e test host: presents a page in SFSafariViewController the way an app's link preview does.
//   launch args:  -url <page> -style default|full|over|sheet   (presents 1s after launch)
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
        ForEach(["default", "full", "over", "sheet"], id: \.self) { st in
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
