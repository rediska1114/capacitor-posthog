import Foundation
import PostHog

private func hedgeLog(_ message: String) {
    print("[PostHog] \(message)")
}

@objc public class CapacitorPosthog: NSObject {
    private var config: PostHogConfig?

    public func startSessionReplay(
        sessionId: String,
        sdkOptions: [String: Any],
        sdkReplayConfig: [String: Any],
        decideReplayConfig: [String: Any],
        completion: @escaping (Void) -> Void
    ) {
        guard !sessionId.isEmpty else {
            hedgeLog("❌ Invalid sessionId provided: \(sessionId). Expected a non-empty string.")
            completion(())
            return
        }

        let apiKey = sdkOptions["apiKey"] as? String ?? ""
        let host = sdkOptions["host"] as? String ?? PostHogConfig.defaultHost
        let debug = sdkOptions["debug"] as? Bool ?? false

        hedgeLog("🚀 Starting session replay with sessionId: \(sessionId)")

        PostHogSessionManager.shared.setSessionId(sessionId)

        let config = PostHogConfig(apiKey: apiKey, host: host)
        config.sessionReplay = true
        config.captureApplicationLifecycleEvents = false
        config.captureScreenViews = false
        config.debug = debug
        config.sessionReplayConfig.screenshotMode = true

        let maskAllTextInputs = sdkReplayConfig["maskAllTextInputs"] as? Bool ?? true
        config.sessionReplayConfig.maskAllTextInputs = maskAllTextInputs

        let maskAllImages = sdkReplayConfig["maskAllImages"] as? Bool ?? true
        config.sessionReplayConfig.maskAllImages = maskAllImages

        let maskAllSandboxedViews = sdkReplayConfig["maskAllSandboxedViews"] as? Bool ?? true
        config.sessionReplayConfig.maskAllSandboxedViews = maskAllSandboxedViews

        let throttleDelayMs =
            (sdkReplayConfig["throttleDelayMs"] as? Int)
                ?? (sdkReplayConfig["iOSdebouncerDelayMs"] as? Int)
                ?? 1000

        let timeInterval: TimeInterval = Double(throttleDelayMs) / 1000.0
        config.sessionReplayConfig.throttleDelay = timeInterval

        let captureNetworkTelemetry = sdkReplayConfig["captureNetworkTelemetry"] as? Bool ?? true
        config.sessionReplayConfig.captureNetworkTelemetry = captureNetworkTelemetry

        let endpoint = decideReplayConfig["endpoint"] as? String ?? ""
        if !endpoint.isEmpty {
            config.snapshotEndpoint = endpoint
        }

        let distinctId = sdkOptions["distinctId"] as? String ?? ""
        let anonymousId = sdkOptions["anonymousId"] as? String ?? ""

        let sdkVersion = sdkOptions["sdkVersion"] as? String ?? ""

        let flushAt = sdkOptions["flushAt"] as? Int ?? 20
        config.flushAt = flushAt

        if !sdkVersion.isEmpty {
            postHogSdkName = "capacitor-posthog"
            postHogVersion = sdkVersion
        }

        PostHogSDK.shared.setup(config)

        self.config = config

        guard let storageManager = self.config?.storageManager else {
            hedgeLog("❌ Storage manager is not available in the config.")
            completion(())
            return
        }

        setIdentify(storageManager, distinctId: distinctId, anonymousId: anonymousId)

        PostHogSDK.shared.startSession()

        let isActive = PostHogSDK.shared.isSessionReplayActive()
        hedgeLog("🔍 Session replay active after start: \(isActive)")

        completion(())
    }

    public func startSessionReplaySession(sessionId: String, completion: @escaping (Void) -> Void) {
        guard !sessionId.isEmpty else {
            hedgeLog("❌ Invalid sessionId provided: \(sessionId). Expected a non-empty string.")
            completion(())
            return
        }

        PostHogSessionManager.shared.setSessionId(sessionId)
        PostHogSDK.shared.startSession()
        completion(())
    }

    public func isSessionReplayEnabled(completion: @escaping (Bool) -> Void) {
        let isEnabled = PostHogSDK.shared.isSessionReplayActive()
        completion(isEnabled)
    }

    public func endSessionReplay(completion: @escaping (Void) -> Void) {
        PostHogSDK.shared.endSession()
        completion(())
    }

    public func identifySessionReplay(
        distinctId: String,
        anonymousId: String,
        completion: @escaping (Void) -> Void
    ) {
        guard !distinctId.isEmpty || !anonymousId.isEmpty else {
            hedgeLog("Invalid distinctId: \(distinctId) or anonymousId: \(anonymousId) provided. Expected non-empty strings.")
            completion(())
            return
        }

        guard let storageManager = config?.storageManager else {
            hedgeLog("Storage manager is not available in the config.")
            completion(())
            return
        }

        setIdentify(storageManager, distinctId: distinctId, anonymousId: anonymousId)
        completion(())
    }

    private func setIdentify(
        _ storageManager: PostHogStorageManager, distinctId: String, anonymousId: String
    ) {
        if !anonymousId.isEmpty {
            storageManager.setAnonymousId(anonymousId)
        }
        if !distinctId.isEmpty {
            storageManager.setDistinctId(distinctId)
        }
    }
}