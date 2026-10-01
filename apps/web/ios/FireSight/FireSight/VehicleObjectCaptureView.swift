import SwiftUI
import RealityKit

/// Entry point for capturing a 3D model of a vehicle with Apple Object Capture.
/// Object Capture requires iOS 17+ and a supported (LiDAR-class) device, so
/// this view gates on availability and falls back to an explanation otherwise.
struct VehicleCaptureView: View {
    /// Returns the filename (within Documents/models) of the produced USDZ.
    let onComplete: (String) -> Void
    let onCancel: () -> Void
    let onError: (String) -> Void

    var body: some View {
        Group {
            if #available(iOS 17.0, *), ObjectCaptureSession.isSupported {
                ObjectCaptureFlowView(
                    onComplete: onComplete,
                    onCancel: onCancel,
                    onError: onError
                )
            } else {
                UnsupportedCaptureView(onCancel: onCancel)
            }
        }
    }
}

private struct UnsupportedCaptureView: View {
    let onCancel: () -> Void

    var body: some View {
        ZStack {
            Color.black.ignoresSafeArea()
            VStack(spacing: 16) {
                Image(systemName: "cube.transparent")
                    .font(.system(size: 44))
                    .foregroundStyle(.white)

                Text("3D capture not available")
                    .font(.headline)
                    .foregroundStyle(.white)

                Text("Object Capture needs iOS 17 or later on a LiDAR-equipped iPhone/iPad. You can still document the vehicle with the AR scene sketch and photos.")
                    .font(.subheadline)
                    .multilineTextAlignment(.center)
                    .foregroundStyle(.white.opacity(0.82))
                    .padding(.horizontal, 36)

                Button("Close") { onCancel() }
                    .buttonStyle(.borderedProminent)
                    .tint(Color(red: 0.95, green: 0.42, blue: 0.16))
            }
        }
    }
}

@available(iOS 17.0, *)
private struct ObjectCaptureFlowView: View {
    let onComplete: (String) -> Void
    let onCancel: () -> Void
    let onError: (String) -> Void

    @State private var session = ObjectCaptureSession()
    @State private var phase: Phase = .starting
    @State private var reconstructionProgress: Double = 0
    @State private var imagesDirectory: URL?

    private enum Phase: Equatable {
        case starting
        case detecting
        case capturing
        case reconstructing
        case finished
        case failed(String)
    }

    var body: some View {
        ZStack {
            Color.black.ignoresSafeArea()

            switch phase {
            case .starting, .detecting, .capturing:
                ObjectCaptureView(session: session)
                    .ignoresSafeArea()
            case .reconstructing, .finished, .failed:
                Color.black.ignoresSafeArea()
            }

            VStack {
                topBar
                Spacer()
                controls
            }
        }
        .onAppear(perform: startSession)
        // CaptureState carries an Error in `.failed`, so it isn't reliably
        // Equatable. Drive transitions off a derived, Equatable stage token.
        .onChange(of: sessionStage) { _, _ in
            handleSessionState()
        }
    }

    /// Stable, Equatable summary of `session.state` used to detect transitions.
    /// Reading `session.state` here also registers SwiftUI observation.
    private var sessionStage: String {
        switch session.state {
        case .initializing: return "initializing"
        case .ready: return "ready"
        case .detecting: return "detecting"
        case .capturing: return "capturing"
        case .finishing: return "finishing"
        case .completed: return "completed"
        case .failed: return "failed"
        @unknown default: return "unknown"
        }
    }

    private var topBar: some View {
        HStack {
            Text("Capture vehicle 3D model")
                .font(.system(size: 16, weight: .bold))
                .foregroundStyle(.white)
            Spacer()
            Button {
                session.cancel()
                onCancel()
            } label: {
                Image(systemName: "xmark")
                    .font(.system(size: 15, weight: .bold))
                    .foregroundStyle(.white)
                    .padding(10)
                    .background(Circle().fill(.white.opacity(0.2)))
            }
        }
        .padding(16)
    }

