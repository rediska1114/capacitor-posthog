import { WebPlugin } from '@capacitor/core'
import type { CapacitorPosthogPlugin } from './definitions'
import { PostHog } from './posthog-capacitor'
import type { PostHogOptions } from './definitions'
import type { PostHogEventProperties, PostHogCaptureOptions, JsonType } from '@posthog/core'

export class CapacitorPosthogWeb extends WebPlugin implements CapacitorPosthogPlugin {
  private posthogInstance: PostHog | null = null

  initialize(apiKey: string, options?: PostHogOptions): void {
    this.posthogInstance = new PostHog()
    void this.posthogInstance.setup(apiKey, options)
  }

  private ensureInitialized(): PostHog {
    if (!this.posthogInstance) {
      throw new Error('PostHog must be initialized with apiKey first')
    }
    return this.posthogInstance
  }

  async ready(): Promise<void> {
    return this.ensureInitialized().ready()
  }

  async capture(
    eventName: string,
    properties?: PostHogEventProperties,
    options?: PostHogCaptureOptions
  ): Promise<void> {
    return this.ensureInitialized().capture(eventName, properties, options)
  }

  async screen(
    name: string,
    properties?: PostHogEventProperties,
    options?: PostHogCaptureOptions
  ): Promise<void> {
    return this.ensureInitialized().screen(name, properties, options)
  }

  async identify(
    distinctId?: string,
    properties?: PostHogEventProperties,
    options?: PostHogCaptureOptions
  ): Promise<void> {
    this.ensureInitialized().identify(distinctId, properties, options)
  }

  async register(properties: PostHogEventProperties): Promise<void> {
    return this.ensureInitialized().register(properties)
  }

  async unregister(property: string): Promise<void> {
    return this.ensureInitialized().unregister(property)
  }

  async reset(): Promise<void> {
    this.ensureInitialized().reset()
  }

  async flush(): Promise<void> {
    await this.ensureInitialized().flush()
  }

  async optIn(): Promise<void> {
    return this.ensureInitialized().optIn()
  }

  async optOut(): Promise<void> {
    return this.ensureInitialized().optOut()
  }

  async isFeatureEnabled(key: string): Promise<boolean | undefined> {
    return this.ensureInitialized().isFeatureEnabled(key)
  }

  async getFeatureFlag(key: string): Promise<boolean | string | undefined> {
    return this.ensureInitialized().getFeatureFlag(key)
  }

  async getFeatureFlagPayload(key: string): Promise<JsonType | undefined> {
    return this.ensureInitialized().getFeatureFlagPayload(key)
  }

  async reloadFeatureFlags(): Promise<void> {
    this.ensureInitialized().reloadFeatureFlags()
  }

  async reloadFeatureFlagsAsync(): Promise<Record<string, boolean | string> | undefined> {
    return this.ensureInitialized().reloadFeatureFlagsAsync()
  }

  async group(
    groupType: string,
    groupKey: string,
    properties?: PostHogEventProperties
  ): Promise<void> {
    this.ensureInitialized().group(groupType, groupKey, properties)
  }

  async alias(alias: string): Promise<void> {
    this.ensureInitialized().alias(alias)
  }

  async getDistinctId(): Promise<string> {
    return this.ensureInitialized().getDistinctId()
  }

  async getAnonymousId(): Promise<string> {
    return this.ensureInitialized().getAnonymousId()
  }

  async setPersonPropertiesForFlags(properties: Record<string, string>): Promise<void> {
    this.ensureInitialized().setPersonPropertiesForFlags(properties)
  }

  async resetPersonPropertiesForFlags(): Promise<void> {
    this.ensureInitialized().resetPersonPropertiesForFlags()
  }

  async setGroupPropertiesForFlags(properties: Record<string, Record<string, string>>): Promise<void> {
    this.ensureInitialized().setGroupPropertiesForFlags(properties)
  }

  async resetGroupPropertiesForFlags(): Promise<void> {
    this.ensureInitialized().resetGroupPropertiesForFlags()
  }

  async getSurveys(): Promise<any[]> {
    return this.ensureInitialized().getSurveys()
  }

  async resetSessionId(): Promise<void> {
    this.ensureInitialized().resetSessionId()
  }

  async getSessionId(): Promise<string> {
    return this.ensureInitialized().getSessionId()
  }

  // Session Replay native methods (fallback to JavaScript implementation on web)
  async startSessionReplay(_options: {
    sessionId: string
    sdkOptions: Record<string, any>
    sdkReplayConfig: Record<string, any>
    decideReplayConfig: Record<string, any>
  }): Promise<void> {
    console.warn('Session Replay: Native session replay not available on web platform')
  }

  async startSessionReplaySession(_options: { sessionId: string }): Promise<void> {
    console.warn('Session Replay: Native session replay not available on web platform')
  }

  async endSessionReplay(): Promise<void> {
    console.warn('Session Replay: Native session replay not available on web platform')
  }

  async isSessionReplayEnabled(): Promise<boolean> {
    return false
  }

  async identifySessionReplay(_options: { distinctId: string; anonymousId: string }): Promise<void> {
    console.warn('Session Replay: Native session replay not available on web platform')
  }
}
