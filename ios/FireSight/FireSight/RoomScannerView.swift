import SwiftUI
import RoomPlan
import UIKit

struct RoomScannerView: UIViewControllerRepresentable {
    let onComplete: (CapturedRoom) -> Void
    let onCancel: () -> Void
    let onError: (String) -> Void

    func makeUIViewController(context: Context) -> RoomScannerViewController {
        RoomScannerViewController(
            onComplete: onComplete,
            onCancel: onCancel,
            onError: onError
        )
    }

    func updateUIViewController(_ uiViewController: RoomScannerViewController, context: Context) {}
}

final class RoomScannerViewController: UIViewController, RoomCaptureViewDelegate, RoomCaptureSessionDelegate {
    private let onComplete: (CapturedRoom) -> Void
    private let onCancel: () -> Void
    private let onError: (String) -> Void

    private let captureConfiguration: RoomCaptureSession.Configuration = {
        var configuration = RoomCaptureSession.Configuration()
        configuration.isCoachingEnabled = true
        return configuration
    }()

    private var roomCaptureView: RoomCaptureView!
    private var isStoppingCapture = false

    private let headerBackdrop = UIVisualEffectView(effect: UIBlurEffect(style: .systemThinMaterialDark))
    private let footerBackdrop = UIVisualEffectView(effect: UIBlurEffect(style: .systemThinMaterialDark))
    private let statusLabel = UILabel()
    private let helperLabel = UILabel()
    private let processingBackdrop = UIVisualEffectView(effect: UIBlurEffect(style: .systemUltraThinMaterialDark))

    init(
        onComplete: @escaping (CapturedRoom) -> Void,
        onCancel: @escaping () -> Void,
        onError: @escaping (String) -> Void
    ) {
        self.onComplete = onComplete
        self.onCancel = onCancel
        self.onError = onError
        super.init(nibName: nil, bundle: nil)
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }

    override func viewDidLoad() {
        super.viewDidLoad()

        view.backgroundColor = .black

        roomCaptureView = RoomCaptureView(frame: .zero)
        roomCaptureView.delegate = self
        roomCaptureView.captureSession.delegate = self
        roomCaptureView.translatesAutoresizingMaskIntoConstraints = false

        view.addSubview(roomCaptureView)

        NSLayoutConstraint.activate([
            roomCaptureView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            roomCaptureView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            roomCaptureView.topAnchor.constraint(equalTo: view.topAnchor),
            roomCaptureView.bottomAnchor.constraint(equalTo: view.bottomAnchor),
        ])

        configureHeader()
        configureFooter()
        configureProcessingOverlay()
    }

    override func viewDidAppear(_ animated: Bool) {
        super.viewDidAppear(animated)
        roomCaptureView.captureSession.run(configuration: captureConfiguration)
    }

    private func configureHeader() {
        headerBackdrop.translatesAutoresizingMaskIntoConstraints = false
        headerBackdrop.layer.cornerRadius = 24
        headerBackdrop.clipsToBounds = true

        let titleLabel = UILabel()
        titleLabel.text = "RoomPlan capture"
        titleLabel.font = .systemFont(ofSize: 20, weight: .bold)
        titleLabel.textColor = .white

        statusLabel.text = "Move slowly and trace the room boundary."
        statusLabel.font = .systemFont(ofSize: 14, weight: .semibold)
        statusLabel.textColor = UIColor.white.withAlphaComponent(0.96)
        statusLabel.numberOfLines = 0

        helperLabel.text = "Capture walls first, then doors, windows, and large objects."
        helperLabel.font = .systemFont(ofSize: 13)
        helperLabel.textColor = UIColor.white.withAlphaComponent(0.84)
        helperLabel.numberOfLines = 0

        let stack = UIStackView(arrangedSubviews: [titleLabel, statusLabel, helperLabel])
        stack.axis = .vertical
        stack.spacing = 6
        stack.translatesAutoresizingMaskIntoConstraints = false

        headerBackdrop.contentView.addSubview(stack)
        view.addSubview(headerBackdrop)

        NSLayoutConstraint.activate([
            headerBackdrop.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 16),
            headerBackdrop.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -16),
            headerBackdrop.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor, constant: 12),

