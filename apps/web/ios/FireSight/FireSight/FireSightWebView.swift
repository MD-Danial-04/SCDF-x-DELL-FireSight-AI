import SwiftUI
import UIKit
import WebKit

/// Holds a weak reference to the live `WKWebView` so SwiftUI views (e.g. the
/// room scan workspace) can deliver a captured scan straight into the embedded
/// web app without going through the Files app.
final class WebAppBridge {
    weak var webView: WKWebView?

    /// Deliver a room scan JSON payload to the web app. The bytes are base64
    /// encoded so they can be embedded in the JS call without any escaping
    /// concerns (quotes, newlines, unicode).
    func deliverRoomScan(jsonData: Data) {
        let base64 = jsonData.base64EncodedString()
        let js = "window.fireSightRoomScan && window.fireSightRoomScan.deliverBase64('\(base64)')"
        webView?.evaluateJavaScript(js, completionHandler: nil)
    }
}

struct FireSightWebView: UIViewRepresentable {
    let urlString: String
    let bridge: WebAppBridge
    @Binding var launcherIsTrailing: Bool
    @Binding var launcherVerticalProgress: Double
    let onOpenRoomScan: () -> Void

    func makeCoordinator() -> Coordinator {
        Coordinator(parent: self)
    }

    func makeUIView(context: Context) -> FireSightWebContainerView {
        let containerView = FireSightWebContainerView()
        containerView.coordinator = context.coordinator
        containerView.webView.navigationDelegate = context.coordinator
        containerView.webView.uiDelegate = context.coordinator
        bridge.webView = containerView.webView
        containerView.load(urlString: urlString)
        containerView.applyLauncherPosition(
            isTrailing: launcherIsTrailing,
            verticalProgress: launcherVerticalProgress,
            animated: false
        )
        return containerView
    }

    func updateUIView(_ uiView: FireSightWebContainerView, context: Context) {
        context.coordinator.parent = self
        uiView.coordinator = context.coordinator
        uiView.webView.navigationDelegate = context.coordinator
        uiView.webView.uiDelegate = context.coordinator
        bridge.webView = uiView.webView
        uiView.load(urlString: urlString)
        uiView.applyLauncherPosition(
            isTrailing: launcherIsTrailing,
            verticalProgress: launcherVerticalProgress,
            animated: !uiView.launcherOverlay.isDragging
        )
    }

    final class Coordinator: NSObject, WKNavigationDelegate, WKUIDelegate {
        var parent: FireSightWebView

        init(parent: FireSightWebView) {
            self.parent = parent
        }

        func openRoomScan() {
            parent.onOpenRoomScan()
        }

        // Allow the embedded web app to capture mic/camera (e.g. recording stop
        // messages and interviews). iOS still shows the system permission prompt
        // the first time, gated by the usage strings in Info.
        func webView(
            _ webView: WKWebView,
            requestMediaCapturePermissionFor origin: WKSecurityOrigin,
            initiatedByFrame frame: WKFrameInfo,
            type: WKMediaCaptureType,
            decisionHandler: @escaping (WKPermissionDecision) -> Void
        ) {
            decisionHandler(.grant)
        }

        func persistLauncherPosition(isTrailing: Bool, verticalProgress: Double) {
            let clampedProgress = min(max(verticalProgress, 0), 1)

            if parent.launcherIsTrailing != isTrailing {
                parent.launcherIsTrailing = isTrailing
            }

            if abs(parent.launcherVerticalProgress - clampedProgress) > 0.0005 {
                parent.launcherVerticalProgress = clampedProgress
            }
        }

        func webView(_ webView: WKWebView, didStartProvisionalNavigation navigation: WKNavigation!) {
            print("WebView started loading")
        }

        func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
            print("WebView finished loading")
        }

        func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
            print("WebView failed:", error.localizedDescription)
        }

        func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
            print("WebView provisional failed:", error.localizedDescription)
        }
    }
}

final class FireSightWebContainerView: UIView {
    let webView = WKWebView()
    let launcherOverlay = RoomScanLauncherOverlayView()
    weak var coordinator: FireSightWebView.Coordinator? {
        didSet {
            launcherOverlay.coordinator = coordinator
        }
    }

    private var loadedURLString: String?
    private var urlObservation: NSKeyValueObservation?
    private let launcherVisiblePaths: Set<String> = [
        "/incident",
        "/report",
        "/stop-message",
    ]

    override init(frame: CGRect) {
        super.init(frame: frame)
        configureWebView()
        configureLauncherOverlay()
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }

    override func layoutSubviews() {
        super.layoutSubviews()
        launcherOverlay.frame = bounds
    }

