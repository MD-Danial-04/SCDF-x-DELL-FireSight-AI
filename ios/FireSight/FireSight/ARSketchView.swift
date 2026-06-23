import SwiftUI
import Combine
import ARKit
import SceneKit
import simd

/// Which document the AR sketch feeds. Controls the available tools and how
/// placements are mapped to domain objects.
enum ARSketchContext {
    case room
    case crash
}

/// What a placement creates.
enum ARSketchTool: String, CaseIterable, Identifiable {
    case outline
    case marker
    case line

    var id: String { rawValue }

    var label: String {
        switch self {
        case .outline: return "Outline"
        case .marker: return "Marker"
        case .line: return "Measure"
        }
    }

    var systemImage: String {
        switch self {
        case .outline: return "lasso"
        case .marker: return "mappin"
        case .line: return "ruler"
        }
    }
}

/// One placed item, recorded in placement order so Undo can pop the matching
/// data and the matching AR visual together.
private enum SketchRecord {
    case marker(x: Double, z: Double, kindRaw: String)
    case line(x1: Double, z1: Double, x2: Double, z2: Double, distance: Double)
    case box(cx: Double, cz: Double, width: Double, length: Double, label: String, category: String)
}

/// Drives place/undo from SwiftUI buttons and mirrors reticle state back.
@MainActor final class ARSketchController: ObservableObject {
    fileprivate var placeAction: (() -> Void)?
    fileprivate var undoAction: (() -> Void)?
    fileprivate var closeAction: (() -> Void)?

    @Published var canPlace = false
    @Published var isSnapping = false
    @Published var status = "Move the phone slowly to find a surface."
    @Published var pendingCount = 0

    func place() { placeAction?() }
    func undo() { undoAction?() }
    func closeShape() { closeAction?() }
}

/// Full-screen Measure-app-style AR capture. Aim the centre reticle, tap (or
/// press Add) to drop markers, draw boxes (two opposite corners) and measure
/// lines. Works on any ARKit device (iOS 16+); LiDAR improves accuracy.
struct ARSketchCaptureView: View {
    let context: ARSketchContext
    var onCommitRoom: ((_ objects: [ObjectItem], _ annotations: [Annotation]) -> Void)? = nil
    var onCommitCrash: ((_ vehicles: [Vehicle], _ markers: [SceneMarker], _ measurements: [SceneMeasurement]) -> Void)? = nil
    let onCancel: () -> Void
    let onError: (String) -> Void

    @StateObject private var controller = ARSketchController()
    @State private var tool: ARSketchTool = .outline

    @State private var crashMarkerKind: SceneMarker.Kind = .hazard
    @State private var roomTypeIndex = 0

    @State private var records: [SketchRecord] = []

    private let accent = Color(red: 0.95, green: 0.42, blue: 0.16)

    /// Quick-pick object types for the room context (incl. things RoomPlan
    /// never detects: stairs, shoe racks, drying racks).
    private let roomTypes: [(label: String, category: String)] = [
        ("Object", "other"),
        ("Stairs", "stairs"),
        ("Shoe rack", "storage"),
        ("Drying rack", "storage"),
        ("Table", "table"),
        ("Cabinet", "storage"),
        ("Shelving", "storage"),
        ("Fridge", "refrigerator"),
        ("Stall / counter", "equipment"),
    ]

    private var tools: [ARSketchTool] {
        context == .room ? [.outline, .marker] : [.outline, .marker, .line]
    }

    private var outlineInProgress: Bool {
        tool == .outline && controller.pendingCount >= 2
    }

