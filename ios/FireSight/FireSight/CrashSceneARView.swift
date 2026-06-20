import SwiftUI
import ARKit
import RealityKit
import simd

/// What a tap on the AR scene places.
enum CrashSceneCaptureMode: String, CaseIterable, Identifiable {
    case vehicle
    case marker
    case measure

    var id: String { rawValue }

    var label: String {
        switch self {
        case .vehicle: return "Vehicle"
        case .marker: return "Marker"
        case .measure: return "Measure"
        }
    }

    var systemImage: String {
        switch self {
        case .vehicle: return "car.fill"
        case .marker: return "mappin.and.ellipse"
        case .measure: return "ruler.fill"
        }
    }
}

/// Full-screen AR experience for sketching a crash scene. Tapping places
/// vehicles, hazard markers, or measurement endpoints on detected ground
/// surfaces; positions are projected top-down into the crash document.
struct CrashSceneCaptureView: View {
    let onComplete: (_ vehicles: [Vehicle], _ markers: [SceneMarker], _ measurements: [SceneMeasurement]) -> Void
    let onCancel: () -> Void
    let onError: (String) -> Void

    @State private var mode: CrashSceneCaptureMode = .marker
    @State private var markerKind: SceneMarker.Kind = .hazard
    @State private var statusText = "Move the phone slowly so ARKit can find the ground."

    @State private var vehicles: [Vehicle] = []
    @State private var markers: [SceneMarker] = []
    @State private var measurements: [SceneMeasurement] = []
    @State private var pendingMeasureNote = "Tap the first point of the distance."

