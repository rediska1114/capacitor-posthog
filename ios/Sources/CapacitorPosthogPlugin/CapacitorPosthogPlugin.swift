import Foundation
import Capacitor

/**
 * Please read the Capacitor iOS Plugin Development Guide
 * here: https://capacitorjs.com/docs/plugins/ios
 */
@objc(CapacitorPosthogPlugin)
public class CapacitorPosthogPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "CapacitorPosthogPlugin"
    public let jsName = "CapacitorPosthog"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "startSessionReplay", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "startSessionReplaySession", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "endSessionReplay", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "isSessionReplayEnabled", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "identifySessionReplay", returnType: CAPPluginReturnPromise)
    ]
    private let implementation = CapacitorPosthog()

    @objc func startSessionReplay(_ call: CAPPluginCall) {
        let sessionId = call.getString("sessionId") ?? ""
        let sdkOptions = call.getObject("sdkOptions") ?? [:]
        let sdkReplayConfig = call.getObject("sdkReplayConfig") ?? [:]
        let decideReplayConfig = call.getObject("decideReplayConfig") ?? [:]

        implementation.startSessionReplay(
            sessionId: sessionId,
            sdkOptions: sdkOptions,
            sdkReplayConfig: sdkReplayConfig,
            decideReplayConfig: decideReplayConfig
        ) { result in
            call.resolve()
        }
    }

    @objc func startSessionReplaySession(_ call: CAPPluginCall) {
        let sessionId = call.getString("sessionId") ?? ""

        implementation.startSessionReplaySession(sessionId: sessionId) { result in
            call.resolve()
        }
    }

    @objc func endSessionReplay(_ call: CAPPluginCall) {
        implementation.endSessionReplay { result in
            call.resolve()
        }
    }

    @objc func isSessionReplayEnabled(_ call: CAPPluginCall) {
        implementation.isSessionReplayEnabled { result in
            call.resolve(["value": result])
        }
    }

    @objc func identifySessionReplay(_ call: CAPPluginCall) {
        let distinctId = call.getString("distinctId") ?? ""
        let anonymousId = call.getString("anonymousId") ?? ""

        implementation.identifySessionReplay(
            distinctId: distinctId,
            anonymousId: anonymousId
        ) { result in
            call.resolve()
        }
    }
}