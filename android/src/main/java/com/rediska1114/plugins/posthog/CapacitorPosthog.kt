package com.rediska1114.plugins.posthog

import android.util.Log
import com.getcapacitor.JSObject
import com.posthog.PostHog
import com.posthog.PostHogConfig
import com.posthog.android.PostHogAndroid
import com.posthog.android.PostHogAndroidConfig
import com.posthog.internal.PostHogPreferences
import com.posthog.internal.PostHogPreferences.Companion.ANONYMOUS_ID
import com.posthog.internal.PostHogPreferences.Companion.DISTINCT_ID
import com.posthog.internal.PostHogSessionManager
import java.util.UUID

class CapacitorPosthog {
    interface Callback {
        fun onComplete()
    }

    interface BooleanCallback {
        fun onResult(result: Boolean)
    }

    private var config: PostHogAndroidConfig? = null

    fun startSessionReplay(
        sessionId: String,
        sdkOptions: JSObject,
        sdkReplayConfig: JSObject,
        decideReplayConfig: JSObject,
        callback: Callback
    ) {
        try {
            if (sessionId.isEmpty()) {
                hedgeLog("Invalid sessionId provided: $sessionId. Expected a non-empty string.")
                callback.onComplete()
                return
            }

            val uuid = UUID.fromString(sessionId)
            PostHogSessionManager.setSessionId(uuid)

            val apiKey = sdkOptions.getString("apiKey", "")
            val host = sdkOptions.getString("host", PostHogConfig.DEFAULT_HOST)
            val debug = sdkOptions.getBool("debug", false)

            val maskAllTextInputs = sdkReplayConfig.getBool("maskAllTextInputs", true)
            val maskAllImages = sdkReplayConfig.getBool("maskAllImages", true)
            val captureLog = sdkReplayConfig.getBool("captureLog", true)

            val throttleDelayMs = if (sdkReplayConfig.has("throttleDelayMs")) {
                sdkReplayConfig.getInteger("throttleDelayMs")
            } else {
                sdkReplayConfig.getInteger("androidDebouncerDelayMs", 1000)
            }

            val endpoint = decideReplayConfig.getString("endpoint", "")

            val distinctId = sdkOptions.getString("distinctId", "")
            val anonymousId = sdkOptions.getString("anonymousId", "")
            val sdkVersion = sdkOptions.getString("sdkVersion", "")
            val flushAt = sdkOptions.getInteger("flushAt", 20)

            val config = PostHogAndroidConfig(apiKey, host).apply {
                this.debug = debug
                captureDeepLinks = false
                captureApplicationLifecycleEvents = false
                captureScreenViews = false
                this.flushAt = flushAt
                sessionReplay = true
                sessionReplayConfig.screenshot = true
                sessionReplayConfig.captureLogcat = captureLog
                sessionReplayConfig.throttleDelayMs = throttleDelayMs.toLong()
                sessionReplayConfig.maskAllImages = maskAllImages
                sessionReplayConfig.maskAllTextInputs = maskAllTextInputs

                if (endpoint.isNotEmpty()) {
                    snapshotEndpoint = endpoint
                }

                if (sdkVersion.isNotEmpty()) {
                    sdkName = "capacitor-posthog"
                    this.sdkVersion = sdkVersion
                }
            }

            PostHogAndroid.setup(null, config)
            this.config = config

            setIdentify(config.cachePreferences, distinctId, anonymousId)
        } catch (e: Throwable) {
            hedgeLog("Error in startSessionReplay: $e")
        } finally {
            callback.onComplete()
        }
    }

    fun startSessionReplaySession(sessionId: String, callback: Callback) {
        try {
            if (sessionId.isEmpty()) {
                hedgeLog("Invalid sessionId provided: $sessionId. Expected a non-empty string.")
                callback.onComplete()
                return
            }

            val uuid = UUID.fromString(sessionId)
            PostHogSessionManager.setSessionId(uuid)
            PostHog.startSession()
        } catch (e: Throwable) {
            hedgeLog("Error in startSessionReplaySession: $e")
        } finally {
            callback.onComplete()
        }
    }

    fun isSessionReplayEnabled(callback: BooleanCallback) {
        try {
            val isEnabled = PostHog.isSessionReplayActive()
            callback.onResult(isEnabled)
        } catch (e: Throwable) {
            hedgeLog("Error in isSessionReplayEnabled: $e")
            callback.onResult(false)
        }
    }

    fun endSessionReplay(callback: Callback) {
        try {
            PostHog.endSession()
        } catch (e: Throwable) {
            hedgeLog("Error in endSessionReplay: $e")
        } finally {
            callback.onComplete()
        }
    }

    fun identifySessionReplay(distinctId: String, anonymousId: String, callback: Callback) {
        try {
            if (distinctId.isEmpty() && anonymousId.isEmpty()) {
                hedgeLog("Invalid distinctId: $distinctId or anonymousId: $anonymousId provided. Expected non-empty strings.")
                callback.onComplete()
                return
            }

            val cachePreferences = PostHog.getConfig<PostHogConfig>()?.cachePreferences
            setIdentify(cachePreferences, distinctId, anonymousId)
        } catch (e: Throwable) {
            hedgeLog("Error in identifySessionReplay: $e")
        } finally {
            callback.onComplete()
        }
    }

    private fun setIdentify(
        cachePreferences: PostHogPreferences?,
        distinctId: String,
        anonymousId: String
    ) {
        cachePreferences?.let { preferences ->
            if (anonymousId.isNotEmpty()) {
                preferences.setValue(ANONYMOUS_ID, anonymousId)
            }
            if (distinctId.isNotEmpty()) {
                preferences.setValue(DISTINCT_ID, distinctId)
            }
        }
    }

    private fun hedgeLog(message: String) {
        Log.println(Log.INFO, POSTHOG_TAG, message)
    }

    companion object {
        const val POSTHOG_TAG = "PostHog"
    }
}