    func load(urlString: String) {
        guard loadedURLString != urlString else {
            return
        }

        loadedURLString = urlString

        if let url = URL(string: urlString) {
            print("Loading URL:", url.absoluteString)
            webView.load(URLRequest(url: url))
            updateLauncherVisibility(for: url)
        } else {
            print("Invalid URL:", urlString)
        }
    }

    func applyLauncherPosition(isTrailing: Bool, verticalProgress: Double, animated: Bool) {
        launcherOverlay.applyStoredPosition(
            isTrailing: isTrailing,
            verticalProgress: verticalProgress,
            animated: animated
        )
    }

    private func configureWebView() {
        webView.translatesAutoresizingMaskIntoConstraints = false
        webView.allowsBackForwardNavigationGestures = true
        addSubview(webView)

        NSLayoutConstraint.activate([
            webView.leadingAnchor.constraint(equalTo: leadingAnchor),
            webView.trailingAnchor.constraint(equalTo: trailingAnchor),
            webView.topAnchor.constraint(equalTo: topAnchor),
            webView.bottomAnchor.constraint(equalTo: bottomAnchor),
        ])

        urlObservation = webView.observe(\.url, options: [.initial, .new]) { [weak self] webView, _ in
            self?.updateLauncherVisibility(for: webView.url)
        }
    }

    private func configureLauncherOverlay() {
        launcherOverlay.frame = bounds
        launcherOverlay.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        launcherOverlay.isUserInteractionEnabled = false
        addSubview(launcherOverlay)
    }

    private func updateLauncherVisibility(for url: URL?) {
        let path = normalizedPath(from: url)
        let shouldShowLauncher = launcherVisiblePaths.contains(path)
        launcherOverlay.setVisible(shouldShowLauncher, animated: true)
    }

    private func normalizedPath(from url: URL?) -> String {
        let rawPath = url?.path ?? "/"
        if rawPath.isEmpty {
            return "/"
        }

        let trimmed = rawPath.hasSuffix("/") && rawPath.count > 1
            ? String(rawPath.dropLast())
            : rawPath

        return trimmed
    }
}

final class RoomScanLauncherOverlayView: UIView {
    weak var coordinator: FireSightWebView.Coordinator?

    private let launcherButton = UIButton(type: .custom)
    private let gradientLayer = CAGradientLayer()
    private let launcherIconBackdrop = UIView()
    private let launcherIconView = UIImageView()

    private let launcherSize: CGFloat = 68
    private let interactionInset: CGFloat = 6
    private let edgePadding: CGFloat = 18
    private let dragActivationDelay: Double = 0.22

    private var storedIsTrailing = true
    private var storedVerticalProgress: CGFloat = 1
    private(set) var isDragging = false
    private var isLauncherVisible = false
    private var didMoveDuringCurrentPress = false
    private var dragTouchOffset = CGPoint.zero