            stack.leadingAnchor.constraint(equalTo: headerBackdrop.contentView.leadingAnchor, constant: 16),
            stack.trailingAnchor.constraint(equalTo: headerBackdrop.contentView.trailingAnchor, constant: -16),
            stack.topAnchor.constraint(equalTo: headerBackdrop.contentView.topAnchor, constant: 14),
            stack.bottomAnchor.constraint(equalTo: headerBackdrop.contentView.bottomAnchor, constant: -14),
        ])
    }

    private func configureFooter() {
        footerBackdrop.translatesAutoresizingMaskIntoConstraints = false
        footerBackdrop.layer.cornerRadius = 28
        footerBackdrop.clipsToBounds = true

        let cancelButton = makeControlButton(
            title: "Cancel",
            tint: UIColor(white: 0.16, alpha: 0.94),
            textColor: .white
        )
        cancelButton.addTarget(self, action: #selector(cancelTapped), for: .touchUpInside)

        let finishButton = makeControlButton(title: "Finish scan", tint: UIColor.systemOrange, textColor: .white)
        finishButton.addTarget(self, action: #selector(doneTapped), for: .touchUpInside)

        let stack = UIStackView(arrangedSubviews: [cancelButton, finishButton])
        stack.axis = .horizontal
        stack.spacing = 12
        stack.distribution = .fillEqually
        stack.translatesAutoresizingMaskIntoConstraints = false

        footerBackdrop.contentView.addSubview(stack)
        view.addSubview(footerBackdrop)

        NSLayoutConstraint.activate([
            footerBackdrop.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 16),
            footerBackdrop.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -16),
            footerBackdrop.bottomAnchor.constraint(equalTo: view.safeAreaLayoutGuide.bottomAnchor, constant: -14),

            stack.leadingAnchor.constraint(equalTo: footerBackdrop.contentView.leadingAnchor, constant: 14),
            stack.trailingAnchor.constraint(equalTo: footerBackdrop.contentView.trailingAnchor, constant: -14),
            stack.topAnchor.constraint(equalTo: footerBackdrop.contentView.topAnchor, constant: 14),
            stack.bottomAnchor.constraint(equalTo: footerBackdrop.contentView.bottomAnchor, constant: -14),
            stack.heightAnchor.constraint(equalToConstant: 54),
        ])
    }

    private func configureProcessingOverlay() {
        processingBackdrop.translatesAutoresizingMaskIntoConstraints = false
        processingBackdrop.layer.cornerRadius = 26
        processingBackdrop.clipsToBounds = true
        processingBackdrop.isHidden = true

        let spinner = UIActivityIndicatorView(style: .large)
        spinner.startAnimating()

        let label = UILabel()
        label.text = "Processing room scan..."
        label.font = .systemFont(ofSize: 16, weight: .semibold)
        label.textColor = .white

        let stack = UIStackView(arrangedSubviews: [spinner, label])
        stack.axis = .vertical
        stack.spacing = 10
        stack.alignment = .center
        stack.translatesAutoresizingMaskIntoConstraints = false

        processingBackdrop.contentView.addSubview(stack)
        view.addSubview(processingBackdrop)

        NSLayoutConstraint.activate([
            processingBackdrop.centerXAnchor.constraint(equalTo: view.centerXAnchor),
            processingBackdrop.centerYAnchor.constraint(equalTo: view.centerYAnchor),
            processingBackdrop.widthAnchor.constraint(equalToConstant: 220),

            stack.leadingAnchor.constraint(equalTo: processingBackdrop.contentView.leadingAnchor, constant: 20),
            stack.trailingAnchor.constraint(equalTo: processingBackdrop.contentView.trailingAnchor, constant: -20),
            stack.topAnchor.constraint(equalTo: processingBackdrop.contentView.topAnchor, constant: 20),
            stack.bottomAnchor.constraint(equalTo: processingBackdrop.contentView.bottomAnchor, constant: -20),
        ])
    }

    private func makeControlButton(title: String, tint: UIColor, textColor: UIColor) -> UIButton {
        let button = UIButton(type: .system)
        button.setTitle(title, for: .normal)
        button.titleLabel?.font = .systemFont(ofSize: 17, weight: .bold)
        button.backgroundColor = tint
        button.setTitleColor(textColor, for: .normal)
        button.layer.cornerRadius = 18
        return button
    }

    @objc private func doneTapped() {
        guard !isStoppingCapture else {
            return
        }

        isStoppingCapture = true
        processingBackdrop.isHidden = false
        roomCaptureView.captureSession.stop()
    }

    @objc private func cancelTapped() {
        roomCaptureView.captureSession.stop()
        onCancel()
    }

    func captureView(shouldPresent roomDataForProcessing: CapturedRoomData, error: (any Error)?) -> Bool {
        if let error {
            onError(error.localizedDescription)
            return false
        }

        return true
    }

    func captureView(didPresent processedResult: CapturedRoom, error: (any Error)?) {
        if let error {
            onError(error.localizedDescription)
            return
        }

        onComplete(processedResult)
    }

    func captureSession(_ session: RoomCaptureSession, didProvide instruction: RoomCaptureSession.Instruction) {
        switch instruction {
        case .moveCloseToWall:
            statusLabel.text = "Move closer to the wall for a cleaner capture."
        case .moveAwayFromWall:
            statusLabel.text = "Move back slightly so the room outline stays in frame."
        case .slowDown:
            statusLabel.text = "Slow down and keep the phone steady."
        case .turnOnLight:
            statusLabel.text = "Increase lighting so RoomPlan can see the scene better."
        case .normal:
            statusLabel.text = "Room capture looks stable. Keep tracing the room."
        case .lowTexture:
            statusLabel.text = "Aim toward clearer edges or textured surfaces to improve tracking."
        @unknown default:
            statusLabel.text = "Continue moving around the room carefully."
        }
    }

    func captureSession(_ session: RoomCaptureSession, didEndWith data: CapturedRoomData, error: (any Error)?) {
        if let error, isStoppingCapture == false {
            onError(error.localizedDescription)
        }
    }
}
