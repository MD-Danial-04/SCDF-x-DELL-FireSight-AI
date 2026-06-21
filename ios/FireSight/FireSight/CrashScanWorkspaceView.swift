import SwiftUI
import UniformTypeIdentifiers

private enum CrashPalette {
    static let titleText = Color(red: 0.12, green: 0.15, blue: 0.22)
    static let bodyText = Color(red: 0.22, green: 0.27, blue: 0.35)
    static let secondaryText = Color(red: 0.40, green: 0.45, blue: 0.54)
    static let subtleText = Color(red: 0.53, green: 0.58, blue: 0.67)
    static let cardFill = Color.white.opacity(0.93)
    static let blockFill = Color.white.opacity(0.97)
    static let softFill = Color(red: 0.96, green: 0.97, blue: 0.995)
    static let stroke = Color(red: 0.80, green: 0.84, blue: 0.91)
    static let accent = Color(red: 0.95, green: 0.42, blue: 0.16)
}

struct CrashScanWorkspaceView: View {
    @Environment(\.dismiss) private var dismiss

    @State private var draft: CrashScanDocument
    @State private var isCapturePresented = false
    @State private var isExporterPresented = false
    @State private var isImporterPresented = false
    @State private var isResetConfirmationPresented = false
    @State private var exportFile = CrashScanJSONFile(document: .blank())
    @State private var alertMessage: CrashAlert?
    @State private var vehicleBeingCaptured: Vehicle?

    init() {
        _draft = State(initialValue: CrashScanDraftStore.load() ?? .blank())
    }

