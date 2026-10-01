import Foundation
import SwiftUI
import UniformTypeIdentifiers

/// Structured capture of a road-traffic / vehicle-fire scene, produced by the
/// AR scene-sketch tool and refined in the crash workspace. Mirrors the layout
/// philosophy of `RoomScanDocument`: a flat, top-down (x, y in metres) sketch
/// that the fire-report pipeline can render, plus optional per-vehicle 3D model
/// references captured with Object Capture.
///
/// Schema is intentionally additive/optional so newer fields never break an
/// older importer.
nonisolated struct CrashScanDocument: Codable, Equatable {
    static let currentSchemaVersion = "firesight-crash-scan/v1"

    nonisolated enum Source: String, Codable, CaseIterable {
        case manual
        case imported
        case arSceneIOS = "ar-scene-ios"

        var label: String {
            switch self {
            case .manual:
                return "Manual"
            case .imported:
                return "Imported"
            case .arSceneIOS:
                return "AR scene on iPhone"
            }
        }
    }

    var schemaVersion: String = Self.currentSchemaVersion
    var source: Source
    var updatedAt: Date
    var scene: SceneMeta
    var vehicles: [Vehicle]
    var markers: [SceneMarker]
    var measurements: [SceneMeasurement]

    init(
        source: Source = .manual,
        updatedAt: Date = .now,
        scene: SceneMeta = .init(),
        vehicles: [Vehicle] = [],
        markers: [SceneMarker] = [],
        measurements: [SceneMeasurement] = []
    ) {
        self.source = source
        self.updatedAt = updatedAt
        self.scene = scene
        self.vehicles = vehicles
        self.markers = markers
        self.measurements = measurements
    }
}

nonisolated struct SceneMeta: Codable, Equatable {
    var id: UUID = UUID()
    var name = "Untitled crash scene"
    var incidentRef = ""
    var location = ""
    var roadName = ""
    var weather = ""
    var lighting = ""
    var notes = ""
    var units = "m"
}

nonisolated struct CrashScanPoint: Codable, Equatable {
    var x: Double
    var y: Double
}

nonisolated struct Vehicle: Codable, Equatable, Identifiable {
    nonisolated enum Kind: String, Codable, CaseIterable {
        case car
        case motorcycle
        case lorry
        case bus
        case van
        case other

        var label: String {
            switch self {
            case .car: return "Car"
            case .motorcycle: return "Motorcycle"
            case .lorry: return "Lorry"
            case .bus: return "Bus"
            case .van: return "Van"
            case .other: return "Other"
            }
        }
    }

    nonisolated enum DamageSeverity: String, Codable, CaseIterable {
        case none
        case minor
        case moderate
        case severe
        case totalLoss = "total-loss"

        var label: String {
            switch self {
            case .none: return "None"
            case .minor: return "Minor"
            case .moderate: return "Moderate"
            case .severe: return "Severe"
            case .totalLoss: return "Total loss"
            }
        }
    }

    var id: UUID = UUID()
    var label = "Vehicle"
    var kind: Kind = .car
    var makeModel = ""
    var plate = ""
    var color = ""
    var damage: DamageSeverity = .moderate
    var onFire = false
    var position = CrashScanPoint(x: 0, y: 0)
    var headingDegrees: Double = 0
    var length: Double = 4.5
    var width: Double = 1.8
    /// Filename of an optional Object Capture USDZ stored alongside the JSON.
    var modelFileName: String? = nil
    var notes = ""
}

nonisolated struct SceneMarker: Codable, Equatable, Identifiable {
    nonisolated enum Kind: String, Codable, CaseIterable, Identifiable {
        var id: String { rawValue }

        case impactPoint = "impact-point"
        case debris
        case fuelLeak = "fuel-leak"
        case fireOrigin = "fire-origin"
        case casualty
        case hazard
        case skidMark = "skid-mark"
        case other

        var label: String {
            switch self {
            case .impactPoint: return "Impact point"
            case .debris: return "Debris"
            case .fuelLeak: return "Fuel leak"
            case .fireOrigin: return "Fire origin"
            case .casualty: return "Casualty"
            case .hazard: return "Hazard"
            case .skidMark: return "Skid mark"
            case .other: return "Other"
            }
        }

        var systemImage: String {
            switch self {
            case .impactPoint: return "burst.fill"
            case .debris: return "circle.grid.cross.fill"
            case .fuelLeak: return "drop.fill"
            case .fireOrigin: return "flame.fill"
            case .casualty: return "cross.case.fill"
            case .hazard: return "exclamationmark.triangle.fill"
            case .skidMark: return "scribble.variable"
            case .other: return "mappin"
            }
        }
    }

    nonisolated enum Severity: String, Codable, CaseIterable {
        case info
        case watch
        case critical

        var label: String {
            rawValue.capitalized
        }
    }

    var id: UUID = UUID()
    var label = "Marker"
    var kind: Kind = .hazard
    var severity: Severity = .watch
    var position = CrashScanPoint(x: 0, y: 0)
    var notes = ""
}

