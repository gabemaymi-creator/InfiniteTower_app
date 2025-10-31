import SwiftUI
import WebKit

final class LocalWebView: WKWebView {
    init() {
        let cfg = WKWebViewConfiguration()
        cfg.limitsNavigationsToAppBoundDomains = false
        super.init(frame: .zero, configuration: cfg)
        navigationDelegate = self
        allowsBackForwardNavigationGestures = false
        isOpaque = false
        backgroundColor = .clear
        scrollView.bounces = true
    }
    required init?(coder: NSCoder) { fatalError() }
}

extension LocalWebView: WKNavigationDelegate {}

struct WebContainer: UIViewRepresentable {          // for iOS + Catalyst
    func makeUIView(context: Context) -> WKWebView {
        let web = LocalWebView()
        if let url = findIndexHTML() {
            #if DEBUG
            print("[WebContainer] Loading index from: \(url.path)")
            #endif
            web.loadFileURL(url, allowingReadAccessTo: url.deletingLastPathComponent())
        } else {
            #if DEBUG
            print("[WebContainer] ERROR: index.html not found in bundle. Check Target Membership and Copy Bundle Resources.")
            #endif
            web.loadHTMLString("<h1>index.html missing</h1>", baseURL: nil)
        }
        return web
    }
    func updateUIView(_ view: WKWebView, context: Context) {}
}

private func findIndexHTML() -> URL? {
    let fm = FileManager.default
    // Case 1: blue Folder Reference named "WWW"
    if let url = Bundle.main.url(forResource: "index", withExtension: "html", subdirectory: "WWW") {
        return url
    }
    // Case 2: added as loose files (yellow group), lives at bundle root
    if let url = Bundle.main.url(forResource: "index", withExtension: "html") {
        return url
    }
    // Case 3: try common paths manually
    if let res = Bundle.main.resourceURL {
        for path in ["WWW/index.html", "www/index.html", "index.html"] {
            let u = res.appendingPathComponent(path)
            if fm.fileExists(atPath: u.path) { return u }
        }
    }
    return nil
}