    var body: some View {
        NavigationStack {
            ZStack {
                LinearGradient(
                    colors: [
                        Color(red: 0.96, green: 0.97, blue: 0.99),
                        Color(red: 0.92, green: 0.94, blue: 0.98),
                    ],
                    startPoint: .topLeading,
                    endPoint: .bottomTrailing
                )
                .ignoresSafeArea()

                ScrollView {
                    VStack(spacing: 18) {
                        heroCard
                        previewCard
                        sceneMetaCard
                        vehiclesCard
                        markersCard
                        measurementsCard
                        exportCard
                    }
                    .padding(.horizontal, 16)
                    .padding(.vertical, 20)
                }
                .scrollDismissesKeyboard(.interactively)
            }
            .navigationTitle("Crash Scene")
            .navigationBarTitleDisplayMode(.inline)
            .toolbarBackground(.visible, for: .navigationBar)
            .toolbarBackground(.regularMaterial, for: .navigationBar)
            .toolbarColorScheme(.light, for: .navigationBar)
            .tint(CrashPalette.accent)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("Done") { dismiss() }
                }

                ToolbarItem(placement: .topBarTrailing) {
                    Menu {
                        Button("Import JSON") { isImporterPresented = true }
                        Button("Load sample scene") { draft = .sample() }
                        Button("Reset draft", role: .destructive) {
                            isResetConfirmationPresented = true
                        }
                    } label: {
                        Image(systemName: "ellipsis.circle").font(.title3)
                    }
                }
            }
            .fullScreenCover(isPresented: $isCapturePresented) {
                ARSketchCaptureView(
                    context: .crash,
                    onCommitCrash: { vehicles, markers, measurements in
                        isCapturePresented = false
                        mergeCaptured(vehicles: vehicles, markers: markers, measurements: measurements)
                    },
                    onCancel: { isCapturePresented = false },
                    onError: { message in
                        isCapturePresented = false
                        alertMessage = CrashAlert(title: "Scene capture failed", message: message)
                    }
                )
            }
            .fullScreenCover(item: $vehicleBeingCaptured) { vehicle in
                VehicleCaptureView(
                    onComplete: { fileName in
                        vehicleBeingCaptured = nil
                        if let index = draft.vehicles.firstIndex(where: { $0.id == vehicle.id }) {
                            draft.vehicles[index].modelFileName = fileName
                        }
                        alertMessage = CrashAlert(
                            title: "3D model saved",
                            message: "The vehicle model is attached to \(vehicle.label) and exports with the scene files."
                        )
                    },
                    onCancel: { vehicleBeingCaptured = nil },
                    onError: { message in
                        vehicleBeingCaptured = nil
                        alertMessage = CrashAlert(title: "3D capture failed", message: message)
                    }
                )
            }
            .fileImporter(isPresented: $isImporterPresented, allowedContentTypes: [.json]) { result in
                handleImport(result)
            }
            .fileExporter(
                isPresented: $isExporterPresented,
                document: exportFile,
                contentType: .json,
                defaultFilename: draft.suggestedFilename
            ) { result in
                switch result {
                case .success:
                    alertMessage = CrashAlert(
                        title: "JSON ready",
                        message: "Choose Save to Files and pick Downloads to keep the scene JSON in your iPhone Downloads folder."
                    )
                case let .failure(error):
                    alertMessage = CrashAlert(title: "Export failed", message: error.localizedDescription)
                }
            }
            .confirmationDialog(
                "Reset the current crash scene draft?",
                isPresented: $isResetConfirmationPresented,
                titleVisibility: .visible
            ) {
                Button("Reset draft", role: .destructive) {
                    draft = .blank()
                    CrashScanDraftStore.delete()
                }
            } message: {
                Text("This clears the captured scene data and starts a fresh draft.")
            }
            .alert(item: $alertMessage) { item in
                Alert(title: Text(item.title), message: Text(item.message), dismissButton: .default(Text("OK")))
            }
            .onChange(of: draft) { newValue in
                CrashScanDraftStore.save(newValue)
            }
        }
    }

    private var heroCard: some View {
        VStack(alignment: .leading, spacing: 16) {
            HStack(alignment: .top, spacing: 14) {
                ZStack {
                    Circle()
                        .fill(
                            LinearGradient(
                                colors: [Color(red: 0.89, green: 0.18, blue: 0.15), Color(red: 0.99, green: 0.47, blue: 0.19)],
                                startPoint: .topLeading,
                                endPoint: .bottomTrailing
                            )
                        )
                        .frame(width: 52, height: 52)

                    Image(systemName: "car.side.rear.and.collision.and.car.side.front")
                        .font(.system(size: 20))
                        .foregroundStyle(.white)
                }

                VStack(alignment: .leading, spacing: 6) {
                    Text("Vehicle & crash scene")
                        .font(.system(.title3, design: .rounded, weight: .bold))
                        .foregroundStyle(CrashPalette.titleText)

                    Text("Sketch the scene in AR — vehicles, impact points, fuel leaks, debris — then refine details and optionally capture a 3D model of each vehicle before exporting.")
                        .font(.subheadline)
                        .foregroundStyle(CrashPalette.secondaryText)
                }
            }

            HStack(spacing: 10) {
                CrashStatPill(label: "\(draft.vehicles.count) vehicles", tint: Color(red: 0.22, green: 0.47, blue: 0.87))
                CrashStatPill(label: "\(draft.markers.count) markers", tint: Color(red: 0.95, green: 0.42, blue: 0.16))
                CrashStatPill(label: "\(draft.measurements.count) measures", tint: Color(red: 0.20, green: 0.60, blue: 0.42))
            }

            VStack(spacing: 10) {
                Button {
                    isCapturePresented = true
                } label: {
                    Label("Start AR scene sketch", systemImage: "arkit")
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(CrashPrimaryButtonStyle())

                HStack(spacing: 10) {
                    Button {
                        isImporterPresented = true
                    } label: {
                        Label("Import JSON", systemImage: "square.and.arrow.down")
                            .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(CrashSecondaryButtonStyle())

                    Button {
                        draft = .sample()
                    } label: {
                        Label("Load sample", systemImage: "sparkles.rectangle.stack")
                            .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(CrashSecondaryButtonStyle())
                }
            }
        }
        .padding(18)
        .background(
            RoundedRectangle(cornerRadius: 28, style: .continuous)
                .fill(CrashPalette.cardFill)
                .overlay(
                    RoundedRectangle(cornerRadius: 28, style: .continuous)
                        .stroke(CrashPalette.stroke.opacity(0.78), lineWidth: 1)
                )
        )
    }

    private var previewCard: some View {
        CrashCard(
            title: "Scene overview",
            subtitle: draft.hasContent
                ? "Top-down sketch of the captured crash scene."
                : "Run an AR sketch or load a draft to see the scene layout."
        ) {
            if draft.hasContent {
                CrashScenePreview(document: draft)
                    .frame(height: 310)
                    .clipShape(RoundedRectangle(cornerRadius: 22, style: .continuous))
            } else {
                VStack(spacing: 12) {
                    Image(systemName: "skew")
                        .font(.system(size: 34))
                        .foregroundStyle(Color(red: 0.87, green: 0.23, blue: 0.18))

                    Text("No scene captured yet")
                        .font(.headline)

                    Text("Use Start AR scene sketch to place vehicles and hazards, or build one manually below.")
                        .font(.subheadline)
                        .multilineTextAlignment(.center)
                        .foregroundStyle(CrashPalette.secondaryText)
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, 40)
                .background(RoundedRectangle(cornerRadius: 22, style: .continuous).fill(CrashPalette.softFill))
            }
        }
    }

    private var sceneMetaCard: some View {
        CrashCard(
            title: "Scene details",
            subtitle: "These fields travel with the scene JSON so the report can identify the incident."
        ) {
            VStack(spacing: 12) {
                TextField("Scene name", text: $draft.scene.name).crashInputStyle()
                TextField("Incident reference", text: $draft.scene.incidentRef).crashInputStyle()
                TextField("Location", text: $draft.scene.location).crashInputStyle()
                TextField("Road / expressway", text: $draft.scene.roadName).crashInputStyle()
                HStack(spacing: 10) {
                    TextField("Weather", text: $draft.scene.weather).crashInputStyle()
                    TextField("Lighting", text: $draft.scene.lighting).crashInputStyle()
                }
                CrashNotesField(title: "Scene notes", text: $draft.scene.notes)

                HStack {
                    Label("Source", systemImage: "link.badge.plus")
                        .font(.subheadline.weight(.semibold))
                    Spacer()
                    Text(draft.source.label)
                        .font(.subheadline)
                        .foregroundStyle(CrashPalette.secondaryText)
                }
            }
        }
    }

    private var vehiclesCard: some View {
        CrashCard(
            title: "Vehicles",
            subtitle: "Record each vehicle, its damage, and optionally a 3D model capture."
        ) {
            VStack(spacing: 14) {
                if draft.vehicles.isEmpty {
                    CrashEmptyMessage(message: "No vehicles yet. Add one manually or start an AR sketch.")
                }

                ForEach(draft.vehicles) { item in
                    let vehicle = itemBinding($draft.vehicles, id: item.id, fallback: Vehicle())
                    CrashBlock(
                        title: vehicle.label.wrappedValue.isEmpty ? "Vehicle" : vehicle.label.wrappedValue,
                        tint: Color(red: 0.22, green: 0.47, blue: 0.87)
                    ) {
                        draft.vehicles.removeAll { $0.id == item.id }
                    } content: {
                        TextField("Label", text: vehicle.label).crashInputStyle()

                        Picker("Type", selection: vehicle.kind) {
                            ForEach(Vehicle.Kind.allCases, id: \.self) { Text($0.label).tag($0) }
                        }
                        .pickerStyle(.menu)
                        .tint(CrashPalette.accent)

                        TextField("Make / model", text: vehicle.makeModel).crashInputStyle()
                        TextField("Plate number", text: vehicle.plate).crashInputStyle()
                        TextField("Colour", text: vehicle.color).crashInputStyle()

                        Picker("Damage", selection: vehicle.damage) {
                            ForEach(Vehicle.DamageSeverity.allCases, id: \.self) { Text($0.label).tag($0) }
                        }
                        .pickerStyle(.menu)
                        .tint(CrashPalette.accent)

                        Toggle(isOn: vehicle.onFire) {
                            Label("Vehicle on fire / fire-damaged", systemImage: "flame.fill")
                                .font(.subheadline.weight(.semibold))
                                .foregroundStyle(CrashPalette.bodyText)
                        }
                        .tint(CrashPalette.accent)

                        CrashPointEditor(title: "Position", point: vehicle.position)
                        CrashMetricField(title: "Heading (deg)", value: vehicle.headingDegrees)
                        HStack(spacing: 10) {
                            CrashMetricField(title: "Length (m)", value: vehicle.length)
                            CrashMetricField(title: "Width (m)", value: vehicle.width)
                        }

                        vehicleModelRow(vehicle)

                        CrashNotesField(title: "Vehicle notes", text: vehicle.notes)
                    }
                }

                CrashAddButton(title: "Add vehicle", systemImage: "plus") {
                    var vehicle = Vehicle()
                    vehicle.label = "Vehicle \(draft.vehicles.count + 1)"
                    draft.vehicles.append(vehicle)
                }
            }
        }
    }

    @ViewBuilder
    private func vehicleModelRow(_ vehicle: Binding<Vehicle>) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            if VehicleModelStore.modelExists(vehicle.modelFileName.wrappedValue) {
                Label("3D model attached", systemImage: "cube.fill")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(Color(red: 0.18, green: 0.62, blue: 0.40))
            }

            Button {
                vehicleBeingCaptured = vehicle.wrappedValue
            } label: {
                Label(
                    VehicleModelStore.modelExists(vehicle.modelFileName.wrappedValue) ? "Recapture 3D model" : "Capture 3D model",
                    systemImage: "cube.transparent"
                )
                .frame(maxWidth: .infinity)
            }
            .buttonStyle(CrashSecondaryButtonStyle())
        }
    }

    private var markersCard: some View {
        CrashCard(
            title: "Scene markers",
            subtitle: "Impact points, fuel leaks, debris, casualties, and other hazards."
        ) {
            VStack(spacing: 14) {
                if draft.markers.isEmpty {
                    CrashEmptyMessage(message: "No markers added yet.")
                }

                ForEach(draft.markers) { item in
                    let marker = itemBinding($draft.markers, id: item.id, fallback: SceneMarker())
                    CrashBlock(
                        title: marker.label.wrappedValue.isEmpty ? "Marker" : marker.label.wrappedValue,
                        tint: Color(red: 0.95, green: 0.42, blue: 0.16)
                    ) {
                        draft.markers.removeAll { $0.id == item.id }
                    } content: {
                        TextField("Label", text: marker.label).crashInputStyle()

                        Picker("Type", selection: marker.kind) {
                            ForEach(SceneMarker.Kind.allCases) { kind in
                                Label(kind.label, systemImage: kind.systemImage).tag(kind)
                            }
                        }
                        .pickerStyle(.menu)
                        .tint(CrashPalette.accent)

                        Picker("Severity", selection: marker.severity) {
                            ForEach(SceneMarker.Severity.allCases, id: \.self) { Text($0.label).tag($0) }
                        }
                        .pickerStyle(.segmented)
                        .tint(CrashPalette.accent)

                        CrashPointEditor(title: "Position", point: marker.position)
                        CrashNotesField(title: "Marker notes", text: marker.notes)
                    }
                }

                CrashAddButton(title: "Add marker", systemImage: "plus") {
                    draft.markers.append(SceneMarker())
                }
            }
        }
    }

    private var measurementsCard: some View {
        CrashCard(
            title: "Measurements",
            subtitle: "Distances between scene points, captured in AR or entered manually."
        ) {
            VStack(spacing: 14) {
                if draft.measurements.isEmpty {
                    CrashEmptyMessage(message: "No measurements yet.")
                }

                ForEach(draft.measurements) { item in
                    let measurement = itemBinding($draft.measurements, id: item.id, fallback: SceneMeasurement())
                    CrashBlock(
                        title: measurement.label.wrappedValue.isEmpty ? "Measurement" : measurement.label.wrappedValue,
                        tint: Color(red: 0.20, green: 0.60, blue: 0.42)
                    ) {
                        draft.measurements.removeAll { $0.id == item.id }
                    } content: {
                        TextField("Label", text: measurement.label).crashInputStyle()
                        CrashPointEditor(title: "Start", point: measurement.start)
                        CrashPointEditor(title: "End", point: measurement.end)
                        CrashMetricField(title: "Distance (m)", value: measurement.distance)
                        CrashNotesField(title: "Measurement notes", text: measurement.notes)
                    }
                }

                CrashAddButton(title: "Add measurement", systemImage: "plus") {
                    draft.measurements.append(SceneMeasurement())
                }
            }
        }
    }

    private var exportCard: some View {
        CrashCard(
            title: "Export",
            subtitle: "Export the scene JSON, then dismiss and attach it in the embedded web report."
        ) {
            VStack(alignment: .leading, spacing: 12) {
                Text("Captured 3D vehicle models are saved in the app's Files (On My iPhone › FireSight › models) and can be shared separately.")
                    .font(.subheadline)
                    .foregroundStyle(CrashPalette.secondaryText)

                Button {
                    exportFile = CrashScanJSONFile(document: draft.preparedForPersistence())
                    isExporterPresented = true
                } label: {
                    Label("Export scene JSON", systemImage: "square.and.arrow.up")
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(CrashPrimaryButtonStyle())

                Button {
                    dismiss()
                } label: {
                    Label("Return to web app", systemImage: "safari")
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(CrashSecondaryButtonStyle())
            }
        }
    }

    /// Safe element binding looked up by identity (not by position), so a
    /// destructive change like Reset can never make a row read a stale index.
    private func itemBinding<Element: Identifiable>(
        _ array: Binding<[Element]>,
        id: Element.ID,
        fallback: @autoclosure @escaping () -> Element
    ) -> Binding<Element> {
        Binding(
            get: { array.wrappedValue.first { $0.id == id } ?? fallback() },
            set: { newValue in
                if let index = array.wrappedValue.firstIndex(where: { $0.id == id }) {
                    array.wrappedValue[index] = newValue
                }
            }
        )
    }

    private func mergeCaptured(vehicles: [Vehicle], markers: [SceneMarker], measurements: [SceneMeasurement]) {
        var updated = draft
        if updated.source == .manual && !updated.hasContent {
            updated.source = .arSceneIOS
        }
        updated.vehicles.append(contentsOf: vehicles)
        updated.markers.append(contentsOf: markers)
        updated.measurements.append(contentsOf: measurements)
        draft = updated
    }

    private func handleImport(_ result: Result<URL, Error>) {
        switch result {
        case let .success(url):
            let isScoped = url.startAccessingSecurityScopedResource()
            defer {
                if isScoped { url.stopAccessingSecurityScopedResource() }
            }

            do {
                let data = try Data(contentsOf: url)
                let decoder = JSONDecoder()
                decoder.dateDecodingStrategy = .iso8601
                var imported = try decoder.decode(CrashScanDocument.self, from: data)
                imported = imported.preparedForPersistence(source: .imported)
                draft = imported
            } catch {
                alertMessage = CrashAlert(title: "Import failed", message: error.localizedDescription)
            }
        case let .failure(error):
            alertMessage = CrashAlert(title: "Import failed", message: error.localizedDescription)
        }
    }
}

private struct CrashAlert: Identifiable {
    let id = UUID()
    let title: String
    let message: String
}

// MARK: - Reusable cards & inputs

private struct CrashCard<Content: View>: View {
    let title: String
    let subtitle: String
    let content: Content

    init(title: String, subtitle: String, @ViewBuilder content: () -> Content) {
        self.title = title
        self.subtitle = subtitle
        self.content = content()
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            VStack(alignment: .leading, spacing: 4) {
                Text(title)
                    .font(.system(.headline, design: .rounded, weight: .bold))
                    .foregroundStyle(CrashPalette.titleText)
                Text(subtitle)
                    .font(.subheadline)
                    .foregroundStyle(CrashPalette.secondaryText)
            }
            content
        }
        .padding(18)
        .background(
            RoundedRectangle(cornerRadius: 26, style: .continuous)
                .fill(CrashPalette.cardFill)
                .overlay(
                    RoundedRectangle(cornerRadius: 26, style: .continuous)
                        .stroke(CrashPalette.stroke.opacity(0.9), lineWidth: 1)
                )
        )
    }
}

private struct CrashBlock<Content: View>: View {
    let title: String
    let tint: Color
    let onDelete: () -> Void
    let content: Content

    init(title: String, tint: Color, onDelete: @escaping () -> Void, @ViewBuilder content: () -> Content) {
        self.title = title
        self.tint = tint
        self.onDelete = onDelete
        self.content = content()
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                HStack(spacing: 8) {
                    Circle().fill(tint).frame(width: 10, height: 10)
                    Text(title).font(.headline).foregroundStyle(CrashPalette.titleText)
                }
                Spacer()
                Button(role: .destructive, action: onDelete) {
                    Image(systemName: "trash")
                }
                .buttonStyle(.borderless)
            }
            content
        }
        .padding(14)
        .background(
            RoundedRectangle(cornerRadius: 22, style: .continuous)
                .fill(CrashPalette.blockFill)
                .overlay(
                    RoundedRectangle(cornerRadius: 22, style: .continuous)
                        .stroke(CrashPalette.stroke.opacity(0.72), lineWidth: 1)
                )
        )
    }
}

