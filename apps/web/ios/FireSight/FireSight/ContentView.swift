import SwiftUI

struct ContentView: View {
    @State private var isScanChooserPresented = false
    @State private var isRoomScanWorkspacePresented = false
    @State private var isCrashScanWorkspacePresented = false
    @State private var bridge = WebAppBridge()
    @AppStorage("roomScanLauncherIsTrailing") private var roomScanLauncherIsTrailing = true
    @AppStorage("roomScanLauncherVerticalProgress") private var roomScanLauncherVerticalProgress = 1.0

    private let webAppURL = "https://scdf-x-dell-fire-sight-ai.vercel.app/"

    var body: some View {
        FireSightWebView(
            urlString: webAppURL,
            bridge: bridge,
            launcherIsTrailing: $roomScanLauncherIsTrailing,
            launcherVerticalProgress: $roomScanLauncherVerticalProgress
        ) {
            isScanChooserPresented = true
        }
        .ignoresSafeArea()
        .confirmationDialog("Capture for this report", isPresented: $isScanChooserPresented, titleVisibility: .visible) {
            Button("Room scan (floor plan)") {
                isRoomScanWorkspacePresented = true
            }
            Button("Vehicle & crash scene") {
                isCrashScanWorkspacePresented = true
            }
            Button("Cancel", role: .cancel) {}
        } message: {
            Text("Choose what you need to capture at the scene.")
        }
        .fullScreenCover(isPresented: $isRoomScanWorkspacePresented) {
            RoomScanWorkspaceView(onDeliver: deliverRoomScan)
        }
        .fullScreenCover(isPresented: $isCrashScanWorkspacePresented) {
            CrashScanWorkspaceView()
        }
    }

    /// Encode the reviewed scan and hand it to the embedded web app's scan
    /// library, then close the workspace.
    private func deliverRoomScan(_ document: RoomScanDocument) {
        if let data = try? RoomScanDraftStore.makeJSONData(from: document) {
            bridge.deliverRoomScan(jsonData: data)
        }
        isRoomScanWorkspacePresented = false
    }
}