    @ViewBuilder
    private var controls: some View {
        VStack(spacing: 12) {
            Text(guidanceText)
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(.white)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 24)

            switch phase {
            case .starting:
                ProgressView().tint(.white)

            case .detecting:
                Button {
                    // Transition is reflected back through session.state -> .capturing.
                    session.startCapturing()
                } label: {
                    captureButtonLabel("Start capture", systemImage: "camera.fill")
                }

            case .capturing:
                Button {
                    session.finish()
                } label: {
                    captureButtonLabel("Finish capture", systemImage: "checkmark")
                }

            case .reconstructing:
                VStack(spacing: 8) {
                    ProgressView(value: reconstructionProgress).tint(Color(red: 0.95, green: 0.42, blue: 0.16))
                    Text("Building 3D model… \(Int(reconstructionProgress * 100))%")
                        .font(.caption)
                        .foregroundStyle(.white.opacity(0.8))
                }
                .padding(.horizontal, 32)

            case .finished:
                Label("Model ready", systemImage: "checkmark.seal.fill")
                    .foregroundStyle(.green)

            case let .failed(message):
                VStack(spacing: 10) {
                    Text(message)
                        .font(.caption)
                        .foregroundStyle(.white.opacity(0.85))
                        .multilineTextAlignment(.center)
                    Button("Close") { onCancel() }
                        .buttonStyle(.borderedProminent)
                        .tint(Color(red: 0.95, green: 0.42, blue: 0.16))
                }
            }
        }
        .padding(.bottom, 28)
    }

    private func captureButtonLabel(_ title: String, systemImage: String) -> some View {
        Label(title, systemImage: systemImage)
            .font(.headline)
            .padding(.vertical, 14)
            .padding(.horizontal, 28)
            .background(Capsule().fill(Color(red: 0.95, green: 0.42, blue: 0.16)))
            .foregroundStyle(.white)
    }

    private var guidanceText: String {
        switch phase {
        case .starting:
            return "Preparing capture…"
        case .detecting:
            return "Frame the vehicle inside the box, then start the capture."
        case .capturing:
            return "Walk slowly around the vehicle, keeping it centred. Finish when you have covered all sides."
        case .reconstructing:
            return "Processing photos into a 3D model. Keep the app open."
        case .finished:
            return "Done."
        case .failed:
            return "Capture could not be completed."
        }
    }

    private func startSession() {
        let scratch = FileManager.default.temporaryDirectory
            .appendingPathComponent("vehicle-capture-\(UUID().uuidString)", isDirectory: true)
        let imagesDir = scratch.appendingPathComponent("images", isDirectory: true)
        let checkpointDir = scratch.appendingPathComponent("checkpoints", isDirectory: true)

        do {
            try FileManager.default.createDirectory(at: imagesDir, withIntermediateDirectories: true)
            try FileManager.default.createDirectory(at: checkpointDir, withIntermediateDirectories: true)
        } catch {
            phase = .failed(error.localizedDescription)
            return
        }

        imagesDirectory = imagesDir

        var configuration = ObjectCaptureSession.Configuration()
        configuration.checkpointDirectory = checkpointDir
        session.start(imagesDirectory: imagesDir, configuration: configuration)
    }

    private func handleSessionState() {
        switch session.state {
        case .ready:
            // Begin bounding-box detection as soon as the session is ready.
            _ = session.startDetecting()
            phase = .detecting
        case .detecting:
            phase = .detecting
        case .capturing:
            phase = .capturing
        case .completed:
            beginReconstruction()
        case let .failed(error):
            phase = .failed(error.localizedDescription)
            onError(error.localizedDescription)
        default:
            break
        }
    }

    private func beginReconstruction() {
        guard let imagesDirectory else {
            phase = .failed("Capture images are missing.")
            return
        }

        phase = .reconstructing

        let modelsDir = VehicleModelStore.modelsDirectory
        let fileName = "vehicle-\(Int(Date().timeIntervalSince1970)).usdz"
        let outputURL = modelsDir.appendingPathComponent(fileName)

        Task {
            do {
                try FileManager.default.createDirectory(at: modelsDir, withIntermediateDirectories: true)
                try await PhotogrammetryRunner.reconstruct(
                    imagesAt: imagesDirectory,
                    to: outputURL,
                    onProgress: { value in
                        Task { @MainActor in self.reconstructionProgress = value }
                    }
                )
                await MainActor.run {
                    self.phase = .finished
                    self.onComplete(fileName)
                }
            } catch {
                await MainActor.run {
                    self.phase = .failed(error.localizedDescription)
                    self.onError(error.localizedDescription)
                }
            }
        }
    }
}

/// Where exported USDZ vehicle models live, alongside the crash JSON drafts.
enum VehicleModelStore {
    static var modelsDirectory: URL {
        FileManager.default.urls(for: .documentDirectory, in: .userDomainMask).first!
            .appendingPathComponent("models", isDirectory: true)
    }

    static func modelURL(for fileName: String) -> URL {
        modelsDirectory.appendingPathComponent(fileName)
    }

    static func modelExists(_ fileName: String?) -> Bool {
        guard let fileName, !fileName.isEmpty else { return false }
        return FileManager.default.fileExists(atPath: modelURL(for: fileName).path)
    }
}

/// Runs offline photogrammetry to turn captured photos into a USDZ model.
@available(iOS 17.0, *)
enum PhotogrammetryRunner {
    nonisolated static func reconstruct(
        imagesAt input: URL,
        to output: URL,
        onProgress: @escaping (Double) -> Void
    ) async throws {
        let session = try PhotogrammetrySession(input: input)
        try session.process(requests: [.modelFile(url: output, detail: .reduced)])

        for try await update in session.outputs {
            switch update {
            case let .requestProgress(_, fractionComplete):
                onProgress(fractionComplete)
            case .processingComplete:
                onProgress(1.0)
                return
            case let .requestError(_, error):
                throw error
            case .processingCancelled:
                throw CancellationError()
            default:
                break
            }
        }
    }
}
