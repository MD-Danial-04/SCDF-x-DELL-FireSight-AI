import SwiftUI
import RoomPlan
import UniformTypeIdentifiers

private enum WorkspacePalette {
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

struct RoomScanWorkspaceView: View {
    @Environment(\.dismiss) private var dismiss

    @State private var draft: RoomScanDocument
    @State private var isScannerPresented = false
    @State private var isExporterPresented = false
    @State private var isImporterPresented = false
    @State private var isResetConfirmationPresented = false
    @State private var exportFile = RoomScanJSONFile(document: .blank())
    @State private var alertMessage: WorkspaceAlert?

    init() {
        _draft = State(initialValue: RoomScanDraftStore.load() ?? .blank())
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
                        roomMetaCard
                        wallsCard
                        openingsCard
                        objectsCard
                        annotationsCard
                        exportCard
                    }
                    .padding(.horizontal, 16)
                    .padding(.vertical, 20)
                }
                .scrollDismissesKeyboard(.interactively)
            }
            .navigationTitle("Room Scan")
            .navigationBarTitleDisplayMode(.inline)
            .toolbarBackground(.visible, for: .navigationBar)
            .toolbarBackground(.regularMaterial, for: .navigationBar)
            .toolbarColorScheme(.light, for: .navigationBar)
            .tint(WorkspacePalette.accent)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("Done") {
                        dismiss()
                    }
                }

                ToolbarItem(placement: .topBarTrailing) {
                    Menu {
                        Button("Import JSON") {
                            isImporterPresented = true
                        }

                        Button("Load sample draft") {
                            draft = .sample()
                        }

                        Button("Reset draft", role: .destructive) {
                            isResetConfirmationPresented = true
                        }
                    } label: {
                        Image(systemName: "ellipsis.circle")
                            .font(.title3)
                    }
                }
            }
            .fullScreenCover(isPresented: $isScannerPresented) {
                RoomScannerView(
                    onComplete: { capturedRoom in
                        var nextDraft = RoomScanDocument.from(capturedRoom: capturedRoom)
                        nextDraft.room.siteName = draft.room.siteName
                        nextDraft.room.level = draft.room.level
                        isScannerPresented = false
                        draft = nextDraft
                    },
                    onCancel: {
                        isScannerPresented = false
                    },
                    onError: { message in
                        isScannerPresented = false
                        alertMessage = WorkspaceAlert(title: "Scan failed", message: message)
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
                    alertMessage = WorkspaceAlert(
                        title: "JSON ready",
                        message: "Choose Save to Files and pick Downloads if you want the file in your iPhone Downloads folder."
                    )
                case let .failure(error):
                    alertMessage = WorkspaceAlert(
                        title: "Export failed",
                        message: error.localizedDescription
                    )
                }
            }
            .confirmationDialog(
                "Reset the current room scan draft?",
                isPresented: $isResetConfirmationPresented,
                titleVisibility: .visible
            ) {
                Button("Reset draft", role: .destructive) {
                    draft = .blank()
                    RoomScanDraftStore.delete()
                }
            } message: {
                Text("This clears the native review data and starts a fresh draft.")
            }
            .alert(item: $alertMessage) { item in
                Alert(
                    title: Text(item.title),
                    message: Text(item.message),
                    dismissButton: .default(Text("OK"))
                )
            }
            .onChange(of: draft) { newValue in
                RoomScanDraftStore.save(newValue)
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

                    Image(systemName: "viewfinder.circle.fill")
                        .font(.system(size: 24))
                        .foregroundStyle(.white)
                }

                VStack(alignment: .leading, spacing: 6) {
                    Text("Native scan and review")
                        .font(.system(.title3, design: .rounded, weight: .bold))
                        .foregroundStyle(WorkspacePalette.titleText)

                    Text("Capture with LiDAR, refine the floor plan, add field notes, then export JSON before returning to the web app for upload.")
                        .font(.subheadline)
                        .foregroundStyle(WorkspacePalette.secondaryText)
                }
            }

            HStack(spacing: 10) {
                StatPill(label: "\(draft.walls.count) walls", tint: Color(red: 0.87, green: 0.23, blue: 0.18))
                StatPill(label: "\(draft.openings.count) openings", tint: Color(red: 0.22, green: 0.47, blue: 0.87))
                StatPill(label: "\(draft.objects.count) objects", tint: Color(red: 0.20, green: 0.60, blue: 0.42))
                StatPill(label: "\(draft.annotations.count) notes", tint: Color(red: 0.70, green: 0.36, blue: 0.12))
            }

            VStack(spacing: 10) {
                Button {
                    if RoomCaptureSession.isSupported {
                        isScannerPresented = true
                    } else {
                        alertMessage = WorkspaceAlert(
                            title: "LiDAR not available",
                            message: "This device does not support RoomPlan. You can still create or edit a draft manually."
                        )
                    }
                } label: {
                    Label(RoomCaptureSession.isSupported ? "Start LiDAR scan" : "LiDAR not supported on this device", systemImage: "camera.metering.center.weighted")
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(PrimaryActionButtonStyle())

                HStack(spacing: 10) {
                    Button {
                        isImporterPresented = true
                    } label: {
                        Label("Import JSON", systemImage: "square.and.arrow.down")
                            .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(SecondaryActionButtonStyle())

                    Button {
                        draft = .sample()
                    } label: {
                        Label("Load sample", systemImage: "sparkles.rectangle.stack")
                            .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(SecondaryActionButtonStyle())
                }
            }
        }
        .padding(18)
            .background(
                RoundedRectangle(cornerRadius: 28, style: .continuous)
                    .fill(WorkspacePalette.cardFill)
                    .overlay(
                        RoundedRectangle(cornerRadius: 28, style: .continuous)
                            .stroke(WorkspacePalette.stroke.opacity(0.78), lineWidth: 1)
                    )
            )
    }

    private var previewCard: some View {
        EditorCard(
            title: "Floor plan preview",
            subtitle: draft.hasGeometry
                ? "Top-down view of the current native room scan draft."
                : "Run a scan or load a draft to see a live room layout preview."
        ) {
            if draft.hasGeometry {
                RoomScanPreview(document: draft)
                    .frame(height: 310)
                    .clipShape(RoundedRectangle(cornerRadius: 22, style: .continuous))
            } else {
                VStack(spacing: 12) {
                    Image(systemName: "square.dashed.inset.filled")
                        .font(.system(size: 34))
                        .foregroundStyle(Color(red: 0.87, green: 0.23, blue: 0.18))

                    Text("No scan loaded yet")
                        .font(.headline)

                    Text("Use Start LiDAR scan to capture a room, or build one manually below.")
                        .font(.subheadline)
                        .multilineTextAlignment(.center)
                        .foregroundStyle(WorkspacePalette.secondaryText)
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, 40)
                .background(
                    RoundedRectangle(cornerRadius: 22, style: .continuous)
                        .fill(WorkspacePalette.softFill)
                )
            }
        }
    }

    private var roomMetaCard: some View {
        EditorCard(
            title: "Room details",
            subtitle: "These fields travel with the scan JSON so the web side can identify the scene."
        ) {
            VStack(spacing: 12) {
                TextField("Room name", text: $draft.room.name)
                    .roomScanInputStyle()

                TextField("Site / building", text: $draft.room.siteName)
                    .roomScanInputStyle()

                TextField("Level / unit", text: $draft.room.level)
                    .roomScanInputStyle()

                MetricField(title: "Ceiling height (m)", value: $draft.room.ceilingHeight)

                NotesField(title: "Scene notes", text: $draft.room.notes)

                HStack {
                    Label("Source", systemImage: "link.badge.plus")
                        .font(.subheadline.weight(.semibold))

                    Spacer()

                    Text(draft.source.label)
                        .font(.subheadline)
                        .foregroundStyle(WorkspacePalette.secondaryText)
                }
            }
        }
    }

    private var wallsCard: some View {
        EditorCard(
            title: "Walls",
            subtitle: "Adjust endpoints and dimensions if the LiDAR capture needs cleanup."
        ) {
            VStack(spacing: 14) {
                if draft.walls.isEmpty {
                    EmptyCollectionMessage(message: "No walls yet. Add one manually or start a scan.")
                }

                ForEach($draft.walls) { wall in
                    EditableBlock(
                        title: wall.label.wrappedValue.isEmpty ? "Wall" : wall.label.wrappedValue,
                        tint: Color(red: 0.87, green: 0.23, blue: 0.18)
                    ) {
                        draft.walls.removeAll { $0.id == wall.id.wrappedValue }
                    } content: {
                        TextField("Label", text: wall.label)
                            .roomScanInputStyle()

                        PointEditor(title: "Start point", point: wall.start)
                        PointEditor(title: "End point", point: wall.end)
                        MetricField(title: "Height (m)", value: wall.height)
                        MetricField(title: "Thickness (m)", value: wall.thickness)
                        ConfidenceRow(confidence: wall.confidence)
                        NotesField(title: "Wall notes", text: wall.notes)
                    }
                }

                AddItemButton(title: "Add wall", systemImage: "plus") {
                    draft.walls.append(Wall())
                }
            }
        }
    }

    private var openingsCard: some View {
        EditorCard(
            title: "Openings",
            subtitle: "Doors, windows, and pass-through openings are editable before export."
        ) {
            VStack(spacing: 14) {
                if draft.openings.isEmpty {
                    EmptyCollectionMessage(message: "No openings added yet.")
                }

                ForEach($draft.openings) { opening in
                    EditableBlock(
                        title: opening.label.wrappedValue.isEmpty ? "Opening" : opening.label.wrappedValue,
                        tint: Color(red: 0.22, green: 0.47, blue: 0.87)
                    ) {
                        draft.openings.removeAll { $0.id == opening.id.wrappedValue }
                    } content: {
                        TextField("Label", text: opening.label)
                            .roomScanInputStyle()

                        Picker("Type", selection: opening.kind) {
                            ForEach(Opening.Kind.allCases, id: \.self) { kind in
                                Text(kind.label).tag(kind)
                            }
                        }
                        .pickerStyle(.segmented)
                        .tint(WorkspacePalette.accent)

                        PointEditor(title: "Position", point: opening.position)
                        MetricField(title: "Width (m)", value: opening.width)
                        MetricField(title: "Height (m)", value: opening.height)
                        MetricField(title: "Rotation (deg)", value: opening.rotationDegrees)
                        ConfidenceRow(confidence: opening.confidence)
                        NotesField(title: "Opening notes", text: opening.notes)
                    }
                }

                AddItemButton(title: "Add opening", systemImage: "plus") {
                    draft.openings.append(Opening())
                }
            }
        }
    }

    private var objectsCard: some View {
        EditorCard(
            title: "Objects",
            subtitle: "Furniture, equipment, and hazards can be renamed or adjusted before upload."
        ) {
            VStack(spacing: 14) {
                if draft.objects.isEmpty {
                    EmptyCollectionMessage(message: "No objects detected yet.")
                }

                ForEach($draft.objects) { object in
                    EditableBlock(
                        title: object.label.wrappedValue.isEmpty ? "Object" : object.label.wrappedValue,
                        tint: Color(red: 0.20, green: 0.60, blue: 0.42)
                    ) {
                        draft.objects.removeAll { $0.id == object.id.wrappedValue }
                    } content: {
                        TextField("Label", text: object.label)
                            .roomScanInputStyle()

                        TextField("Category", text: object.category)
                            .roomScanInputStyle()

                        PointEditor(title: "Position", point: object.position)
                        MetricField(title: "Width (m)", value: object.width)
                        MetricField(title: "Depth (m)", value: object.depth)
                        MetricField(title: "Height (m)", value: object.height)
                        MetricField(title: "Rotation (deg)", value: object.rotationDegrees)
                        ConfidenceRow(confidence: object.confidence)
                        HazardToggleRow(isOn: Binding(
                            get: { object.fireRelevant.wrappedValue ?? false },
                            set: { object.fireRelevant.wrappedValue = $0 }
                        ))
                        NotesField(title: "Object notes", text: object.notes)
                    }
                }

                AddItemButton(title: "Add object", systemImage: "plus") {
                    draft.objects.append(ObjectItem())
                }
            }
        }
    }

    private var annotationsCard: some View {
        EditorCard(
            title: "Annotations",
            subtitle: "Use markers for the suspected origin, hazards, or evidence callouts."
        ) {
            VStack(spacing: 14) {
                if draft.annotations.isEmpty {
                    EmptyCollectionMessage(message: "No annotations added yet.")
                }

                ForEach($draft.annotations) { annotation in
                    EditableBlock(
                        title: annotation.label.wrappedValue.isEmpty ? "Annotation" : annotation.label.wrappedValue,
                        tint: Color(red: 0.70, green: 0.36, blue: 0.12)
                    ) {
                        draft.annotations.removeAll { $0.id == annotation.id.wrappedValue }
                    } content: {
                        TextField("Label", text: annotation.label)
                            .roomScanInputStyle()

                        Picker("Severity", selection: annotation.severity) {
                            ForEach(Annotation.Severity.allCases, id: \.self) { severity in
                                Text(severity.label).tag(severity)
                            }
                        }
                        .pickerStyle(.segmented)
                        .tint(WorkspacePalette.accent)

                        PointEditor(title: "Position", point: annotation.position)
                        NotesField(title: "Annotation notes", text: annotation.notes)
                    }
                }

                AddItemButton(title: "Add annotation", systemImage: "plus") {
                    draft.annotations.append(Annotation())
                }
            }
        }
    }

    private var exportCard: some View {
        EditorCard(
            title: "Export JSON",
            subtitle: "Export the reviewed draft, then dismiss this screen and upload the JSON inside the embedded web app."
        ) {
            VStack(alignment: .leading, spacing: 12) {
                Text("On iPhone, the export sheet lets you choose Save to Files and pick Downloads if you want the JSON there.")
                    .font(.subheadline)
                    .foregroundStyle(WorkspacePalette.secondaryText)

                Button {
                    exportFile = RoomScanJSONFile(document: draft.preparedForPersistence())
                    isExporterPresented = true
                } label: {
                    Label("Export reviewed JSON", systemImage: "square.and.arrow.up")
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(PrimaryActionButtonStyle())

                Button {
                    dismiss()
                } label: {
                    Label("Return to web app", systemImage: "safari")
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(SecondaryActionButtonStyle())
            }
        }
    }

    private func handleImport(_ result: Result<URL, Error>) {
        switch result {
        case let .success(url):
            let isScoped = url.startAccessingSecurityScopedResource()
            defer {
                if isScoped {
                    url.stopAccessingSecurityScopedResource()
                }
            }

            do {
                let data = try Data(contentsOf: url)
                let decoder = JSONDecoder()
                decoder.dateDecodingStrategy = .iso8601
                var imported = try decoder.decode(RoomScanDocument.self, from: data)
                imported = imported.preparedForPersistence(source: .imported)
                draft = imported
            } catch {
                alertMessage = WorkspaceAlert(
                    title: "Import failed",
                    message: error.localizedDescription
                )
            }
        case let .failure(error):
            alertMessage = WorkspaceAlert(
                title: "Import failed",
                message: error.localizedDescription
            )
        }
    }
}

private struct WorkspaceAlert: Identifiable {
    let id = UUID()
    let title: String
    let message: String
}

private struct EditorCard<Content: View>: View {
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
                    .foregroundStyle(WorkspacePalette.titleText)

                Text(subtitle)
                    .font(.subheadline)
                    .foregroundStyle(WorkspacePalette.secondaryText)
            }

            content
        }
        .padding(18)
        .background(
            RoundedRectangle(cornerRadius: 26, style: .continuous)
                .fill(WorkspacePalette.cardFill)
                .overlay(
                    RoundedRectangle(cornerRadius: 26, style: .continuous)
                        .stroke(WorkspacePalette.stroke.opacity(0.9), lineWidth: 1)
                )
        )
    }
}

