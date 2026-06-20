import Foundation
import RoomPlan
import SwiftUI
import UniformTypeIdentifiers
import simd

nonisolated struct RoomScanDocument: Codable, Equatable {
    static let currentSchemaVersion = "firesight-room-scan/v1"

    nonisolated enum Source: String, Codable, CaseIterable {
        case manual
        case imported
        case roomPlanIOS = "roomplan-ios"

        var label: String {
            switch self {
            case .manual:
                return "Manual"
            case .imported:
                return "Imported"
            case .roomPlanIOS:
                return "RoomPlan on iPhone"
            }
        }
    }

    var schemaVersion: String = Self.currentSchemaVersion
    var source: Source
    var updatedAt: Date
    var room: RoomMeta
    var walls: [Wall]
    var openings: [Opening]
    var objects: [ObjectItem]
    var annotations: [Annotation]

    init(
        source: Source = .manual,
        updatedAt: Date = .now,
        room: RoomMeta = .init(),
        walls: [Wall] = [],
        openings: [Opening] = [],
        objects: [ObjectItem] = [],
        annotations: [Annotation] = []
    ) {
        self.source = source
        self.updatedAt = updatedAt
        self.room = room
        self.walls = walls
        self.openings = openings
        self.objects = objects
        self.annotations = annotations
    }
}

nonisolated struct RoomMeta: Codable, Equatable {
    var id: UUID = UUID()
    var name = "Untitled scan"
    var siteName = ""
    var level = ""
    var notes = ""
    var units = "m"
    var ceilingHeight: Double = 2.8
}

nonisolated struct RoomScanPoint: Codable, Equatable {
    var x: Double
    var y: Double
}

/// RoomPlan reports a per-element confidence. We surface it so investigators
/// know which captured geometry to verify by hand — important for scenes that
/// were scanned through poor lighting, soot, or residual smoke after knockdown.
nonisolated enum ScanConfidence: String, Codable, CaseIterable {
    case high
    case medium
    case low

    var label: String {
        rawValue.capitalized
    }
}

nonisolated struct Wall: Codable, Equatable, Identifiable {
    var id: UUID = UUID()
    var label = "Wall"
    var start = RoomScanPoint(x: 0, y: 0)
    var end = RoomScanPoint(x: 2.4, y: 0)
    var height: Double = 2.8
    var thickness: Double = 0.16
    // Optional so older JSON (and the web importer) decode unchanged.
    var confidence: ScanConfidence? = nil
    var notes = ""
}

nonisolated struct Opening: Codable, Equatable, Identifiable {
    nonisolated enum Kind: String, Codable, CaseIterable {
        case door
        case window
        case opening

        var label: String {
            rawValue.capitalized
        }
    }

    var id: UUID = UUID()
    var label = "Opening"
    var kind: Kind = .door
    var position = RoomScanPoint(x: 0, y: 0)
    var width: Double = 0.9
    var height: Double = 2.1
    var rotationDegrees: Double = 0
    var confidence: ScanConfidence? = nil
    var notes = ""
}

nonisolated struct ObjectItem: Codable, Equatable, Identifiable {
    var id: UUID = UUID()
    var label = "Object"
    var category = "other"
    var position = RoomScanPoint(x: 0, y: 0)
    var width: Double = 1.0
    var depth: Double = 0.8
    var height: Double = 1.0
    var rotationDegrees: Double = 0
    var confidence: ScanConfidence? = nil
    /// Flagged for RoomPlan categories that are common fire ignition sources
    /// (stove, oven, fireplace, electrical appliances). Optional for back-compat.
    var fireRelevant: Bool? = nil
    var notes = ""
}

nonisolated struct Annotation: Codable, Equatable, Identifiable {
    nonisolated enum Severity: String, Codable, CaseIterable {
        case info
        case watch
        case critical

        var label: String {
            rawValue.capitalized
        }
    }

    var id: UUID = UUID()
    var label = "Annotation"
    var severity: Severity = .info
    var position = RoomScanPoint(x: 0, y: 0)
    var notes = ""
}

