import SwiftUI

@main
struct MadeinMApp: App {
    @State private var service = MadeinMService()

    var body: some Scene {
        WindowGroup {
            AppRootView(service: service)
        }
    }
}