private struct EditableBlock<Content: View>: View {
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
                    Circle()
                        .fill(tint)
                        .frame(width: 10, height: 10)

                    Text(title)
                        .font(.headline)
                        .foregroundStyle(WorkspacePalette.titleText)
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
                .fill(WorkspacePalette.blockFill)
                .overlay(
                    RoundedRectangle(cornerRadius: 22, style: .continuous)
                        .stroke(WorkspacePalette.stroke.opacity(0.72), lineWidth: 1)
                )
        )
    }
}

private struct StatPill: View {
    let label: String
    let tint: Color

    var body: some View {
        Text(label)
            .font(.caption.weight(.semibold))
            .padding(.horizontal, 12)
            .padding(.vertical, 7)
            .background(
                Capsule()
                    .fill(tint.opacity(0.12))
            )
            .foregroundStyle(tint)
    }
}

private struct EmptyCollectionMessage: View {
    let message: String

    var body: some View {
        Text(message)
            .font(.subheadline)
            .foregroundStyle(WorkspacePalette.secondaryText)
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(14)
            .background(
                RoundedRectangle(cornerRadius: 18, style: .continuous)
                    .fill(WorkspacePalette.softFill)
            )
    }
}

private struct AddItemButton: View {
    let title: String
    let systemImage: String
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Label(title, systemImage: systemImage)
                .frame(maxWidth: .infinity)
        }
        .buttonStyle(SecondaryActionButtonStyle())
    }
}