nonisolated extension RoomScanDocument {
    static func blank() -> Self {
        .init()
    }

    static func sample() -> Self {
        .init(
            source: .manual,
            room: RoomMeta(
                name: "Pump room",
                siteName: "Training block",
                level: "Level 1",
                notes: "Starter layout for manual adjustment before export.",
                ceilingHeight: 3.0
            ),
            walls: [
                Wall(label: "North wall", start: .init(x: 0, y: 0), end: .init(x: 7.2, y: 0), height: 3.0, thickness: 0.16),
                Wall(label: "East wall", start: .init(x: 7.2, y: 0), end: .init(x: 7.2, y: 4.8), height: 3.0, thickness: 0.16),
                Wall(label: "South wall", start: .init(x: 7.2, y: 4.8), end: .init(x: 0, y: 4.8), height: 3.0, thickness: 0.16),
                Wall(label: "West wall", start: .init(x: 0, y: 4.8), end: .init(x: 0, y: 0), height: 3.0, thickness: 0.16),
            ],
            openings: [
                Opening(label: "Main door", kind: .door, position: .init(x: 1.2, y: 4.8), width: 1.0, height: 2.1, rotationDegrees: 0, notes: "Main entry"),
                Opening(label: "Vent window", kind: .window, position: .init(x: 7.2, y: 1.2), width: 0.8, height: 0.9, rotationDegrees: 90),
            ],
            objects: [
                ObjectItem(label: "Pump housing", category: "equipment", position: .init(x: 4.8, y: 2.2), width: 1.5, depth: 1.0, height: 1.6),
                ObjectItem(label: "Storage rack", category: "storage", position: .init(x: 1.4, y: 1.4), width: 0.9, depth: 0.5, height: 2.0, rotationDegrees: 90),
            ],
            annotations: [
                Annotation(label: "Origin of fire", severity: .critical, position: .init(x: 3.5, y: 2.7), notes: "Replace with confirmed finding after review."),
            ]
        )
    }

    static func from(capturedRoom: CapturedRoom) -> Self {
        let walls = capturedRoom.walls.enumerated().map { index, surface in
            makeWall(from: surface, index: index)
        }

        let doors = capturedRoom.doors.enumerated().map { index, surface in
            makeOpening(from: surface, kind: .door, index: index)
        }

        let windows = capturedRoom.windows.enumerated().map { index, surface in
            makeOpening(from: surface, kind: .window, index: index)
        }

        let passThroughs = capturedRoom.openings.enumerated().map { index, surface in
            makeOpening(from: surface, kind: .opening, index: index)
        }

        let objects = capturedRoom.objects.enumerated().map { index, object in
            makeObject(from: object, index: index)
        }

        let ceilingHeight = walls.map(\.height).max() ?? 2.8

        // Pre-seed annotations for likely ignition sources so the officer starts
        // the fire-origin review with the relevant appliances already flagged.
        let suggestedAnnotations = objects
            .filter { $0.fireRelevant == true }
            .map { object in
                Annotation(
                    label: "Possible ignition source: \(object.label)",
                    severity: .watch,
                    position: object.position,
                    notes: "Auto-flagged from RoomPlan object category. Confirm or clear during review."
                )
            }

        let lowConfidenceCount = walls.filter { $0.confidence == .low }.count
            + objects.filter { $0.confidence == .low }.count
        let captureNote = lowConfidenceCount > 0
            ? "Captured in the FireSight iOS scanner. \(lowConfidenceCount) element(s) came back low-confidence — verify highlighted geometry."
            : "Captured in the FireSight iOS scanner."

        return .init(
            source: .roomPlanIOS,
            room: RoomMeta(
                name: "Room scan \(capturedRoom.identifier.uuidString.prefix(6))",
                notes: captureNote,
                ceilingHeight: round(ceilingHeight)
            ),
            walls: walls,
            openings: doors + windows + passThroughs,
            objects: objects,
            annotations: suggestedAnnotations
        )
    }

    var hasGeometry: Bool {
        !walls.isEmpty || !openings.isEmpty || !objects.isEmpty || !annotations.isEmpty
    }

    var suggestedFilename: String {
        let base = room.name
            .lowercased()
            .replacingOccurrences(of: "[^a-z0-9]+", with: "-", options: .regularExpression)
            .trimmingCharacters(in: CharacterSet(charactersIn: "-"))
        let finalBase = base.isEmpty ? "room-scan" : base
        return "\(finalBase)-\(Self.filenameDateFormatter.string(from: updatedAt))"
    }

    func preparedForPersistence(source overrideSource: Source? = nil) -> Self {
        var copy = self
        copy.schemaVersion = Self.currentSchemaVersion
        copy.updatedAt = .now
        if let overrideSource {
            copy.source = overrideSource
        }
        return copy
    }

    private static let filenameDateFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyyMMdd-HHmmss"
        return formatter
    }()

    private static func makeWall(from surface: CapturedRoom.Surface, index: Int) -> Wall {
        let center = topDownPoint(from: surface.transform)
        let axis = horizontalAxis(from: surface.transform)
        let halfWidth = Double(surface.dimensions.x) / 2

        return Wall(
            label: "Wall \(index + 1)",
            start: RoomScanPoint(
                x: round(center.x - axis.dx * halfWidth),
                y: round(center.y - axis.dy * halfWidth)
            ),
            end: RoomScanPoint(
                x: round(center.x + axis.dx * halfWidth),
                y: round(center.y + axis.dy * halfWidth)
            ),
            height: round(Double(surface.dimensions.y)),
            thickness: round(max(Double(surface.dimensions.z), 0.05)),
            confidence: scanConfidence(from: surface.confidence)
        )
    }

    private static func makeOpening(from surface: CapturedRoom.Surface, kind: Opening.Kind, index: Int) -> Opening {
        let position = topDownPoint(from: surface.transform)

        return Opening(
            label: "\(kind.label) \(index + 1)",
            kind: kind,
            position: position,
            width: round(Double(surface.dimensions.x)),
            height: round(Double(surface.dimensions.y)),
            rotationDegrees: round(horizontalAngle(from: surface.transform)),
            confidence: scanConfidence(from: surface.confidence)
        )
    }

    private static func makeObject(from object: CapturedRoom.Object, index: Int) -> ObjectItem {
        let position = topDownPoint(from: object.transform)
        let classification = objectClassification(for: object.category)

        return ObjectItem(
            label: "\(classification.label) \(index + 1)",
            category: classification.category,
            position: position,
            width: round(Double(object.dimensions.x)),
            depth: round(Double(object.dimensions.z)),
            height: round(Double(object.dimensions.y)),
            rotationDegrees: round(horizontalAngle(from: object.transform)),
            confidence: scanConfidence(from: object.confidence),
            fireRelevant: classification.fireRelevant
        )
    }

    private static func scanConfidence(from confidence: CapturedRoom.Confidence) -> ScanConfidence {
        switch confidence {
        case .high:
            return .high
        case .medium:
            return .medium
        case .low:
            return .low
        @unknown default:
            return .medium
        }
    }

    /// Maps a RoomPlan object category to a readable label, a stable category
    /// slug, and whether it is a common fire ignition source. Driven off the
    /// `String(describing:)` value so it stays resilient across SDK changes
    /// (RoomPlan periodically adds new categories).
    private static func objectClassification(
        for category: CapturedRoom.Object.Category
    ) -> (label: String, category: String, fireRelevant: Bool) {
        let raw = String(describing: category)
            .components(separatedBy: "(").first?
            .trimmingCharacters(in: .whitespaces) ?? "object"

        // Heat / electrical sources investigators care about for fire origin.
        let ignitionSources: Set<String> = [
            "stove", "oven", "fireplace", "television",
            "washerDryer", "refrigerator", "dishwasher",
        ]

        let readable: String
        switch raw {
        case "washerDryer":
            readable = "Washer / dryer"
        case "television":
            readable = "Television"
        case "refrigerator":
            readable = "Refrigerator"
        case "stove":
            readable = "Stove"
        case "oven":
            readable = "Oven"
        case "fireplace":
            readable = "Fireplace"
        case "dishwasher":
            readable = "Dishwasher"
        case "storage":
            readable = "Storage"
        case "bed":
            readable = "Bed"
        case "sink":
            readable = "Sink"
        case "toilet":
            readable = "Toilet"
        case "bathtub":
            readable = "Bathtub"
        case "table":
            readable = "Table"
        case "sofa":
            readable = "Sofa"
        case "chair":
            readable = "Chair"
        case "stairs":
            readable = "Stairs"
        default:
            readable = raw.prefix(1).uppercased() + raw.dropFirst()
        }

        return (readable, raw, ignitionSources.contains(raw))
    }

    private static func topDownPoint(from transform: simd_float4x4) -> RoomScanPoint {
        let translation = transform.columns.3
        return RoomScanPoint(
            x: round(Double(translation.x)),
            y: round(Double(translation.z))
        )
    }

    private static func horizontalAxis(from transform: simd_float4x4) -> (dx: Double, dy: Double) {
        let axis = transform.columns.0
        let dx = Double(axis.x)
        let dy = Double(axis.z)
        let length = max(sqrt((dx * dx) + (dy * dy)), 0.0001)
        return (dx / length, dy / length)
    }

    private static func horizontalAngle(from transform: simd_float4x4) -> Double {
        let axis = horizontalAxis(from: transform)
        return atan2(axis.dy, axis.dx) * 180 / .pi
    }

    private static func round(_ value: Double, scale: Double = 1000) -> Double {
        (value * scale).rounded() / scale
    }
}

