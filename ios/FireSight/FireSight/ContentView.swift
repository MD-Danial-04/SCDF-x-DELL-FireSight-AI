import SwiftUI

struct ContentView: View {
    @State private var isRoomScanWorkspacePresented = false
    @AppStorage("roomScanLauncherIsTrailing") private var roomScanLauncherIsTrailing = true
    @AppStorage("roomScanLauncherVerticalProgress") private var roomScanLauncherVerticalProgress = 1.0

    private let webAppURL = "https://scdf-x-dell-fire-sight-ai.vercel.app/"

    var body: some View {
        FireSightWebView(
            urlString: webAppURL,
            launcherIsTrailing: $roomScanLauncherIsTrailing,
            launcherVerticalProgress: $roomScanLauncherVerticalProgress
        ) {
            isRoomScanWorkspacePresented = true
        }
        .ignoresSafeArea()
        .fullScreenCover(isPresented: $isRoomScanWorkspacePresented) {
            RoomScanWorkspaceView()
        }
    }
}