private struct PointEditor: View {
    let title: String
    @Binding var point: RoomScanPoint

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(title)
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(WorkspacePalette.bodyText)

            HStack(spacing: 10) {
                MetricField(title: "X", value: $point.x)
                MetricField(title: "Y", value: $point.y)
            }
        }
    }
}

private struct MetricField: View {
    let title: String
    @Binding var value: Double

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(title)
                .font(.caption.weight(.semibold))
                .foregroundStyle(WorkspacePalette.subtleText)

            TextField(title, value: $value, format: .number.precision(.fractionLength(2)))
                .keyboardType(.decimalPad)
                .roomScanInputStyle()
        }
    }
}

private struct ConfidenceRow: View {
    @Binding var confidence: ScanConfidence?

    var body: some View {
        if let confidence {
            HStack(spacing: 8) {
                Image(systemName: iconName(for: confidence))
                    .foregroundStyle(tint(for: confidence))

                Text("Capture confidence")
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(WorkspacePalette.bodyText)

                Spacer()

                Text(confidence.label)
                    .font(.caption.weight(.bold))
                    .padding(.horizontal, 10)
                    .padding(.vertical, 5)
                    .background(Capsule().fill(tint(for: confidence).opacity(0.14)))
                    .foregroundStyle(tint(for: confidence))
            }
            .padding(.vertical, 2)
        }
    }