nonisolated enum RoomScanDraftStore {
    private static let fileName = "latest-room-scan.json"

    static func load() -> RoomScanDocument? {
        guard let url = storageURL else {
            return nil
        }

        do {
            let data = try Data(contentsOf: url)
            return try decoder.decode(RoomScanDocument.self, from: data)
        } catch {
            return nil
        }
    }

    static func save(_ document: RoomScanDocument) {
        guard let url = storageURL else {
            return
        }

        do {
            let payload = try encoder.encode(document.preparedForPersistence())
            try dataDirectoryIfNeeded()
            try payload.write(to: url, options: .atomic)
        } catch {
            print("Failed to save room scan draft:", error.localizedDescription)
        }
    }

    static func delete() {
        guard let url = storageURL else {
            return
        }

        try? FileManager.default.removeItem(at: url)
    }

    static func makeJSONData(from document: RoomScanDocument, overrideSource: RoomScanDocument.Source? = nil) throws -> Data {
        try encoder.encode(document.preparedForPersistence(source: overrideSource))
    }

    private static var storageURL: URL? {
        FileManager.default.urls(for: .documentDirectory, in: .userDomainMask).first?
            .appendingPathComponent(fileName)
    }

    private static func dataDirectoryIfNeeded() throws {
        guard let url = storageURL?.deletingLastPathComponent() else {
            return
        }

        try FileManager.default.createDirectory(at: url, withIntermediateDirectories: true, attributes: nil)
    }

    private static let encoder: JSONEncoder = {
        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601
        encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
        return encoder
    }()

    private static let decoder: JSONDecoder = {
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        return decoder
    }()
}

nonisolated struct RoomScanJSONFile: FileDocument {
    static var readableContentTypes: [UTType] {
        [.json]
    }

    var document: RoomScanDocument

    init(document: RoomScanDocument) {
        self.document = document
    }

    init(configuration: ReadConfiguration) throws {
        guard let data = configuration.file.regularFileContents else {
            throw CocoaError(.fileReadCorruptFile)
        }

        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        document = try decoder.decode(RoomScanDocument.self, from: data)
    }

    func fileWrapper(configuration: WriteConfiguration) throws -> FileWrapper {
        let data = try RoomScanDraftStore.makeJSONData(from: document)
        return .init(regularFileWithContents: data)
    }
}