    var body: some View {
        ZStack {
            if ARWorldTrackingConfiguration.isSupported {
                ARSceneContainer(
                    mode: mode,
                    markerKind: markerKind,
                    onPlaceVehicle: { point in
                        var vehicle = Vehicle()
                        vehicle.label = "Vehicle \(vehicles.count + 1)"
                        vehicle.position = point
                        vehicles.append(vehicle)
                        statusText = "Vehicle \(vehicles.count) placed. Adjust details after you finish."
                    },
                    onPlaceMarker: { kind, point in
                        var marker = SceneMarker()
                        marker.kind = kind
                        marker.label = "\(kind.label) \(markers.filter { $0.kind == kind }.count + 1)"
                        marker.severity = defaultSeverity(for: kind)
                        marker.position = point
                        markers.append(marker)
                        statusText = "\(kind.label) marked."
                    },
                    onMeasure: { start, end, distance in
                        var measurement = SceneMeasurement()
                        measurement.label = "Distance \(measurements.count + 1)"
                        measurement.start = start
                        measurement.end = end
                        measurement.distance = (distance * 100).rounded() / 100
                        measurements.append(measurement)
                        statusText = String(format: "Measured %.2f m.", measurement.distance)
                        pendingMeasureNote = "Tap the first point of the next distance."
                    },
                    onMeasurePendingChange: { hasFirstPoint in
                        pendingMeasureNote = hasFirstPoint
                            ? "Tap the second point to complete the distance."
                            : "Tap the first point of the distance."
                    },
                    onStatus: { statusText = $0 },
                    onError: onError
                )
                .ignoresSafeArea()
            } else {
                unsupportedOverlay
            }

            VStack(spacing: 0) {
                header
                Spacer()
                controls
            }
        }
        .background(Color.black.ignoresSafeArea())
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack {
                Text("Crash scene sketch")
                    .font(.system(size: 18, weight: .bold))
                    .foregroundStyle(.white)

                Spacer()

                Button {
                    onCancel()
                } label: {
                    Image(systemName: "xmark")
                        .font(.system(size: 15, weight: .bold))
                        .foregroundStyle(.white)
                        .padding(10)
                        .background(Circle().fill(.white.opacity(0.18)))
                }
            }

            Text(mode == .measure ? pendingMeasureNote : statusText)
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(.white.opacity(0.95))
                .fixedSize(horizontal: false, vertical: true)
        }
        .padding(16)
        .background(
            RoundedRectangle(cornerRadius: 22, style: .continuous)
                .fill(.ultraThinMaterial.opacity(0.9))
                .environment(\.colorScheme, .dark)
        )
        .padding(.horizontal, 16)
        .padding(.top, 8)
    }

    private var controls: some View {
        VStack(spacing: 12) {
            HStack(spacing: 14) {
                StatChip(systemImage: "car.fill", text: "\(vehicles.count)", tint: Color(red: 0.23, green: 0.53, blue: 0.96))
                StatChip(systemImage: "mappin", text: "\(markers.count)", tint: Color(red: 0.95, green: 0.42, blue: 0.16))
                StatChip(systemImage: "ruler", text: "\(measurements.count)", tint: Color(red: 0.20, green: 0.62, blue: 0.44))
            }

            Picker("Mode", selection: $mode) {
                ForEach(CrashSceneCaptureMode.allCases) { item in
                    Label(item.label, systemImage: item.systemImage).tag(item)
                }
            }
            .pickerStyle(.segmented)
            .colorScheme(.dark)

            if mode == .marker {
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 8) {
                        ForEach(SceneMarker.Kind.allCases) { kind in
                            Button {
                                markerKind = kind
                            } label: {
                                Label(kind.label, systemImage: kind.systemImage)
                                    .font(.caption.weight(.semibold))
                                    .padding(.horizontal, 12)
                                    .padding(.vertical, 8)
                                    .background(
                                        Capsule().fill(
                                            markerKind == kind
                                                ? Color(red: 0.95, green: 0.42, blue: 0.16)
                                                : Color.white.opacity(0.16)
                                        )
                                    )
                                    .foregroundStyle(.white)
                            }
                        }
                    }
                }
            }

            HStack(spacing: 12) {
                Button {
                    undoLast()
                } label: {
                    Label("Undo last", systemImage: "arrow.uturn.backward")
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 14)
                        .background(RoundedRectangle(cornerRadius: 16).fill(.white.opacity(0.16)))
                        .foregroundStyle(.white)
                }
                .disabled(vehicles.isEmpty && markers.isEmpty && measurements.isEmpty)

                Button {
                    onComplete(vehicles, markers, measurements)
                } label: {
                    Label("Finish sketch", systemImage: "checkmark")
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 14)
                        .background(RoundedRectangle(cornerRadius: 16).fill(Color(red: 0.95, green: 0.42, blue: 0.16)))
                        .foregroundStyle(.white)
                }
            }
            .font(.headline)
        }
        .padding(16)
        .background(
            RoundedRectangle(cornerRadius: 26, style: .continuous)
                .fill(.ultraThinMaterial.opacity(0.92))
                .environment(\.colorScheme, .dark)
        )
        .padding(.horizontal, 16)
        .padding(.bottom, 14)
    }

    private var unsupportedOverlay: some View {
        VStack(spacing: 16) {
            Image(systemName: "arkit")
                .font(.system(size: 44))
                .foregroundStyle(.white)

            Text("AR is not available on this device")
                .font(.headline)
                .foregroundStyle(.white)

            Text("You can still build a crash scene manually in the workspace.")
                .font(.subheadline)
                .multilineTextAlignment(.center)
                .foregroundStyle(.white.opacity(0.8))
                .padding(.horizontal, 40)

            Button("Close") { onCancel() }
                .buttonStyle(.borderedProminent)
                .tint(Color(red: 0.95, green: 0.42, blue: 0.16))
        }
    }

    private func undoLast() {
        // Removes the most recent placement from the data (the AR placeholder
        // stays on screen, but it won't be exported).
        if !measurements.isEmpty {
            measurements.removeLast()
        } else if !markers.isEmpty {
            markers.removeLast()
        } else if !vehicles.isEmpty {
            vehicles.removeLast()
        }
        statusText = "Removed the last placement from the sketch."
    }

    private func defaultSeverity(for kind: SceneMarker.Kind) -> SceneMarker.Severity {
        switch kind {
        case .fuelLeak, .fireOrigin, .casualty, .impactPoint:
            return .critical
        case .debris, .hazard, .skidMark:
            return .watch
        case .other:
            return .info
        }
    }
}

private struct StatChip: View {
    let systemImage: String
    let text: String
    let tint: Color

    var body: some View {
        Label(text, systemImage: systemImage)
            .font(.subheadline.weight(.bold))
            .padding(.horizontal, 12)
            .padding(.vertical, 7)
            .background(Capsule().fill(tint.opacity(0.85)))
            .foregroundStyle(.white)
    }
}

/// RealityKit AR view that raycasts taps onto detected surfaces and places
/// lightweight 3D placeholders, reporting top-down (x, z) coordinates back to
/// SwiftUI.
struct ARSceneContainer: UIViewRepresentable {
    var mode: CrashSceneCaptureMode
    var markerKind: SceneMarker.Kind
    let onPlaceVehicle: (CrashScanPoint) -> Void
    let onPlaceMarker: (SceneMarker.Kind, CrashScanPoint) -> Void
    let onMeasure: (CrashScanPoint, CrashScanPoint, Double) -> Void
    let onMeasurePendingChange: (Bool) -> Void
    let onStatus: (String) -> Void
    let onError: (String) -> Void