    var body: some View {
        ZStack {
            if ARWorldTrackingConfiguration.isSupported {
                ARSketchContainer(
                    tool: tool,
                    controller: controller,
                    onPlaceMarker: { x, z in appendMarker(x: x, z: z) },
                    onPlaceLine: { x1, z1, x2, z2, d in appendLine(x1: x1, z1: z1, x2: x2, z2: z2, distance: d) },
                    onPlaceBox: { cx, cz, w, l in appendBox(cx: cx, cz: cz, width: w, length: l) },
                    onUndoResult: { removedCommitted in if removedCommitted { popLastRecord() } },
                    onError: onError
                )
                .ignoresSafeArea()

                reticleOverlay
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

    // MARK: Overlays

    private var reticleColor: Color {
        if controller.isSnapping { return Color(red: 0.20, green: 0.82, blue: 0.46) }
        return controller.canPlace ? accent : Color.white.opacity(0.7)
    }

    private var reticleOverlay: some View {
        ZStack {
            Circle()
                .stroke(reticleColor, lineWidth: controller.isSnapping ? 3 : 2)
                .frame(width: controller.isSnapping ? 32 : 26, height: controller.isSnapping ? 32 : 26)
            Rectangle().fill(reticleColor).frame(width: 2, height: 12)
            Rectangle().fill(reticleColor).frame(width: 12, height: 2)
        }
        .allowsHitTesting(false)
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack {
                Text(context == .room ? "Room object sketch" : "Crash scene sketch")
                    .font(.system(size: 18, weight: .bold))
                    .foregroundStyle(.white)
                Spacer()
                Button { onCancel() } label: {
                    Image(systemName: "xmark")
                        .font(.system(size: 15, weight: .bold))
                        .foregroundStyle(.white)
                        .padding(10)
                        .background(Circle().fill(.white.opacity(0.18)))
                }
            }

            Text(controller.status)
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
            HStack(spacing: 12) {
                CountChip(systemImage: "lasso", text: "\(records.filter(isBox).count)", tint: Color(red: 0.30, green: 0.55, blue: 0.96))
                CountChip(systemImage: "mappin", text: "\(records.filter(isMarker).count)", tint: accent)
                if context == .crash {
                    CountChip(systemImage: "ruler", text: "\(records.filter(isLine).count)", tint: Color(red: 0.20, green: 0.62, blue: 0.44))
                }
            }

            Picker("Tool", selection: $tool) {
                ForEach(tools) { item in
                    Label(item.label, systemImage: item.systemImage).tag(item)
                }
            }
            .pickerStyle(.segmented)
            .colorScheme(.dark)

            typeSelector

            HStack(spacing: 12) {
                Button { controller.undo() } label: {
                    Label("Undo", systemImage: "arrow.uturn.backward")
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 13)
                        .background(RoundedRectangle(cornerRadius: 16).fill(.white.opacity(0.16)))
                        .foregroundStyle(.white)
                }
                .disabled(records.isEmpty && controller.pendingCount == 0)

                Button { controller.place() } label: {
                    Label(addButtonTitle, systemImage: "plus.circle.fill")
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 13)
                        .background(RoundedRectangle(cornerRadius: 16).fill(controller.canPlace ? accent : Color.gray.opacity(0.5)))
                        .foregroundStyle(.white)
                }
                .disabled(!controller.canPlace)

                if outlineInProgress {
                    Button { controller.closeShape() } label: {
                        Label("Close", systemImage: "checkmark.circle.fill")
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 13)
                            .background(RoundedRectangle(cornerRadius: 16).fill(Color(red: 0.20, green: 0.62, blue: 0.44)))
                            .foregroundStyle(.white)
                    }
                } else {
                    Button { finish() } label: {
                        Label("Done", systemImage: "checkmark")
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 13)
                            .background(RoundedRectangle(cornerRadius: 16).fill(Color(red: 0.20, green: 0.62, blue: 0.44)))
                            .foregroundStyle(.white)
                    }
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

    @ViewBuilder
    private var typeSelector: some View {
        if tool == .marker && context == .crash {
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 8) {
                    ForEach(SceneMarker.Kind.allCases) { kind in
                        chip(kind.label, systemImage: kind.systemImage, selected: crashMarkerKind == kind) {
                            crashMarkerKind = kind
                        }
                    }
                }
            }
        } else if tool == .outline && context == .room {
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 8) {
                    ForEach(Array(roomTypes.enumerated()), id: \.offset) { index, type in
                        chip(type.label, systemImage: "cube", selected: roomTypeIndex == index) {
                            roomTypeIndex = index
                        }
                    }
                }
            }
        } else if tool == .outline && context == .crash {
            Text("Trace a vehicle: tap each corner; the points connect into an outline. Snap back to the first corner or tap Close to finish.")
                .font(.caption)
                .foregroundStyle(.white.opacity(0.75))
                .frame(maxWidth: .infinity, alignment: .leading)
        }
    }

    private func chip(_ title: String, systemImage: String, selected: Bool, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Label(title, systemImage: systemImage)
                .font(.caption.weight(.semibold))
                .padding(.horizontal, 12)
                .padding(.vertical, 8)
                .background(Capsule().fill(selected ? accent : Color.white.opacity(0.16)))
                .foregroundStyle(.white)
        }
    }

    private var unsupportedOverlay: some View {
        VStack(spacing: 16) {
            Image(systemName: "arkit").font(.system(size: 44)).foregroundStyle(.white)
            Text("AR is not available on this device").font(.headline).foregroundStyle(.white)
            Text("You can still build the scene manually in the workspace.")
                .font(.subheadline).multilineTextAlignment(.center)
                .foregroundStyle(.white.opacity(0.8)).padding(.horizontal, 40)
            Button("Close") { onCancel() }
                .buttonStyle(.borderedProminent).tint(accent)
        }
    }

    private var addButtonTitle: String {
        switch tool {
        case .marker: return "Add"
        case .line: return controller.pendingCount == 1 ? "End point" : "Start point"
        case .outline: return controller.pendingCount == 0 ? "First corner" : "Add corner"
        }
    }

    // MARK: Record handling

    private func appendMarker(x: Double, z: Double) {
        records.append(.marker(x: x, z: z, kindRaw: crashMarkerKind.rawValue))
    }

    private func appendLine(x1: Double, z1: Double, x2: Double, z2: Double, distance: Double) {
        records.append(.line(x1: x1, z1: z1, x2: x2, z2: z2, distance: (distance * 100).rounded() / 100))
    }

    private func appendBox(cx: Double, cz: Double, width: Double, length: Double) {
        let label: String
        let category: String
        if context == .room {
            let type = roomTypes[roomTypeIndex]
            label = type.label
            category = type.category
        } else {
            label = "Vehicle"
            category = "vehicle"
        }
        records.append(.box(cx: cx, cz: cz, width: width, length: length, label: label, category: category))
    }

    private func popLastRecord() {
        guard !records.isEmpty else { return }
        records.removeLast()
    }

    private func isBox(_ r: SketchRecord) -> Bool { if case .box = r { return true }; return false }
    private func isMarker(_ r: SketchRecord) -> Bool { if case .marker = r { return true }; return false }
    private func isLine(_ r: SketchRecord) -> Bool { if case .line = r { return true }; return false }

    private func finish() {
        if context == .room {
            var objects: [ObjectItem] = []
            var annotations: [Annotation] = []
            for record in records {
                switch record {
                case let .box(cx, cz, w, l, label, category):
                    var object = ObjectItem()
                    object.label = "\(label) \(objects.count + 1)"
                    object.category = category
                    object.position = RoomScanPoint(x: round2(cx), y: round2(cz))
                    object.width = round2(w)
                    object.depth = round2(l)
                    objects.append(object)
                case let .marker(x, z, _):
                    var annotation = Annotation()
                    annotation.label = "Marker \(annotations.count + 1)"
                    annotation.position = RoomScanPoint(x: round2(x), y: round2(z))
                    annotations.append(annotation)
                case .line:
                    break
                }
            }
            onCommitRoom?(objects, annotations)
        } else {
            var vehicles: [Vehicle] = []
            var markers: [SceneMarker] = []
            var measurements: [SceneMeasurement] = []
            for record in records {
                switch record {
                case let .box(cx, cz, w, l, _, _):
                    var vehicle = Vehicle()
                    vehicle.label = "Vehicle \(vehicles.count + 1)"
                    vehicle.position = CrashScanPoint(x: round2(cx), y: round2(cz))
                    // w = footprint extent along world X, l = extent along world Z.
                    // Keep the longer side as "length" and use heading to orient
                    // it onto the correct axis so the top-down preview matches the
                    // traced footprint (0° = long axis along X, 90° = along Z).
                    if l >= w {
                        vehicle.length = round2(l)
                        vehicle.width = round2(w)
                        vehicle.headingDegrees = 90
                    } else {
                        vehicle.length = round2(w)
                        vehicle.width = round2(l)
                        vehicle.headingDegrees = 0
                    }
                    vehicles.append(vehicle)
                case let .marker(x, z, kindRaw):
                    var marker = SceneMarker()
                    marker.kind = SceneMarker.Kind(rawValue: kindRaw) ?? .hazard
                    marker.label = "\(marker.kind.label) \(markers.count + 1)"
                    marker.position = CrashScanPoint(x: round2(x), y: round2(z))
                    markers.append(marker)
                case let .line(x1, z1, x2, z2, distance):
                    var measurement = SceneMeasurement()
                    measurement.label = "Distance \(measurements.count + 1)"
                    measurement.start = CrashScanPoint(x: round2(x1), y: round2(z1))
                    measurement.end = CrashScanPoint(x: round2(x2), y: round2(z2))
                    measurement.distance = distance
                    measurements.append(measurement)
                }
            }
            onCommitCrash?(vehicles, markers, measurements)
        }
    }

    private func round2(_ value: Double) -> Double {
        (value * 100).rounded() / 100
    }
}

