import type {
  PostHogCoreOptions,
  PostHogPersistedProperty,
  PostHogEventProperties,
  PostHogCaptureOptions,
  JsonType
} from '@posthog/core'
import type { PostHogCustomAppProperties, PostHogCustomStorage, PostHogSessionReplayConfig } from './types'
import type { PostHogAutocaptureOptions } from './autocapture'

export { PostHogPersistedProperty, PostHogAutocaptureOptions }

export type PostHogOptions = PostHogCoreOptions & {
  persistence?: 'memory' | 'file'
  customAppProperties?:
    | PostHogCustomAppProperties
    | ((properties: PostHogCustomAppProperties) => PostHogCustomAppProperties)
  customStorage?: PostHogCustomStorage
  captureAppLifecycleEvents?: boolean
  enableSessionReplay?: boolean
  sessionReplayConfig?: PostHogSessionReplayConfig
  enablePersistSessionIdAcrossRestart?: boolean
}

export interface CapacitorPosthogPlugin {
  ready(): Promise<void>
  capture(
    eventName: string,
    properties?: PostHogEventProperties,
    options?: PostHogCaptureOptions
  ): Promise<void>
  screen(
    name: string,
    properties?: PostHogEventProperties,
    options?: PostHogCaptureOptions
  ): Promise<void>
  identify(
    distinctId?: string,
    properties?: PostHogEventProperties,
    options?: PostHogCaptureOptions
  ): Promise<void>
  register(properties: PostHogEventProperties): Promise<void>
  unregister(property: string): Promise<void>
  reset(): Promise<void>
  flush(): Promise<void>
  optIn(): Promise<void>
  optOut(): Promise<void>
  isFeatureEnabled(key: string): Promise<boolean | undefined>
  getFeatureFlag(key: string): Promise<boolean | string | undefined>
  getFeatureFlagPayload(key: string): Promise<JsonType | undefined>
  reloadFeatureFlags(): Promise<void>
  reloadFeatureFlagsAsync(): Promise<Record<string, boolean | string> | undefined>
  group(
    groupType: string,
    groupKey: string,
    properties?: PostHogEventProperties
  ): Promise<void>
  alias(alias: string): Promise<void>
  getDistinctId(): Promise<string>
  getAnonymousId(): Promise<string>
  setPersonPropertiesForFlags(properties: Record<string, string>): Promise<void>
  resetPersonPropertiesForFlags(): Promise<void>
  setGroupPropertiesForFlags(properties: Record<string, Record<string, string>>): Promise<void>
  resetGroupPropertiesForFlags(): Promise<void>
  getSurveys(): Promise<any[]>
  resetSessionId(): Promise<void>
  getSessionId(): Promise<string>

  // Session Replay native methods
  startSessionReplay(options: {
    sessionId: string
    sdkOptions: Record<string, any>
    sdkReplayConfig: Record<string, any>
    decideReplayConfig: Record<string, any>
  }): Promise<void>
  startSessionReplaySession(options: { sessionId: string }): Promise<void>
  endSessionReplay(): Promise<void>
  isSessionReplayEnabled(): Promise<boolean>
  identifySessionReplay(options: { distinctId: string; anonymousId: string }): Promise<void>
}