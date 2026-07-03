// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "LlamaCpp",
    platforms: [.iOS(.v15)],
    products: [
        .library(
            name: "LlamaCppCapacitor",
            targets: ["LlamaCppPlugin"])
    ],
    dependencies: [
        .package(url: "https://github.com/ionic-team/capacitor-swift-pm.git", from: "8.0.0")
    ],
    targets: [
        .target(
            name: "LlamaCppPlugin",
            dependencies: [
                .product(name: "Capacitor", package: "capacitor-swift-pm"),
                .product(name: "Cordova", package: "capacitor-swift-pm")
            ],
            path: "ios/Sources/LlamaCppPlugin",
            // Note: This target uses a pre-built llama-cpp.framework
            // For building locally, use: ./build-variants.sh --variant minimal
            // See BUILD_GUIDE.md for complete build documentation
            publicHeadersPath: "."),

        .testTarget(
            name: "LlamaCppPluginTests",
            dependencies: ["LlamaCppPlugin"],
            path: "ios/Tests/LlamaCppPluginTests")
    ]
)