private struct CrashStatPill: View {
    let label: String
    let tint: Color

    var body: some View {
        Text(label)
            .font(.caption.weight(.semibold))
            .padding(.horizontal, 12)
            .padding(.vertical, 7)
            .background(Capsule().fill(tint.opacity(0.12)))
            .foregroundStyle(tint)
    }
}

private struct CrashEmptyMessage: View {
    let message: String

    var body: some View {
        Text(message)
            .font(.subheadline)
            .foregroundStyle(CrashPalette.secondaryText)
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(14)
            .background(RoundedRectangle(cornerRadius: 18, style: .continuous).fill(CrashPalette.softFill))
    }
}

private struct CrashAddButton: View {
    let title: String
    let systemImage: String
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Label(title, systemImage: systemImage).frame(maxWidth: .infinity)
        }
        .buttonStyle(CrashSecondaryButtonStyle())
    }
}

private struct CrashPointEditor: View {
    let title: String
    @Binding var point: CrashScanPoint

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(title)
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(CrashPalette.bodyText)
            HStack(spacing: 10) {
                CrashMetricField(title: "X", value: $point.x)
                CrashMetricField(title: "Y", value: $point.y)
            }
        }
    }
}

private struct CrashMetricField: View {
    let title: String
    @Binding var value: Double

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(title)
                .font(.caption.weight(.semibold))
                .foregroundStyle(CrashPalette.subtleText)
            TextField(title, value: $value, format: .number.precision(.fractionLength(2)))
                .keyboardType(.numbersAndPunctuation)
                .crashInputStyle()
        }
    }
}

