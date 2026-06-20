import SwiftUI

struct ContentView: View {
    @State private var isScanChooserPresented = false
    @State private var isRoomScanWorkspacePresented = false
    @State private var isCrashScanWorkspacePresented = false
    @AppStorage("roomScanLauncherIsTrailing") private var roomScanLauncherIsTrailing = true
    @AppStorage("roomScanLauncherVerticalProgress") private var roomScanLauncherVerticalProgress = 1.0

    private let webAppURL = "https://scdf-x-dell-fire-sight-ai.vercel.app/"

    var body: some View {
        FireSightWebView(
            urlString: webAppURL,
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
            RoomScanWorkspaceView()
        }
        .fullScreenCover(isPresented: $isCrashScanWorkspacePresented) {
            CrashScanWorkspaceView()
        }
    }
}
