// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "CapacitorPosthog",
    platforms: [.iOS(.v14)],
    products: [
        .library(
            name: "CapacitorPosthog",
            targets: ["CapacitorPosthogPlugin"])
    ],
    dependencies: [
        .package(url: "https://github.com/ionic-team/capacitor-swift-pm.git", from: "7.0.0"),
        .package(url: "https://github.com/PostHog/posthog-ios.git", from: "3.31.0")
    ],
    targets: [
        .target(
            name: "CapacitorPosthogPlugin",
            dependencies: [
                .product(name: "Capacitor", package: "capacitor-swift-pm"),
                .product(name: "Cordova", package: "capacitor-swift-pm"),
                .product(name: "PostHog", package: "posthog-ios")
            ],
            path: "ios/Sources/CapacitorPosthogPlugin"),
        .testTarget(
            name: "CapacitorPosthogPluginTests",
            dependencies: ["CapacitorPosthogPlugin"],
            path: "ios/Tests/CapacitorPosthogPluginTests")
    ]
)