private struct CrashNotesField: View {
    let title: String
    @Binding var text: String

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(title)
                .font(.caption.weight(.semibold))
                .foregroundStyle(CrashPalette.subtleText)
            TextField(title, text: $text, axis: .vertical)
                .lineLimit(2...5)
                .crashInputStyle()
        }
    }
}

private struct CrashInputModifier: ViewModifier {
    func body(content: Content) -> some View {
        content
            .foregroundStyle(CrashPalette.titleText)
            .padding(.horizontal, 14)
            .padding(.vertical, 12)
            .background(
                RoundedRectangle(cornerRadius: 16, style: .continuous)
                    .fill(Color.white)
                    .overlay(
                        RoundedRectangle(cornerRadius: 16, style: .continuous)
                            .stroke(CrashPalette.stroke, lineWidth: 1)
                    )
            )
            .tint(CrashPalette.accent)
    }
}

private extension View {
    func crashInputStyle() -> some View {
        modifier(CrashInputModifier())
    }
}

private struct CrashPrimaryButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.headline)
            .padding(.vertical, 14)
            .background(
                RoundedRectangle(cornerRadius: 18, style: .continuous)
                    .fill(
                        LinearGradient(
                            colors: [Color(red: 0.87, green: 0.23, blue: 0.18), Color(red: 1.0, green: 0.46, blue: 0.14)],
                            startPoint: .leading,
                            endPoint: .trailing
                        )
                    )
            )
            .foregroundStyle(.white)
            .opacity(configuration.isPressed ? 0.86 : 1.0)
            .scaleEffect(configuration.isPressed ? 0.985 : 1.0)
    }
}