    func makeCoordinator() -> Coordinator {
        Coordinator(parent: self)
    }

    func makeUIView(context: Context) -> ARView {
        let arView = ARView(frame: .zero, cameraMode: .ar, automaticallyConfigureSession: false)
        context.coordinator.arView = arView

        let configuration = ARWorldTrackingConfiguration()
        configuration.planeDetection = [.horizontal, .vertical]
        configuration.environmentTexturing = .automatic
        if ARWorldTrackingConfiguration.supportsSceneReconstruction(.mesh) {
            configuration.sceneReconstruction = .mesh
        }
        arView.session.delegate = context.coordinator
        arView.session.run(configuration, options: [.resetTracking, .removeExistingAnchors])

        let tap = UITapGestureRecognizer(target: context.coordinator, action: #selector(Coordinator.handleTap(_:)))
        arView.addGestureRecognizer(tap)

        context.coordinator.installCoachingOverlay(on: arView)

        return arView
    }

    func updateUIView(_ uiView: ARView, context: Context) {
        context.coordinator.parent = self
    }

    static func dismantleUIView(_ uiView: ARView, coordinator: Coordinator) {
        uiView.session.pause()
    }

    final class Coordinator: NSObject, ARSessionDelegate, ARCoachingOverlayViewDelegate {
        var parent: ARSceneContainer
        weak var arView: ARView?

        private var pendingMeasureStart: SIMD3<Float>?
        private var didReportTrackingReady = false

        init(parent: ARSceneContainer) {
            self.parent = parent
        }

        func installCoachingOverlay(on arView: ARView) {
            let overlay = ARCoachingOverlayView()
            overlay.session = arView.session
            overlay.goal = .horizontalPlane
            overlay.activatesAutomatically = true
            overlay.delegate = self
            overlay.translatesAutoresizingMaskIntoConstraints = false
            arView.addSubview(overlay)
            NSLayoutConstraint.activate([
                overlay.leadingAnchor.constraint(equalTo: arView.leadingAnchor),
                overlay.trailingAnchor.constraint(equalTo: arView.trailingAnchor),
                overlay.topAnchor.constraint(equalTo: arView.topAnchor),
                overlay.bottomAnchor.constraint(equalTo: arView.bottomAnchor),
            ])
        }

        @objc func handleTap(_ recognizer: UITapGestureRecognizer) {
            guard let arView else { return }
            let location = recognizer.location(in: arView)

            guard let worldPosition = raycastWorldPosition(from: location, in: arView) else {
                DispatchQueue.main.async {
                    self.parent.onStatus("No surface found there. Aim at the ground and try again.")
                }
                return
            }

            let point = CrashScanPoint(x: rounded(Double(worldPosition.x)), y: rounded(Double(worldPosition.z)))

            switch parent.mode {
            case .vehicle:
                addEntity(makeVehicleEntity(), at: worldPosition, in: arView)
                DispatchQueue.main.async { self.parent.onPlaceVehicle(point) }

            case .marker:
                let kind = parent.markerKind
                addEntity(makeMarkerEntity(for: kind), at: worldPosition, in: arView)
                DispatchQueue.main.async { self.parent.onPlaceMarker(kind, point) }

            case .measure:
                handleMeasureTap(at: worldPosition, point: point, in: arView)
            }
        }

        private func handleMeasureTap(at worldPosition: SIMD3<Float>, point: CrashScanPoint, in arView: ARView) {
            addEntity(makeMeasurePointEntity(), at: worldPosition, in: arView)

            if let start = pendingMeasureStart {
                let distance = Double(simd_distance(start, worldPosition))
                addMeasureLine(from: start, to: worldPosition, in: arView)
                let startPoint = CrashScanPoint(x: rounded(Double(start.x)), y: rounded(Double(start.z)))
                pendingMeasureStart = nil
                DispatchQueue.main.async {
                    self.parent.onMeasure(startPoint, point, distance)
                    self.parent.onMeasurePendingChange(false)
                }
            } else {
                pendingMeasureStart = worldPosition
                DispatchQueue.main.async {
                    self.parent.onMeasurePendingChange(true)
                }
            }
        }

        private func raycastWorldPosition(from location: CGPoint, in arView: ARView) -> SIMD3<Float>? {
            // Prefer existing detected planes, then fall back to estimated planes.
            if let result = arView.raycast(from: location, allowing: .existingPlaneGeometry, alignment: .any).first
                ?? arView.raycast(from: location, allowing: .estimatedPlane, alignment: .any).first {
                let t = result.worldTransform.columns.3
                return SIMD3<Float>(t.x, t.y, t.z)
            }
            return nil
        }

        private func addEntity(_ entity: ModelEntity, at position: SIMD3<Float>, in arView: ARView) {
            let anchor = AnchorEntity(world: position)
            anchor.addChild(entity)
            arView.scene.addAnchor(anchor)
        }

        private func addMeasureLine(from start: SIMD3<Float>, to end: SIMD3<Float>, in arView: ARView) {
            let midpoint = (start + end) / 2
            let distance = simd_distance(start, end)
            guard distance > 0.0001 else { return }

            let mesh = MeshResource.generateBox(size: SIMD3<Float>(distance, 0.012, 0.012))
            let material = SimpleMaterial(color: UIColor(red: 0.20, green: 0.62, blue: 0.44, alpha: 1), isMetallic: false)
            let line = ModelEntity(mesh: mesh, materials: [material])

            let direction = simd_normalize(end - start)
            line.transform.rotation = simd_quatf(from: SIMD3<Float>(1, 0, 0), to: direction)

            let anchor = AnchorEntity(world: midpoint)
            anchor.addChild(line)
            arView.scene.addAnchor(anchor)
        }

        private func makeVehicleEntity() -> ModelEntity {
            let mesh = MeshResource.generateBox(size: SIMD3<Float>(0.32, 0.10, 0.18), cornerRadius: 0.03)
            let material = SimpleMaterial(color: UIColor(red: 0.23, green: 0.53, blue: 0.96, alpha: 0.92), isMetallic: false)
            let entity = ModelEntity(mesh: mesh, materials: [material])
            entity.transform.translation.y = 0.05
            return entity
        }

        private func makeMarkerEntity(for kind: SceneMarker.Kind) -> ModelEntity {
            let mesh = MeshResource.generateSphere(radius: 0.06)
            let material = SimpleMaterial(color: color(for: kind), isMetallic: false)
            let entity = ModelEntity(mesh: mesh, materials: [material])
            entity.transform.translation.y = 0.06
            return entity
        }

        private func makeMeasurePointEntity() -> ModelEntity {
            let mesh = MeshResource.generateSphere(radius: 0.03)
            let material = SimpleMaterial(color: .white, isMetallic: false)
            return ModelEntity(mesh: mesh, materials: [material])
        }

        private func color(for kind: SceneMarker.Kind) -> UIColor {
            switch kind {
            case .impactPoint: return UIColor(red: 0.86, green: 0.17, blue: 0.16, alpha: 1)
            case .fuelLeak: return UIColor(red: 0.40, green: 0.30, blue: 0.92, alpha: 1)
            case .fireOrigin: return UIColor(red: 1.0, green: 0.44, blue: 0.13, alpha: 1)
            case .casualty: return UIColor(red: 0.90, green: 0.10, blue: 0.35, alpha: 1)
            case .hazard: return UIColor(red: 0.95, green: 0.66, blue: 0.16, alpha: 1)
            case .debris: return UIColor(red: 0.55, green: 0.55, blue: 0.60, alpha: 1)
            case .skidMark: return UIColor(red: 0.20, green: 0.20, blue: 0.24, alpha: 1)
            case .other: return UIColor(red: 0.23, green: 0.53, blue: 0.96, alpha: 1)
            }
        }

        private func rounded(_ value: Double) -> Double {
            (value * 1000).rounded() / 1000
        }

        // MARK: - ARSessionDelegate

        func session(_ session: ARSession, cameraDidChangeTrackingState camera: ARCamera) {
            let message: String?
            switch camera.trackingState {
            case .normal:
                message = didReportTrackingReady ? nil : "Tracking ready. Tap the ground to place items."
                didReportTrackingReady = true
            case .notAvailable:
                message = "Tracking unavailable — keep the camera steady."
            case let .limited(reason):
                switch reason {
                case .excessiveMotion:
                    message = "Slow down — moving too fast to track."
                case .insufficientFeatures:
                    message = "Not enough detail. Aim at textured ground."
                case .initializing:
                    message = "Initializing AR — move slowly to map the ground."
                case .relocalizing:
                    message = "Recovering tracking — hold steady."
                @unknown default:
                    message = "Adjusting tracking…"
                }
            @unknown default:
                message = nil
            }

            if let message {
                DispatchQueue.main.async { self.parent.onStatus(message) }
            }
        }

        func session(_ session: ARSession, didFailWithError error: Error) {
            DispatchQueue.main.async { self.parent.onError(error.localizedDescription) }
        }
    }
}