private struct CountChip: View {
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

/// SceneKit engine (ARSCNView). RealityKit's renderer aborted on-device, so we
/// render simple overlay geometry with SceneKit, which is far more forgiving.
/// Everything is axis-aligned or a line primitive — no rotation math — so no
/// NaN transform can ever reach the renderer.
struct ARSketchContainer: UIViewRepresentable {
    var tool: ARSketchTool
    let controller: ARSketchController
    let onPlaceMarker: (Double, Double) -> Void
    let onPlaceLine: (Double, Double, Double, Double, Double) -> Void
    let onPlaceBox: (Double, Double, Double, Double) -> Void
    let onUndoResult: (Bool) -> Void
    let onError: (String) -> Void

    func makeCoordinator() -> Coordinator {
        Coordinator(parent: self)
    }

    func makeUIView(context: Context) -> ARSCNView {
        let sceneView = ARSCNView(frame: .zero)
        let coordinator = context.coordinator
        coordinator.sceneView = sceneView

        sceneView.scene = SCNScene()
        // Use the SceneKit-view delegate (not session.delegate) — ARSCNView must
        // remain its own ARSession delegate to render. ARSCNViewDelegate still
        // forwards ARSessionObserver callbacks like didFailWithError.
        sceneView.delegate = coordinator
        sceneView.automaticallyUpdatesLighting = true

        let configuration = ARWorldTrackingConfiguration()
        configuration.planeDetection = [.horizontal, .vertical]
        sceneView.session.run(configuration, options: [.resetTracking, .removeExistingAnchors])

        let tap = UITapGestureRecognizer(target: coordinator, action: #selector(Coordinator.handleTap))
        sceneView.addGestureRecognizer(tap)

        coordinator.startDisplayLink()
        controller.placeAction = { [weak coordinator] in coordinator?.placeAtReticle() }
        controller.undoAction = { [weak coordinator] in coordinator?.removeLastOrCancelPending() }
        controller.closeAction = { [weak coordinator] in coordinator?.closeOutline() }

        return sceneView
    }

    func updateUIView(_ uiView: ARSCNView, context: Context) {
        // Keep the coordinator's reference to the current container fresh.
        // Placement/undo run from controller button actions, never here.
        context.coordinator.parent = self
    }

    static func dismantleUIView(_ uiView: ARSCNView, coordinator: Coordinator) {
        coordinator.stopDisplayLink()
        uiView.session.pause()
    }

    final class Coordinator: NSObject, ARSCNViewDelegate {
        var parent: ARSketchContainer
        weak var sceneView: ARSCNView?

        private var displayLink: CADisplayLink?
        private var currentReticleWorld: SIMD3<Float>?
        private var lastCanPlace = false
        private var lastSnapping = false

        private var placedNodes: [SCNNode] = []
        private var pendingPoints: [SIMD3<Float>] = []
        // The scene nodes added for each pending corner (dot + connecting line),
        // grouped per step so Undo can remove one corner at a time.
        private var pendingSteps: [[SCNNode]] = []
        private var pendingTool: ARSketchTool?

        /// Corners/points of every committed placement, kept 1:1 with
        /// `placedNodes`, so new placements can snap to existing corners and
        /// Undo can drop the geometry and its snap points together.
        private var vertexGroups: [[SIMD3<Float>]] = []
        private let snapThreshold: Float = 0.12

        init(parent: ARSketchContainer) {
            self.parent = parent
        }

        // MARK: Reticle

        func startDisplayLink() {
            let link = CADisplayLink(target: self, selector: #selector(updateReticle))
            link.preferredFramesPerSecond = 20
            link.add(to: .main, forMode: .common)
            displayLink = link
        }

        func stopDisplayLink() {
            displayLink?.invalidate()
            displayLink = nil
        }

        @objc func updateReticle() {
            guard let sceneView, sceneView.bounds.width > 0 else { return }
            let center = CGPoint(x: sceneView.bounds.midX, y: sceneView.bounds.midY)
            let raw = raycastWorld(from: center, in: sceneView)

            // Snap onto an existing corner when close, so shapes connect.
            var snapping = false
            if let raw, let snap = snapTarget(for: raw) {
                currentReticleWorld = snap
                snapping = true
            } else {
                currentReticleWorld = raw
            }

            let canPlace = raw != nil
            if canPlace != lastCanPlace {
                lastCanPlace = canPlace
                parent.controller.canPlace = canPlace
                parent.controller.status = canPlace
                    ? "Aim the reticle and tap Add to place."
                    : "Point at the ground or a surface to find a spot."
            }
            if snapping != lastSnapping {
                lastSnapping = snapping
                parent.controller.isSnapping = snapping
                if snapping {
                    parent.controller.status = "Snapping to an existing corner."
                }
            }
        }

        private func snapTarget(for world: SIMD3<Float>) -> SIMD3<Float>? {
            var best: SIMD3<Float>?
            var bestDistance = snapThreshold
            // Snap to committed corners AND the in-progress outline's own corners
            // (so you can close a loop). Distance is measured top-down (x,z) so a
            // small height difference between surfaces doesn't defeat the snap.
            let candidates = vertexGroups.flatMap { $0 } + pendingPoints
            for vertex in candidates where distance2D(vertex, world) < bestDistance {
                bestDistance = distance2D(vertex, world)
                best = vertex
            }
            return best
        }

        private func distance2D(_ a: SIMD3<Float>, _ b: SIMD3<Float>) -> Float {
            hypot(a.x - b.x, a.z - b.z)
        }

        // MARK: Placement

        @objc func handleTap() {
            placeAtReticle()
        }

        func placeAtReticle() {
            guard let sceneView else { return }
            guard let world = currentReticleWorld else {
                parent.controller.status = "No surface there yet — aim at the ground and try again."
                return
            }

            // If the tool changed while a multi-corner placement was in
            // progress, drop the stale corners before starting fresh.
            if let pendingTool, pendingTool != parent.tool, !pendingPoints.isEmpty {
                clearPendingVisuals()
            }

            switch parent.tool {
            case .marker:
                let node = sphereNode(radius: 0.05, color: UIColor(red: 0.95, green: 0.42, blue: 0.16, alpha: 1), at: world, lift: 0.05)
                sceneView.scene.rootNode.addChildNode(node)
                placedNodes.append(node)
                vertexGroups.append([world])
                parent.onPlaceMarker(Double(world.x), Double(world.z))

            case .line:
                addPendingCorner(world, color: .white)
                if pendingPoints.count == 2 {
                    commitLine()
                }

            case .outline:
                addOutlineVertex(world, in: sceneView)
            }
        }

        // MARK: Line tool (two points)

        private func addPendingCorner(_ world: SIMD3<Float>, color: UIColor) {
            guard let sceneView else { return }
            pendingTool = parent.tool
            pendingPoints.append(world)
            let node = sphereNode(radius: 0.035, color: color, at: world, lift: 0.02)
            sceneView.scene.rootNode.addChildNode(node)
            pendingSteps.append([node])
            parent.controller.pendingCount = pendingPoints.count
        }

        private func commitLine() {
            guard let sceneView else { return }
            let p0 = pendingPoints[0]
            let p1 = pendingPoints[1]
            clearPendingVisuals()

            let node = lineNode(from: p0, to: p1, color: UIColor(red: 0.20, green: 0.80, blue: 0.58, alpha: 1))
            sceneView.scene.rootNode.addChildNode(node)
            placedNodes.append(node)
            vertexGroups.append([p0, p1])

            let distance = Double(simd_distance(p0, p1))
            parent.controller.status = String(format: "Measured %.2f m.", distance)
            parent.onPlaceLine(Double(p0.x), Double(p0.z), Double(p1.x), Double(p1.z), distance)
        }

        // MARK: Outline tool (trace a shape, point by point)

        private func addOutlineVertex(_ world: SIMD3<Float>, in sceneView: ARSCNView) {
            // Tapping back onto the first corner closes the shape.
            if pendingPoints.count >= 3, let first = pendingPoints.first, distance2D(first, world) < snapThreshold {
                commitOutline()
                return
            }

            pendingTool = .outline
            let previous = pendingPoints.last
            pendingPoints.append(world)

            var stepNodes: [SCNNode] = []
            let dot = sphereNode(radius: 0.03, color: UIColor(red: 0.30, green: 0.55, blue: 0.96, alpha: 1), at: world, lift: 0.02)
            sceneView.scene.rootNode.addChildNode(dot)
            stepNodes.append(dot)

            if let previous {
                let segment = segmentNode(from: previous, to: world, color: UIColor(red: 0.30, green: 0.62, blue: 0.96, alpha: 1))
                sceneView.scene.rootNode.addChildNode(segment)
                stepNodes.append(segment)
                let length = Double(simd_distance(previous, world))
                parent.controller.status = String(format: "Segment %.2f m. Add corners, then Close or snap to the first corner.", length)
            } else {
                parent.controller.status = "First corner set. Tap each corner of the object."
            }
            pendingSteps.append(stepNodes)
            parent.controller.pendingCount = pendingPoints.count
        }

        func closeOutline() {
            commitOutline()
        }

        private func commitOutline() {
            guard let sceneView, pendingPoints.count >= 2 else {
                clearPendingVisuals()
                return
            }
            let points = pendingPoints
            clearPendingVisuals()

            // Draw the closed outline (corner spheres + edges) as one node.
            let node = SCNNode()
            for index in 0..<points.count {
                let a = points[index]
                let b = points[(index + 1) % points.count]
                node.addChildNode(segmentNode(from: a, to: b, color: UIColor(red: 0.30, green: 0.55, blue: 0.96, alpha: 1)))
                node.addChildNode(sphereNode(radius: 0.03, color: .white, at: a, lift: 0))
            }
            sceneView.scene.rootNode.addChildNode(node)
            placedNodes.append(node)
            vertexGroups.append(points)

            // The document stores a rectangular footprint, so commit the
            // outline's bounding box (center + width/length).
            let xs = points.map { $0.x }
            let zs = points.map { $0.z }
            let minX = xs.min() ?? 0, maxX = xs.max() ?? 0
            let minZ = zs.min() ?? 0, maxZ = zs.max() ?? 0
            let cx = (minX + maxX) / 2, cz = (minZ + maxZ) / 2
            let width = maxX - minX, length = maxZ - minZ

            parent.controller.status = String(format: "Shape closed: %.2f × %.2f m.", Double(width), Double(length))
            parent.onPlaceBox(Double(cx), Double(cz), Double(width), Double(length))
        }

        // MARK: Undo

        func removeLastOrCancelPending() {
            if !pendingPoints.isEmpty {
                // Remove just the last corner (and its connecting line), so a
                // mis-tap during a trace doesn't discard the whole outline.
                let step = pendingSteps.popLast() ?? []
                for node in step { node.removeFromParentNode() }
                pendingPoints.removeLast()
                if pendingPoints.isEmpty { pendingTool = nil }
                parent.controller.pendingCount = pendingPoints.count
                parent.controller.status = pendingPoints.isEmpty
                    ? "Cancelled the in-progress shape."
                    : "Removed the last corner."
                parent.onUndoResult(false)
            } else if let last = placedNodes.popLast() {
                last.removeFromParentNode()
                if !vertexGroups.isEmpty { vertexGroups.removeLast() }
                parent.controller.status = "Removed the last placement."
                parent.onUndoResult(true)
            } else {
                parent.onUndoResult(false)
            }
        }

        private func clearPendingVisuals() {
            for step in pendingSteps {
                for node in step { node.removeFromParentNode() }
            }
            pendingSteps.removeAll()
            pendingPoints.removeAll()
            pendingTool = nil
            parent.controller.pendingCount = 0
        }

        // MARK: Geometry helpers

        private func raycastWorld(from point: CGPoint, in sceneView: ARSCNView) -> SIMD3<Float>? {
            guard let query = sceneView.raycastQuery(from: point, allowing: .existingPlaneGeometry, alignment: .any)
                ?? sceneView.raycastQuery(from: point, allowing: .estimatedPlane, alignment: .any) else {
                return nil
            }
            guard let result = sceneView.session.raycast(query).first else { return nil }
            let t = result.worldTransform.columns.3
            return SIMD3<Float>(t.x, t.y, t.z)
        }

        private func sphereNode(radius: CGFloat, color: UIColor, at world: SIMD3<Float>, lift: Float) -> SCNNode {
            let sphere = SCNSphere(radius: radius)
            sphere.firstMaterial?.diffuse.contents = color
            sphere.firstMaterial?.lightingModel = .constant
            let node = SCNNode(geometry: sphere)
            node.simdPosition = SIMD3<Float>(world.x, world.y + lift, world.z)
            return node
        }

        /// A bare line primitive between two world-space vertices (no rotation).
        private func segmentNode(from start: SIMD3<Float>, to end: SIMD3<Float>, color: UIColor) -> SCNNode {
            let source = SCNGeometrySource(vertices: [SCNVector3(start), SCNVector3(end)])
            let element = SCNGeometryElement(indices: [Int32(0), Int32(1)], primitiveType: .line)
            let geometry = SCNGeometry(sources: [source], elements: [element])
            geometry.firstMaterial?.diffuse.contents = color
            geometry.firstMaterial?.lightingModel = .constant
            return SCNNode(geometry: geometry)
        }

        /// A measurement line: a segment plus white endpoint spheres.
        private func lineNode(from start: SIMD3<Float>, to end: SIMD3<Float>, color: UIColor) -> SCNNode {
            let container = SCNNode()
            container.addChildNode(segmentNode(from: start, to: end, color: color))
            for point in [start, end] {
                container.addChildNode(sphereNode(radius: 0.03, color: .white, at: point, lift: 0))
            }
            return container
        }

        // MARK: ARSessionObserver (via ARSCNViewDelegate)

        func session(_ session: ARSession, didFailWithError error: Error) {
            DispatchQueue.main.async { self.parent.onError(error.localizedDescription) }
        }
    }
}
