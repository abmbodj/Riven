// swift-tools-version: 6.0
import PackageDescription

// DO NOT MODIFY THIS FILE - managed by Capacitor CLI commands
let package = Package(
    name: "CapApp-SPM",
    platforms: [.iOS(.v16)],
    products: [
        .library(
            name: "CapApp-SPM",
            targets: ["CapApp-SPM"])
    ],
    dependencies: [
        .package(url: "https://github.com/ionic-team/capacitor-swift-pm.git", exact: "8.1.0"),
        .package(name: "CapacitorApp", path: "../../../node_modules/@capacitor/app"),
        .package(name: "CapacitorLocalNotifications", path: "../../../node_modules/@capacitor/local-notifications"),
        .package(name: "CapacitorPushNotifications", path: "../../../node_modules/@capacitor/push-notifications"),
        .package(name: "CapawesomeCapacitorAppleSignIn", path: "../../../node_modules/@capawesome/capacitor-apple-sign-in"),
        .package(name: "CapawesomeCapacitorGoogleSignIn", path: "../../../node_modules/@capawesome/capacitor-google-sign-in"),
        .package(name: "RevenuecatPurchasesCapacitor", path: "../../../node_modules/@revenuecat/purchases-capacitor"),
        .package(name: "CapacitorLiveActivity", path: "../../../node_modules/capacitor-live-activity"),
        .package(name: "CapacitorVoiceRecorder", path: "../../../node_modules/capacitor-voice-recorder")
    ],
    targets: [
        .target(
            name: "CapApp-SPM",
            dependencies: [
                .product(name: "Capacitor", package: "capacitor-swift-pm"),
                .product(name: "Cordova", package: "capacitor-swift-pm"),
                .product(name: "CapacitorApp", package: "CapacitorApp"),
                .product(name: "CapacitorLocalNotifications", package: "CapacitorLocalNotifications"),
                .product(name: "CapacitorPushNotifications", package: "CapacitorPushNotifications"),
                .product(name: "CapawesomeCapacitorAppleSignIn", package: "CapawesomeCapacitorAppleSignIn"),
                .product(name: "CapawesomeCapacitorGoogleSignIn", package: "CapawesomeCapacitorGoogleSignIn"),
                .product(name: "RevenuecatPurchasesCapacitor", package: "RevenuecatPurchasesCapacitor"),
                .product(name: "CapacitorLiveActivity", package: "CapacitorLiveActivity"),
                .product(name: "CapacitorVoiceRecorder", package: "CapacitorVoiceRecorder")
            ]
        )
    ]
)