    private func tint(for confidence: ScanConfidence) -> Color {
        switch confidence {
        case .high:
            return Color(red: 0.18, green: 0.62, blue: 0.40)
        case .medium:
            return Color(red: 0.86, green: 0.58, blue: 0.13)
        case .low:
            return Color(red: 0.86, green: 0.23, blue: 0.18)
        }
    }

    private func iconName(for confidence: ScanConfidence) -> String {
        switch confidence {
        case .high:
            return "checkmark.seal.fill"
        case .medium:
            return "exclamationmark.triangle.fill"
        case .low:
            return "exclamationmark.octagon.fill"
        }
    }
}

private struct HazardToggleRow: View {
    @Binding var isOn: Bool

    var body: some View {
        Toggle(isOn: $isOn) {
            HStack(spacing: 8) {
                Image(systemName: "flame.fill")
                    .foregroundStyle(Color(red: 0.86, green: 0.23, blue: 0.18))

                VStack(alignment: .leading, spacing: 2) {
                    Text("Possible ignition source")
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(WorkspacePalette.bodyText)

                    Text("Flag heat or electrical sources for the fire-origin review.")
                        .font(.caption)
                        .foregroundStyle(WorkspacePalette.subtleText)
                }
            }
        }
        .tint(WorkspacePalette.accent)
    }
}