private struct CrashSecondaryButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.headline)
            .padding(.vertical, 14)
            .background(
                RoundedRectangle(cornerRadius: 18, style: .continuous)
                    .fill(Color.white.opacity(configuration.isPressed ? 0.70 : 0.84))
                    .overlay(
                        RoundedRectangle(cornerRadius: 18, style: .continuous)
                            .stroke(Color(red: 0.77, green: 0.81, blue: 0.89), lineWidth: 1)
                    )
            )
            .foregroundStyle(Color(red: 0.16, green: 0.22, blue: 0.31))
            .scaleEffect(configuration.isPressed ? 0.985 : 1.0)
    }
}

// MARK: - Top-down preview

private struct CrashScenePreview: View {
    let document: CrashScanDocument

    var body: some View {
        GeometryReader { geometry in
            let projection = CrashPlanProjection(document: document, size: geometry.size)

            Canvas { context, size in
                drawGrid(context: context, size: size)

                for measurement in document.measurements {
                    var path = Path()
                    path.move(to: projection.project(measurement.start))
                    path.addLine(to: projection.project(measurement.end))
                    context.stroke(
                        path,
                        with: .color(Color(red: 0.20, green: 0.80, blue: 0.58)),
                        style: StrokeStyle(lineWidth: 2, dash: [6, 4])
                    )
                }

                for vehicle in document.vehicles {
                    let path = projection.vehiclePath(for: vehicle)
                    let fill = vehicle.onFire
                        ? Color(red: 1.0, green: 0.42, blue: 0.16)
                        : Color(red: 0.30, green: 0.55, blue: 0.96)
                    context.fill(path, with: .color(fill.opacity(0.32)))
                    context.stroke(path, with: .color(fill), lineWidth: 2)
                }

                for marker in document.markers {
                    let center = projection.project(marker.position)
                    let rect = CGRect(x: center.x - 7, y: center.y - 7, width: 14, height: 14)
                    context.fill(Path(ellipseIn: rect), with: .color(color(for: marker)))
                    context.stroke(Path(ellipseIn: rect), with: .color(.white), lineWidth: 2)
                }
            }
            .background(
                LinearGradient(
                    colors: [Color(red: 0.13, green: 0.17, blue: 0.24), Color(red: 0.21, green: 0.25, blue: 0.35)],
                    startPoint: .topLeading,
                    endPoint: .bottomTrailing
                )
            )
            .overlay(alignment: .topLeading) {
                VStack(alignment: .leading, spacing: 4) {
                    Text(document.scene.name.isEmpty ? "Untitled scene" : document.scene.name)
                        .font(.headline)
                        .foregroundStyle(.white)
                    Text(document.scene.location.isEmpty ? "No location set" : document.scene.location)
                        .font(.caption)
                        .foregroundStyle(.white.opacity(0.72))
                }
                .padding(16)
            }
        }
    }