nonisolated struct SceneMeasurement: Codable, Equatable, Identifiable {
    var id: UUID = UUID()
    var label = "Measurement"
    var start = CrashScanPoint(x: 0, y: 0)
    var end = CrashScanPoint(x: 1, y: 0)
    /// Straight-line distance in metres. Stored explicitly because the AR tool
    /// measures it in 3D, which can differ slightly from the top-down 2D span.
    var distance: Double = 1.0
    var notes = ""
}

nonisolated extension CrashScanDocument {
    static func blank() -> Self {
        .init()
    }

    static func sample() -> Self {
        .init(
            source: .manual,
            scene: SceneMeta(
                name: "Expressway collision",
                incidentRef: "RTA-2026-0148",
                location: "PIE towards Tuas, after Exit 27",
                roadName: "Pan Island Expressway",
                weather: "Light rain",
                lighting: "Night, street-lit",
                notes: "Two-vehicle collision, one vehicle alight on arrival."
            ),
            vehicles: [
                Vehicle(
                    label: "Vehicle A",
                    kind: .car,
                    makeModel: "Sedan",
                    plate: "SXX1234A",
                    color: "Silver",
                    damage: .severe,
                    onFire: true,
                    position: .init(x: 0, y: 0),
                    headingDegrees: 20,
                    length: 4.6,
                    width: 1.8,
                    notes: "Engine bay fire, knocked down on arrival."
                ),
                Vehicle(
                    label: "Vehicle B",
                    kind: .lorry,
                    makeModel: "Light goods",
                    plate: "GBX5678B",
                    color: "White",
                    damage: .moderate,
                    position: .init(x: 6.5, y: 1.5),
                    headingDegrees: 200,
                    length: 6.0,
                    width: 2.1
                ),
            ],
            markers: [
                SceneMarker(label: "Point of impact", kind: .impactPoint, severity: .critical, position: .init(x: 3.0, y: 0.6)),
                SceneMarker(label: "Fuel on road", kind: .fuelLeak, severity: .critical, position: .init(x: 1.4, y: -0.4)),
                SceneMarker(label: "Debris field", kind: .debris, severity: .watch, position: .init(x: 4.4, y: 2.0)),
            ],
            measurements: [
                SceneMeasurement(label: "Skid to impact", start: .init(x: -3.5, y: 0.2), end: .init(x: 3.0, y: 0.6), distance: 6.5),
            ]
        )
    }

    var hasContent: Bool {
        !vehicles.isEmpty || !markers.isEmpty || !measurements.isEmpty
    }

    var suggestedFilename: String {
        let base = scene.name
            .lowercased()
            .replacingOccurrences(of: "[^a-z0-9]+", with: "-", options: .regularExpression)
            .trimmingCharacters(in: CharacterSet(charactersIn: "-"))
        let finalBase = base.isEmpty ? "crash-scene" : base
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
}

nonisolated enum CrashScanDraftStore {
    private static let fileName = "latest-crash-scan.json"

    static func load() -> CrashScanDocument? {
        guard let url = storageURL else {
            return nil
        }

        do {
            let data = try Data(contentsOf: url)
            return try decoder.decode(CrashScanDocument.self, from: data)
        } catch {
            return nil
        }
    }

    static func save(_ document: CrashScanDocument) {
        guard let url = storageURL else {
            return
        }

        do {
            let payload = try encoder.encode(document.preparedForPersistence())
            try dataDirectoryIfNeeded()
            try payload.write(to: url, options: .atomic)
        } catch {
            print("Failed to save crash scan draft:", error.localizedDescription)
        }
    }

    static func delete() {
        guard let url = storageURL else {
            return
        }

        try? FileManager.default.removeItem(at: url)
    }

    static func makeJSONData(from document: CrashScanDocument, overrideSource: CrashScanDocument.Source? = nil) throws -> Data {
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

nonisolated struct CrashScanJSONFile: FileDocument {
    static var readableContentTypes: [UTType] {
        [.json]
    }

    var document: CrashScanDocument

    init(document: CrashScanDocument) {
        self.document = document
    }

    init(configuration: ReadConfiguration) throws {
        guard let data = configuration.file.regularFileContents else {
            throw CocoaError(.fileReadCorruptFile)
        }

        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        document = try decoder.decode(CrashScanDocument.self, from: data)
    }

    func fileWrapper(configuration: WriteConfiguration) throws -> FileWrapper {
        let data = try CrashScanDraftStore.makeJSONData(from: document)
        return .init(regularFileWithContents: data)
    }
}