    private lazy var longPressRecognizer: UILongPressGestureRecognizer = {
        let recognizer = UILongPressGestureRecognizer(target: self, action: #selector(handleLongPress(_:)))
        recognizer.minimumPressDuration = dragActivationDelay
        recognizer.allowableMovement = 18
        recognizer.cancelsTouchesInView = false
        return recognizer
    }()

    override init(frame: CGRect) {
        super.init(frame: frame)
        backgroundColor = .clear
        isOpaque = false
        configureLauncherButton()
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }

    override func layoutSubviews() {
        super.layoutSubviews()

        launcherButton.bounds = CGRect(x: 0, y: 0, width: launcherSize, height: launcherSize)
        gradientLayer.frame = launcherButton.bounds
        gradientLayer.cornerRadius = launcherSize / 2

        guard !isDragging else {
            return
        }

        launcherButton.center = restingCenter()
    }

    override func point(inside point: CGPoint, with event: UIEvent?) -> Bool {
        guard isLauncherVisible else {
            return false
        }

        return launcherButton.frame.insetBy(dx: -interactionInset, dy: -interactionInset).contains(point)
    }

    override func hitTest(_ point: CGPoint, with event: UIEvent?) -> UIView? {
        guard self.point(inside: point, with: event) else {
            return nil
        }

        return launcherButton
    }

    func applyStoredPosition(isTrailing: Bool, verticalProgress: Double, animated: Bool) {
        storedIsTrailing = isTrailing
        storedVerticalProgress = min(max(CGFloat(verticalProgress), 0), 1)

        guard bounds.width > 0, bounds.height > 0, !isDragging else {
            return
        }

        let targetCenter = restingCenter()
        if animated {
            UIView.animate(withDuration: 0.22, delay: 0, usingSpringWithDamping: 0.82, initialSpringVelocity: 0.2) {
                self.launcherButton.center = targetCenter
            }
        } else {
            launcherButton.center = targetCenter
        }
    }

    func setVisible(_ visible: Bool, animated: Bool) {
        guard visible != isLauncherVisible else {
            return
        }

        isLauncherVisible = visible
        isUserInteractionEnabled = visible

        let updates = {
            self.launcherButton.alpha = visible ? 1 : 0
            self.launcherButton.transform = visible ? .identity : CGAffineTransform(scaleX: 0.88, y: 0.88)
        }

        if animated {
            UIView.animate(withDuration: 0.18, delay: 0, options: [.beginFromCurrentState, .curveEaseInOut], animations: updates)
        } else {
            updates()
        }
    }

    private func configureLauncherButton() {
        launcherButton.backgroundColor = .clear
        launcherButton.alpha = 0
        launcherButton.layer.cornerRadius = launcherSize / 2
        launcherButton.layer.masksToBounds = false
        launcherButton.layer.shadowOffset = CGSize(width: 0, height: 12)
        launcherButton.layer.shadowRadius = 18
        launcherButton.layer.shadowOpacity = 0.24
        launcherButton.layer.shadowColor = UIColor.black.cgColor
        launcherButton.layer.borderWidth = 0
        launcherButton.layer.borderColor = UIColor.clear.cgColor

        gradientLayer.colors = [
            UIColor(red: 0.88, green: 0.18, blue: 0.15, alpha: 1).cgColor,
            UIColor(red: 1.0, green: 0.44, blue: 0.13, alpha: 1).cgColor,
        ]
        gradientLayer.startPoint = CGPoint(x: 0, y: 0)
        gradientLayer.endPoint = CGPoint(x: 1, y: 1)
        launcherButton.layer.insertSublayer(gradientLayer, at: 0)

        launcherIconBackdrop.translatesAutoresizingMaskIntoConstraints = false
        launcherIconBackdrop.isUserInteractionEnabled = false
        launcherIconBackdrop.backgroundColor = UIColor.white.withAlphaComponent(0.96)
        launcherIconBackdrop.layer.cornerRadius = 18
        launcherIconBackdrop.layer.shadowColor = UIColor.black.cgColor
        launcherIconBackdrop.layer.shadowOpacity = 0.10
        launcherIconBackdrop.layer.shadowRadius = 8
        launcherIconBackdrop.layer.shadowOffset = CGSize(width: 0, height: 4)

        launcherIconView.translatesAutoresizingMaskIntoConstraints = false
        launcherIconView.isUserInteractionEnabled = false
        launcherIconView.contentMode = .scaleAspectFit
        launcherIconView.tintColor = UIColor(red: 0.96, green: 0.39, blue: 0.13, alpha: 1)
        launcherIconView.image = UIImage(
            systemName: "viewfinder",
            withConfiguration: UIImage.SymbolConfiguration(pointSize: 19, weight: .bold)
        )

        launcherButton.addSubview(launcherIconBackdrop)
        launcherIconBackdrop.addSubview(launcherIconView)

        NSLayoutConstraint.activate([
            launcherIconBackdrop.centerXAnchor.constraint(equalTo: launcherButton.centerXAnchor),
            launcherIconBackdrop.centerYAnchor.constraint(equalTo: launcherButton.centerYAnchor),
            launcherIconBackdrop.widthAnchor.constraint(equalToConstant: 36),
            launcherIconBackdrop.heightAnchor.constraint(equalToConstant: 36),

            launcherIconView.centerXAnchor.constraint(equalTo: launcherIconBackdrop.centerXAnchor),
            launcherIconView.centerYAnchor.constraint(equalTo: launcherIconBackdrop.centerYAnchor),
            launcherIconView.widthAnchor.constraint(equalToConstant: 22),
            launcherIconView.heightAnchor.constraint(equalToConstant: 22),
        ])

        launcherButton.addTarget(self, action: #selector(handleTouchDown), for: [.touchDown, .touchDragEnter])
        launcherButton.addTarget(self, action: #selector(handleTouchRelease), for: [.touchUpOutside, .touchCancel, .touchDragExit])
        launcherButton.addTarget(self, action: #selector(handleTapInside), for: .touchUpInside)
        launcherButton.addGestureRecognizer(longPressRecognizer)

        addSubview(launcherButton)
    }

    @objc private func handleTouchDown() {
        didMoveDuringCurrentPress = false
        setPressed(true, animated: true)
    }

    @objc private func handleTouchRelease() {
        guard !isDragging else {
            return
        }

        setPressed(false, animated: true)
    }

    @objc private func handleTapInside() {
        let shouldOpen = !isDragging && !didMoveDuringCurrentPress

        didMoveDuringCurrentPress = false
        setPressed(false, animated: true)

        if shouldOpen {
            coordinator?.openRoomScan()
        }
    }

    @objc private func handleLongPress(_ recognizer: UILongPressGestureRecognizer) {
        let location = recognizer.location(in: self)

        switch recognizer.state {
        case .began:
            isDragging = true
            didMoveDuringCurrentPress = false
            dragTouchOffset = CGPoint(
                x: launcherButton.center.x - location.x,
                y: launcherButton.center.y - location.y
            )
            setPressed(true, animated: true)

        case .changed:
            let proposedCenter = CGPoint(
                x: location.x + dragTouchOffset.x,
                y: location.y + dragTouchOffset.y
            )
            let clampedCenter = clampToMovementBounds(proposedCenter)

            if distance(from: launcherButton.center, to: clampedCenter) > 1 {
                didMoveDuringCurrentPress = true
            }

            launcherButton.center = clampedCenter

        case .ended, .cancelled, .failed:
            guard isDragging else {
                return
            }

            isDragging = false
            snapLauncherToNearestEdge()
            DispatchQueue.main.async {
                self.didMoveDuringCurrentPress = false
            }

        default:
            break
        }
    }

    private func setPressed(_ pressed: Bool, animated: Bool) {
        let updates = {
            self.launcherButton.transform = pressed ? CGAffineTransform(scaleX: 1.08, y: 1.08) : .identity
            self.launcherButton.layer.borderWidth = pressed ? 2.5 : 0
            self.launcherButton.layer.borderColor = UIColor.white.withAlphaComponent(pressed ? 0.82 : 0).cgColor
            self.launcherButton.layer.shadowRadius = pressed ? 22 : 18
            self.launcherButton.layer.shadowOpacity = pressed ? 0.28 : 0.24
            self.launcherButton.layer.shadowOffset = CGSize(width: 0, height: pressed ? 14 : 12)
            self.launcherIconBackdrop.transform = pressed ? CGAffineTransform(scaleX: 1.05, y: 1.05) : .identity
            self.launcherIconBackdrop.backgroundColor = UIColor.white.withAlphaComponent(pressed ? 1.0 : 0.96)
        }

        if animated {
            UIView.animate(withDuration: 0.16, delay: 0, options: [.beginFromCurrentState, .curveEaseOut], animations: updates)
        } else {
            updates()
        }
    }

    private func snapLauncherToNearestEdge() {
        let bounds = movementBounds()
        let snappedTrailing = launcherButton.center.x >= bounds.midX
        let clampedVerticalProgress = bounds.verticalRange > 0
            ? Double((launcherButton.center.y - bounds.minY) / bounds.verticalRange)
            : 1.0

        storedIsTrailing = snappedTrailing
        storedVerticalProgress = min(max(CGFloat(clampedVerticalProgress), 0), 1)

        coordinator?.persistLauncherPosition(
            isTrailing: snappedTrailing,
            verticalProgress: Double(storedVerticalProgress)
        )

        UIView.animate(withDuration: 0.22, delay: 0, usingSpringWithDamping: 0.82, initialSpringVelocity: 0.2) {
            self.launcherButton.center = self.restingCenter()
            self.setPressed(false, animated: false)
        }
    }

    private func restingCenter() -> CGPoint {
        let bounds = movementBounds()
        let y = bounds.minY + (storedVerticalProgress * bounds.verticalRange)

        return CGPoint(
            x: storedIsTrailing ? bounds.maxX : bounds.minX,
            y: y
        )
    }

    private func movementBounds() -> LauncherBounds {
        let minX = safeAreaInsets.left + edgePadding + (launcherSize / 2)
        let maxX = max(bounds.width - safeAreaInsets.right - edgePadding - (launcherSize / 2), minX)
        let minY = safeAreaInsets.top + edgePadding + (launcherSize / 2)
        let maxY = max(bounds.height - safeAreaInsets.bottom - edgePadding - (launcherSize / 2), minY)

        return LauncherBounds(minX: minX, maxX: maxX, minY: minY, maxY: maxY)
    }

    private func clampToMovementBounds(_ point: CGPoint) -> CGPoint {
        let bounds = movementBounds()

        return CGPoint(
            x: min(max(point.x, bounds.minX), bounds.maxX),
            y: min(max(point.y, bounds.minY), bounds.maxY)
        )
    }

    private func distance(from start: CGPoint, to end: CGPoint) -> CGFloat {
        hypot(end.x - start.x, end.y - start.y)
    }
}

private struct LauncherBounds {
    let minX: CGFloat
    let maxX: CGFloat
    let minY: CGFloat
    let maxY: CGFloat

    var midX: CGFloat {
        (minX + maxX) / 2
    }

    var verticalRange: CGFloat {
        max(maxY - minY, 0)
    }
}