    private func color(for marker: SceneMarker) -> Color {
        switch marker.kind {
        case .impactPoint: return Color(red: 0.86, green: 0.17, blue: 0.16)
        case .fuelLeak: return Color(red: 0.40, green: 0.30, blue: 0.92)
        case .fireOrigin: return Color(red: 1.0, green: 0.44, blue: 0.13)
        case .casualty: return Color(red: 0.90, green: 0.10, blue: 0.35)
        case .hazard: return Color(red: 0.95, green: 0.66, blue: 0.16)
        case .debris: return Color(red: 0.62, green: 0.62, blue: 0.68)
        case .skidMark: return Color(red: 0.30, green: 0.30, blue: 0.34)
        case .other: return Color(red: 0.23, green: 0.53, blue: 0.96)
        }
    }

    private func drawGrid(context: GraphicsContext, size: CGSize) {
        var grid = Path()
        stride(from: 0.0, through: Double(size.width), by: 28).forEach { x in
            grid.move(to: CGPoint(x: x, y: 0))
            grid.addLine(to: CGPoint(x: x, y: Double(size.height)))
        }
        stride(from: 0.0, through: Double(size.height), by: 28).forEach { y in
            grid.move(to: CGPoint(x: 0, y: y))
            grid.addLine(to: CGPoint(x: Double(size.width), y: y))
        }
        context.stroke(grid, with: .color(.white.opacity(0.08)), lineWidth: 1)
    }
}