private struct NotesField: View {
    let title: String
    @Binding var text: String

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(title)
                .font(.caption.weight(.semibold))
                .foregroundStyle(WorkspacePalette.subtleText)

            TextField(title, text: $text, axis: .vertical)
                .lineLimit(2...5)
                .roomScanInputStyle()
        }
    }
}

private struct RoomScanInputModifier: ViewModifier {
    func body(content: Content) -> some View {
        content
            .foregroundStyle(WorkspacePalette.titleText)
            .padding(.horizontal, 14)
            .padding(.vertical, 12)
            .background(
                RoundedRectangle(cornerRadius: 16, style: .continuous)
                    .fill(Color.white)
                    .overlay(
                        RoundedRectangle(cornerRadius: 16, style: .continuous)
                            .stroke(WorkspacePalette.stroke, lineWidth: 1)
                    )
            )
            .tint(WorkspacePalette.accent)
    }
}

private extension View {
    func roomScanInputStyle() -> some View {
        modifier(RoomScanInputModifier())
    }
}

private struct PrimaryActionButtonStyle: ButtonStyle {
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

private struct SecondaryActionButtonStyle: ButtonStyle {
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

private struct RoomScanPreview: View {
    let document: RoomScanDocument

    var body: some View {
        GeometryReader { geometry in
            let projection = FloorPlanProjection(document: document, size: geometry.size)

            Canvas { context, size in
                drawGrid(context: context, size: size)

                for wall in document.walls {
                    var path = Path()
                    path.move(to: projection.project(wall.start))
                    path.addLine(to: projection.project(wall.end))
                    context.stroke(path, with: .color(.white), lineWidth: 6)
                    context.stroke(path, with: .color(Color.black.opacity(0.18)), lineWidth: 1)
                }

                for opening in document.openings {
                    var path = Path()
                    let line = projection.line(for: opening.position, length: opening.width, angleDegrees: opening.rotationDegrees)
                    path.move(to: line.start)
                    path.addLine(to: line.end)

                    let color: Color
                    switch opening.kind {
                    case .door:
                        color = Color(red: 0.94, green: 0.36, blue: 0.22)
                    case .window:
                        color = Color(red: 0.23, green: 0.53, blue: 0.96)
                    case .opening:
                        color = Color(red: 0.52, green: 0.43, blue: 0.98)
                    }

                    context.stroke(path, with: .color(color), lineWidth: 4)
                }

                for object in document.objects {
                    let path = projection.objectPath(for: object)
                    context.fill(path, with: .color(Color(red: 0.18, green: 0.62, blue: 0.44).opacity(0.28)))
                    context.stroke(path, with: .color(Color(red: 0.10, green: 0.45, blue: 0.32)), lineWidth: 2)
                }

                for annotation in document.annotations {
                    let center = projection.project(annotation.position)
                    let rect = CGRect(x: center.x - 7, y: center.y - 7, width: 14, height: 14)

                    let color: Color
                    switch annotation.severity {
                    case .info:
                        color = Color(red: 0.23, green: 0.53, blue: 0.96)
                    case .watch:
                        color = Color(red: 0.94, green: 0.66, blue: 0.16)
                    case .critical:
                        color = Color(red: 0.86, green: 0.17, blue: 0.16)
                    }

                    context.fill(Path(ellipseIn: rect), with: .color(color))
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
                    Text(document.room.name.isEmpty ? "Untitled scan" : document.room.name)
                        .font(.headline)
                        .foregroundStyle(.white)

                    Text("\(document.room.siteName.isEmpty ? "No site set" : document.room.siteName) • \(document.room.level.isEmpty ? "No level set" : document.room.level)")
                        .font(.caption)
                        .foregroundStyle(.white.opacity(0.72))
                }
                .padding(16)
            }
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

private struct FloorPlanProjection {
    let size: CGSize
    let minX: Double
    let maxX: Double
    let minY: Double
    let maxY: Double
    let scale: CGFloat
    let horizontalInset: CGFloat
    let verticalInset: CGFloat
    let padding: CGFloat = 28

    init(document: RoomScanDocument, size: CGSize) {
        self.size = size

        var points = document.walls.flatMap { [$0.start, $0.end] }
        points.append(contentsOf: document.openings.map(\.position))
        points.append(contentsOf: document.objects.map(\.position))
        points.append(contentsOf: document.annotations.map(\.position))

        if points.isEmpty {
            points = [
                .init(x: 0, y: 0),
                .init(x: 6, y: 4),
            ]
        }

        minX = points.map(\.x).min() ?? 0
        maxX = points.map(\.x).max() ?? 1
        minY = points.map(\.y).min() ?? 0
        maxY = points.map(\.y).max() ?? 1

        let width = max(maxX - minX, 1)
        let height = max(maxY - minY, 1)

        let availableWidth = max(size.width - (padding * 2), 1)
        let availableHeight = max(size.height - (padding * 2), 1)

        scale = min(availableWidth / CGFloat(width), availableHeight / CGFloat(height))
        horizontalInset = (size.width - (CGFloat(width) * scale)) / 2
        verticalInset = (size.height - (CGFloat(height) * scale)) / 2
    }

    func project(_ point: RoomScanPoint) -> CGPoint {
        CGPoint(
            x: horizontalInset + (CGFloat(point.x - minX) * scale),
            y: verticalInset + (CGFloat(point.y - minY) * scale)
        )
    }

    func line(for center: RoomScanPoint, length: Double, angleDegrees: Double) -> (start: CGPoint, end: CGPoint) {
        let angle = CGFloat(angleDegrees * .pi / 180)
        let dx = cos(angle) * CGFloat(length) * scale / 2
        let dy = sin(angle) * CGFloat(length) * scale / 2
        let projected = project(center)

        return (
            CGPoint(x: projected.x - dx, y: projected.y - dy),
            CGPoint(x: projected.x + dx, y: projected.y + dy)
        )
    }

    func objectPath(for object: ObjectItem) -> Path {
        let center = project(object.position)
        let halfWidth = CGFloat(object.width) * scale / 2
        let halfDepth = CGFloat(object.depth) * scale / 2
        let angle = CGFloat(object.rotationDegrees * .pi / 180)

        let corners = [
            CGPoint(x: -halfWidth, y: -halfDepth),
            CGPoint(x: halfWidth, y: -halfDepth),
            CGPoint(x: halfWidth, y: halfDepth),
            CGPoint(x: -halfWidth, y: halfDepth),
        ]
        .map { point in
            CGPoint(
                x: center.x + (point.x * cos(angle)) - (point.y * sin(angle)),
                y: center.y + (point.x * sin(angle)) + (point.y * cos(angle))
            )
        }

        var path = Path()
        guard let first = corners.first else {
            return path
        }

        path.move(to: first)
        corners.dropFirst().forEach { path.addLine(to: $0) }
        path.closeSubpath()
        return path
    }
}