private struct CrashPlanProjection {
    let minX: Double
    let maxX: Double
    let minY: Double
    let maxY: Double
    let scale: CGFloat
    let horizontalInset: CGFloat
    let verticalInset: CGFloat
    private let padding: CGFloat = 30

    init(document: CrashScanDocument, size: CGSize) {
        var points = document.vehicles.map(\.position)
        points.append(contentsOf: document.markers.map(\.position))
        points.append(contentsOf: document.measurements.flatMap { [$0.start, $0.end] })

        if points.isEmpty {
            points = [.init(x: 0, y: 0), .init(x: 8, y: 6)]
        }

        // Pad bounds so vehicle footprints near the edge stay visible.
        let footprintPad = 2.5
        minX = (points.map(\.x).min() ?? 0) - footprintPad
        maxX = (points.map(\.x).max() ?? 1) + footprintPad
        minY = (points.map(\.y).min() ?? 0) - footprintPad
        maxY = (points.map(\.y).max() ?? 1) + footprintPad

        let width = max(maxX - minX, 1)
        let height = max(maxY - minY, 1)
        let availableWidth = max(size.width - (padding * 2), 1)
        let availableHeight = max(size.height - (padding * 2), 1)

        scale = min(availableWidth / CGFloat(width), availableHeight / CGFloat(height))
        horizontalInset = (size.width - (CGFloat(width) * scale)) / 2
        verticalInset = (size.height - (CGFloat(height) * scale)) / 2
    }

    func project(_ point: CrashScanPoint) -> CGPoint {
        CGPoint(
            x: horizontalInset + (CGFloat(point.x - minX) * scale),
            y: verticalInset + (CGFloat(point.y - minY) * scale)
        )
    }

    func vehiclePath(for vehicle: Vehicle) -> Path {
        let center = project(vehicle.position)
        let halfLength = CGFloat(vehicle.length) * scale / 2
        let halfWidth = CGFloat(vehicle.width) * scale / 2
        let angle = CGFloat(vehicle.headingDegrees * .pi / 180)

        let corners = [
            CGPoint(x: -halfLength, y: -halfWidth),
            CGPoint(x: halfLength, y: -halfWidth),
            CGPoint(x: halfLength, y: halfWidth),
            CGPoint(x: -halfLength, y: halfWidth),
        ]
        .map { point in
            CGPoint(
                x: center.x + (point.x * cos(angle)) - (point.y * sin(angle)),
                y: center.y + (point.x * sin(angle)) + (point.y * cos(angle))
            )
        }

        var path = Path()
        guard let first = corners.first else { return path }
        path.move(to: first)
        corners.dropFirst().forEach { path.addLine(to: $0) }
        path.closeSubpath()
        return path
    }
}
