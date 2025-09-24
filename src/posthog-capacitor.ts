import {
  JsonType,
  PostHogCaptureOptions,
  PostHogCore,
  PostHogEventProperties,
  PostHogFetchOptions,
  PostHogFetchResponse,
  PostHogPersistedProperty,
  SurveyResponse,
  logFlushError,
  maybeAdd,
  FeatureFlagValue
} from '@posthog/core'
import { PostHogCapacitorStorage, PostHogCapacitorSyncMemoryStorage } from './storage'
import { PostHogOptions, CapacitorPosthogPlugin } from './definitions'
import { buildCapacitorStorage, getAppProperties } from './native-deps'
import { PostHogCustomAppProperties } from './types'
import { App } from '@capacitor/app'
import { Capacitor, registerPlugin } from '@capacitor/core'

import { initAutocapture, PostHogAutocaptureOptions } from './autocapture'

const CapacitorPosthog = registerPlugin<CapacitorPosthogPlugin>('CapacitorPosthog', {
  web: () => import('./web').then((m) => new m.CapacitorPosthogWeb()),
})

export { CapacitorPosthog }

export { PostHogPersistedProperty }

const VERSION = import.meta.env.PUBLIC_VERSION
const LIBRARY_NAME = import.meta.env.PUBLIC_NAME

class PostHogImpl extends PostHogCore {
  private _persistence: PostHogOptions['persistence']
  private _storage!: PostHogCapacitorStorage
  private _appProperties: PostHogCustomAppProperties = {}
  private _currentSessionId?: string | undefined
  private _enableSessionReplay?: boolean
  private _disableSurveys: boolean
  private _disableRemoteConfig: boolean
  private _autocaptureCleanup?: () => void
  private nativePlugin = CapacitorPosthog
  private __loaded: boolean = false

  constructor(apiKey: string, options?: PostHogOptions) {
    super(apiKey, options)
    this._isInitialized = false
    this._persistence = options?.persistence ?? 'file'
    this._disableSurveys = options?.disableSurveys ?? false
    this._disableRemoteConfig = options?.disableRemoteConfig ?? false

    this._init(apiKey, options)
  }

  private _init(_apiKey: string, options?: PostHogOptions): void {
    if (this.__loaded) {
      return
    }
    this.__loaded = true

    let storagePromise: Promise<void> | undefined

    if (this._persistence === 'file') {
      this._storage = new PostHogCapacitorStorage(options?.customStorage ?? buildCapacitorStorage())
      storagePromise = this._storage.preloadPromise
    } else {
      this._storage = new PostHogCapacitorSyncMemoryStorage()
    }

    if (storagePromise) {
      storagePromise.catch((error) => {
        console.error('PostHog storage initialization failed:', error)
      })
    }

    const initAfterStorage = async (): Promise<void> => {
      this._appProperties =
        typeof options?.customAppProperties === 'function'
          ? options.customAppProperties(await getAppProperties())
          : options?.customAppProperties || await getAppProperties()

      const enablePersistSessionIdAcrossRestart = options?.enablePersistSessionIdAcrossRestart
      if (!enablePersistSessionIdAcrossRestart) {
        this.setPersistedProperty(PostHogPersistedProperty.SessionId, null)
        this.setPersistedProperty(PostHogPersistedProperty.SessionLastTimestamp, null)
        this.setPersistedProperty(PostHogPersistedProperty.SessionStartTimestamp, null)
      }

      this.setupBootstrap(options)

      this._isInitialized = true

      if (this._disableRemoteConfig === false) {
        this.reloadRemoteConfigAsync()
      } else {
        this.logMsgIfDebug(() => console.info('PostHog Debug', `Remote config is disabled.`))
        if (options?.preloadFeatureFlags !== false) {
          this.logMsgIfDebug(() => console.info('PostHog Debug', `Feature flags will be preloaded from Flags API.`))
          this.reloadFeatureFlags()
        } else {
          this.logMsgIfDebug(() => console.info('PostHog Debug', `preloadFeatureFlags is disabled.`))
        }
      }

      if (options?.captureAppLifecycleEvents) {
        void this.captureAppLifecycleEvents()
      }

      void this.persistAppVersion()

      void this.startSessionReplay(options)
    }

    if (storagePromise) {
      this._initPromise = storagePromise.then(initAfterStorage)
    } else {
      this._initPromise = Promise.resolve().then(initAfterStorage)
    }
  }

  public async ready(): Promise<void> {
    await this._initPromise
  }

  getPersistedProperty<T>(key: PostHogPersistedProperty): T | undefined {
    return this._storage.getItem(key) as T | undefined
  }

  setPersistedProperty<T>(key: PostHogPersistedProperty, value: T | null): void {
    return value !== null ? this._storage.setItem(key, value) : this._storage.removeItem(key)
  }

  fetch(url: string, options: PostHogFetchOptions): Promise<PostHogFetchResponse> {
    return fetch(url, options)
  }

  getLibraryId(): string {
    return LIBRARY_NAME
  }

  getLibraryVersion(): string {
    return VERSION
  }

  getCustomUserAgent(): string {
    if (!Capacitor.isNativePlatform()) {
      return ''
    }
    return `${this.getLibraryId()}/${this.getLibraryVersion()}`
  }

  getCommonEventProperties(): PostHogEventProperties {
    const screenSize = {
      $screen_height: window.innerHeight,
      $screen_width: window.innerWidth,
    }

    const cleanedAppProperties: PostHogEventProperties = {}
    for (const [key, value] of Object.entries(this._appProperties)) {
      if (value !== null && value !== undefined) {
        cleanedAppProperties[key] = value
      }
    }

    return {
      ...super.getCommonEventProperties(),
      ...cleanedAppProperties,
      ...screenSize,
    }
  }

  register(properties: PostHogEventProperties): Promise<void> {
    return super.register(properties)
  }

  unregister(property: string): Promise<void> {
    return super.unregister(property)
  }

  reset(): void {
    super.reset()
  }

  flush(): Promise<void> {
    return super.flush()
  }

  optIn(): Promise<void> {
    return super.optIn()
  }

  optOut(): Promise<void> {
    return super.optOut()
  }

  isFeatureEnabled(key: string): boolean | undefined {
    return super.isFeatureEnabled(key)
  }

  getFeatureFlag(key: string): boolean | string | undefined {
    return super.getFeatureFlag(key)
  }

  getFeatureFlagPayload(key: string): JsonType | undefined {
    return super.getFeatureFlagPayload(key)
  }

  reloadFeatureFlags(): void {
    super.reloadFeatureFlags()
  }

  reloadFeatureFlagsAsync(): Promise<Record<string, boolean | string> | undefined> {
    return super.reloadFeatureFlagsAsync()
  }

  group(groupType: string, groupKey: string, properties?: PostHogEventProperties): void {
    super.group(groupType, groupKey, properties)
  }

  alias(alias: string): void {
    super.alias(alias)
  }

  getDistinctId(): string {
    return super.getDistinctId()
  }

  getAnonymousId(): string {
    return super.getAnonymousId()
  }

  setPersonPropertiesForFlags(properties: Record<string, string>): void {
    super.setPersonPropertiesForFlags(properties)
  }

  resetPersonPropertiesForFlags(): void {
    super.resetPersonPropertiesForFlags()
  }

  setGroupPropertiesForFlags(properties: Record<string, Record<string, string>>): void {
    super.setGroupPropertiesForFlags(properties)
  }

  resetGroupPropertiesForFlags(): void {
    super.resetGroupPropertiesForFlags()
  }

  async screen(name: string, properties?: PostHogEventProperties, options?: PostHogCaptureOptions): Promise<void> {
    await this._initPromise
    this.registerForSession({
      $screen_name: name,
    })

    return this.capture(
      '$screen',
      {
        ...properties,
        $screen_name: name,
      },
      options
    )
  }

  getSessionId(): string {
    const sessionId = super.getSessionId()

    if (!this._isEnableSessionReplay()) {
      return sessionId
    }

    // Only rotate if there is a new sessionId and it is different from the current one
    if (sessionId.length > 0 && this._currentSessionId && sessionId !== this._currentSessionId) {
      if (Capacitor.isNativePlatform() && this.nativePlugin) {
        try {
          void this._resetNativeSessionId(sessionId)
          this.logMsgIfDebug(() =>
            console.info('PostHog Debug', `sessionId rotated from ${this._currentSessionId} to ${sessionId}.`)
          )
        } catch (e) {
          this.logMsgIfDebug(() => console.error('PostHog Debug', `Failed to rotate sessionId: ${e}.`))
        }
      }
      this._currentSessionId = sessionId
    } else {
      this.logMsgIfDebug(() =>
        console.log(
          'PostHog Debug',
          `sessionId not rotated, sessionId ${sessionId} and currentSessionId ${this._currentSessionId}.`
        )
      )
    }

    return sessionId
  }

  resetSessionId(): void {
    super.resetSessionId()
    if (this._isEnableSessionReplay() && Capacitor.isNativePlatform() && this.nativePlugin) {
      try {
        void this.nativePlugin.endSessionReplay()
        this.logMsgIfDebug(() => console.info('PostHog Debug', `Session replay ended.`))
      } catch (e) {
        this.logMsgIfDebug(() => console.error('PostHog Debug', `Session replay failed to end: ${e}.`))
      }
    }
  }

  identify(distinctId?: string, properties?: PostHogEventProperties, options?: PostHogCaptureOptions): void {
    const previousDistinctId = this.getDistinctId()
    super.identify(distinctId, properties, options)

    if (this._isEnableSessionReplay() && Capacitor.isNativePlatform() && this.nativePlugin) {
      try {
        distinctId = distinctId || previousDistinctId
        const anonymousId = this.getAnonymousId()
        void this.nativePlugin.identifySessionReplay({
          distinctId: String(distinctId),
          anonymousId: String(anonymousId)
        })
        this.logMsgIfDebug(() =>
          console.info(
            'PostHog Debug',
            `Session replay identified with distinctId ${distinctId} and anonymousId ${anonymousId}.`
          )
        )
      } catch (e) {
        this.logMsgIfDebug(() => console.error('PostHog Debug', `Session replay failed to identify: ${e}.`))
      }
    }
  }

  public async getSurveys(): Promise<SurveyResponse['surveys']> {
    if (this._disableSurveys === true) {
      this.logMsgIfDebug(() => console.log('PostHog Debug', 'Loading surveys is disabled.'))
      this.setPersistedProperty<SurveyResponse['surveys']>(PostHogPersistedProperty.Surveys, null)
      return []
    }

    const surveys = this.getPersistedProperty<SurveyResponse['surveys']>(PostHogPersistedProperty.Surveys)

    if (surveys && surveys.length > 0) {
      this.logMsgIfDebug(() => console.log('PostHog Debug', 'Surveys fetched from storage: ', JSON.stringify(surveys)))
      return surveys
    } else {
      this.logMsgIfDebug(() => console.log('PostHog Debug', 'No surveys found in storage'))
    }

    if (this._disableRemoteConfig === true) {
      const surveysFromApi = await super.getSurveysStateless()

      if (surveysFromApi && surveysFromApi.length > 0) {
        this.setPersistedProperty<SurveyResponse['surveys']>(PostHogPersistedProperty.Surveys, surveysFromApi)
        return surveysFromApi
      }
    }

    return []
  }

  private _isEnableSessionReplay(): boolean {
    return !this.isDisabled && (this._enableSessionReplay ?? false)
  }

  private async startSessionReplay(options?: PostHogOptions): Promise<void> {
    this._enableSessionReplay = options?.enableSessionReplay

    console.log('🎥 PostHog Session Replay Debug:', {
      enableSessionReplay: this._enableSessionReplay,
      isNativePlatform: Capacitor.isNativePlatform(),
      platform: Capacitor.getPlatform(),
      isDisabled: this.isDisabled,
      apiKey: this.apiKey ? `${this.apiKey.substring(0, 8)}...` : 'not set'
    })

    if (!this._isEnableSessionReplay()) {
      console.warn('❌ PostHog Session Replay: Not enabled')
      this.logMsgIfDebug(() => console.info('PostHog Debug', 'Session replay is not enabled.'))
      return
    }

    console.log('✅ PostHog Session Replay: Enabled, checking platform...')

    // Try to use native session replay if available and on native platform
    if (Capacitor.isNativePlatform()) {
      if (this.nativePlugin) {
        const sessionId = this.getSessionId()

        if (sessionId.length === 0) {
          console.error('❌ PostHog Session Replay: No session ID found')
          this.logMsgIfDebug(() => console.warn('PostHog Debug', 'Session replay enabled but no sessionId found.'))
          return
        }

        try {
          const enabledResult = await this.nativePlugin.isSessionReplayEnabled()
          const isAlreadyEnabled = (enabledResult as any)?.value ?? enabledResult

          if (!isAlreadyEnabled) {
            await this.startNativeSessionReplay(options)
            console.log('✅ PostHog Session Replay: Successfully started!')
            this.logMsgIfDebug(() =>
              console.info('PostHog Debug', `Session replay started with sessionId ${sessionId}.`)
            )
          } else {
            // If somehow the SDK is already enabled with a different sessionId, we reset it
            this._currentSessionId = sessionId
            await this._resetNativeSessionId(sessionId)
            this.logMsgIfDebug(() =>
              console.log('PostHog Debug', `Session replay already started with sessionId ${sessionId}.`)
            )
          }
          this._currentSessionId = sessionId
          return
        } catch (e) {
          console.error('❌ PostHog Session Replay: Failed to start:', e)
          this.logMsgIfDebug(() => console.error('PostHog Debug', `Session replay failed to start: ${e}.`))
        }
      } else {
        this.logMsgIfDebug(() => console.warn('PostHog Debug', 'Session replay enabled but native plugin not available.'))
      }
    }

    const defaultThrottleDelayMs = 1000

    const {
      maskAllTextInputs = true,
      maskAllImages = true,
      maskAllSandboxedViews = true,
      captureLog = true,
      captureNetworkTelemetry = true,
      throttleDelayMs = defaultThrottleDelayMs,
    } = options?.sessionReplayConfig ?? {}

    const sdkReplayConfig = {
      maskAllTextInputs,
      maskAllImages,
      maskAllSandboxedViews,
      captureLog,
      captureNetworkTelemetry,
      throttleDelayMs,
    }

    this.logMsgIfDebug(() =>
      console.log('PostHog Debug', `Session replay SDK config: ${JSON.stringify(sdkReplayConfig)}`)
    )

    const sessionReplay = this.getPersistedProperty(PostHogPersistedProperty.SessionReplay) ?? {}
    const featureFlags = this.getKnownFeatureFlags() ?? {}
    const cachedFeatureFlags = (featureFlags as { [key: string]: FeatureFlagValue }) ?? {}
    const cachedSessionReplayConfig = (sessionReplay as { [key: string]: JsonType }) ?? {}

    let recordingActive = true
    const linkedFlag = cachedSessionReplayConfig['linkedFlag'] as
      | string
      | { [key: string]: JsonType }
      | null
      | undefined

    if (typeof linkedFlag === 'string') {
      const value = cachedFeatureFlags[linkedFlag]
      if (typeof value === 'boolean') {
        recordingActive = value
      } else if (typeof value === 'string') {
        recordingActive = true
      } else {
        recordingActive = false
      }

      this.logMsgIfDebug(() =>
        console.log('PostHog Debug', `Session replay '${linkedFlag}' linked flag value: '${value}'`)
      )
    } else if (linkedFlag && typeof linkedFlag === 'object') {
      const flag = linkedFlag['flag'] as string | undefined
      const variant = linkedFlag['variant'] as string | undefined
      if (flag && variant) {
        const value = cachedFeatureFlags[flag]
        recordingActive = value === variant
        this.logMsgIfDebug(() =>
          console.log('PostHog Debug', `Session replay '${flag}' linked flag variant '${variant}' and value '${value}'`)
        )
      } else {
        this.logMsgIfDebug(() =>
          console.log(
            'PostHog Debug',
            `Session replay '${flag}' linked flag variant: '${variant}' does not exist/quota limited.`
          )
        )
        recordingActive = false
      }
    } else {
      this.logMsgIfDebug(() => console.log('PostHog Debug', `Session replay has no cached linkedFlag.`))
    }

    if (recordingActive) {
      const sessionId = this.getSessionId()

      if (sessionId.length === 0) {
        this.logMsgIfDebug(() => console.warn('PostHog Debug', 'Session replay enabled but no sessionId found.'))
        return
      }

      this._currentSessionId = sessionId
      this.logMsgIfDebug(() =>
        console.info('PostHog Debug', `Session replay would start with sessionId ${sessionId} (native implementation needed).`)
      )
    } else {
      this.logMsgIfDebug(() => console.info('PostHog Debug', 'Session replay disabled.'))
    }
  }

  private async captureAppLifecycleEvents(): Promise<void> {
    const appBuild = this._appProperties.$app_build
    const appVersion = this._appProperties.$app_version

    const isMemoryPersistence = this._persistence === 'memory'

    const properties: PostHogEventProperties = {}

    if (!isMemoryPersistence) {
      const prevAppBuild = this.getPersistedProperty(PostHogPersistedProperty.InstalledAppBuild) as string | undefined
      const prevAppVersion = this.getPersistedProperty(PostHogPersistedProperty.InstalledAppVersion) as
        | string
        | undefined

      if (!appBuild || !appVersion) {
        this.logMsgIfDebug(() =>
          console.warn(
            'PostHog could not track installation/update/open, as the build and version were not set. ' +
              'This can happen if some dependencies are not installed correctly, or if you have provided' +
              'customAppProperties but not included $app_build or $app_version.'
          )
        )
      }
      if (appBuild) {
        if (!prevAppBuild) {
          this.capture('Application Installed', properties)
        } else if (prevAppBuild !== appBuild) {
          this.capture('Application Updated', {
            ...maybeAdd('previous_version', prevAppVersion),
            ...maybeAdd('previous_build', prevAppBuild),
            ...properties,
          })
        }
      }
    } else {
      this.logMsgIfDebug(() =>
        console.warn(
          'PostHog was initialized with persistence set to "memory", capturing native app events (Application Installed and Application Updated) is not supported.'
        )
      )
    }

    let initialUrl: string | undefined

    if (Capacitor.isNativePlatform()) {
      try {
        const urlOpen = await App.getLaunchUrl()
        initialUrl = urlOpen?.url
      } catch (e) {
        console.warn('PostHog: Could not get launch URL', e)
      }
    } else if (typeof window !== 'undefined' && window.location) {
      initialUrl = window.location.href
    }

    this.capture('Application Opened', {
      ...properties,
      ...maybeAdd('url', initialUrl),
    })

    if (Capacitor.isNativePlatform()) {
      App.addListener('appStateChange', (state) => {
        if (state.isActive) {
          this.capture('Application Became Active')
          this.getSessionId()
        } else {
          this.capture('Application Backgrounded')
          void this.flush().catch(async (err) => {
            await logFlushError(err)
          })
        }
      })

      App.addListener('appUrlOpen', (data) => {
        this.capture('Deep Link Opened', {
          url: data.url,
        })
      })
    }
  }

  private async persistAppVersion(): Promise<void> {
    const appBuild = this._appProperties.$app_build
    const appVersion = this._appProperties.$app_version
    this.setPersistedProperty(PostHogPersistedProperty.InstalledAppBuild, appBuild)
    this.setPersistedProperty(PostHogPersistedProperty.InstalledAppVersion, appVersion)
  }

  public initAutocapture(options?: PostHogAutocaptureOptions): void {
    if (this._autocaptureCleanup) {
      this._autocaptureCleanup()
    }
    this._autocaptureCleanup = initAutocapture(this, options)
  }

  public stopAutocapture(): void {
    if (this._autocaptureCleanup) {
      this._autocaptureCleanup()
      this._autocaptureCleanup = undefined
    }
  }

  public destroy(): void {
    this.stopAutocapture()
    this.resetSessionId()
    this.flush()
  }

  private async startNativeSessionReplay(options?: PostHogOptions): Promise<void> {
    const sessionId = this.getSessionId()
    if (sessionId.length === 0) {
      this.logMsgIfDebug(() => console.warn('PostHog Debug', 'Session replay enabled but no sessionId found.'))
      return
    }

    const defaultThrottleDelayMs = 1000

    const {
      maskAllTextInputs = true,
      maskAllImages = true,
      maskAllSandboxedViews = true,
      captureLog = true,
      captureNetworkTelemetry = true,
      throttleDelayMs = defaultThrottleDelayMs,
    } = options?.sessionReplayConfig ?? {}

    const sdkReplayConfig = {
      maskAllTextInputs,
      maskAllImages,
      maskAllSandboxedViews,
      captureLog,
      captureNetworkTelemetry,
      throttleDelayMs,
    }

    const sdkOptions = {
      apiKey: this.apiKey,
      host: this.host,
      debug: this.isDebug,
      distinctId: this.getDistinctId(),
      anonymousId: this.getAnonymousId(),
      sdkVersion: this.getLibraryVersion(),
      flushAt: this.flushAt,
    }

    this.logMsgIfDebug(() =>
      console.log('PostHog Debug', `Session replay sdk options: ${JSON.stringify(sdkOptions)}`)
    )

    const sessionReplay = this.getPersistedProperty(PostHogPersistedProperty.SessionReplay) ?? {}
    const featureFlags = this.getKnownFeatureFlags() ?? {}
    const cachedFeatureFlags = (featureFlags as { [key: string]: FeatureFlagValue }) ?? {}
    const cachedSessionReplayConfig = (sessionReplay as { [key: string]: JsonType }) ?? {}

    this.logMsgIfDebug(() =>
      console.log(
        'PostHog Debug',
        `Session replay feature flags from flags cached config: ${JSON.stringify(cachedFeatureFlags)}`
      )
    )

    this.logMsgIfDebug(() =>
      console.log(
        'PostHog Debug',
        `Session replay session recording from flags cached config: ${JSON.stringify(cachedSessionReplayConfig)}`
      )
    )

    try {
      await this.nativePlugin.startSessionReplay({
        sessionId,
        sdkOptions,
        sdkReplayConfig,
        decideReplayConfig: cachedSessionReplayConfig,
      })

      this._currentSessionId = sessionId
    } catch (e) {
      this.logMsgIfDebug(() => console.error('PostHog Debug', `Native session replay failed to start: ${e}.`))
      throw e // Re-throw so the caller can handle it
    }
  }

  public async _resetNativeSessionId(sessionId: string): Promise<void> {
    if (!this._isEnableSessionReplay() || !Capacitor.isNativePlatform()) {
      return
    }

    try {
    
      if (this.nativePlugin) {
        await this.nativePlugin.endSessionReplay()
        await this.nativePlugin.startSessionReplaySession({ sessionId })
        this.logMsgIfDebug(() =>
          console.info('PostHog Debug', `Native sessionId rotated to ${sessionId}.`)
        )
      }
    } catch (e) {
      this.logMsgIfDebug(() => console.error('PostHog Debug', `Failed to rotate native sessionId: ${e}.`))
    }
  }

  public async enableAutocapture(options?: PostHogAutocaptureOptions): Promise<void> {
    if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() === 'web') {
      if (this._autocaptureCleanup) {
        this.logMsgIfDebug(() => console.warn('PostHog Debug', 'Autocapture is already enabled'))
        return
      }

      this._autocaptureCleanup = initAutocapture(this, options)
      this.logMsgIfDebug(() => console.info('PostHog Debug', 'Autocapture enabled'))
    }
  }

  public async disableAutocapture(): Promise<void> {
    if (this._autocaptureCleanup) {
      this._autocaptureCleanup()
      this._autocaptureCleanup = undefined
      this.logMsgIfDebug(() => console.info('PostHog Debug', 'Autocapture disabled'))
    }
  }
}

/**
 * PostHog wrapper class with lazy initialization support.
 * This class provides two initialization patterns:
 * 1. Constructor initialization for immediate setup
 * 2. Setup method for dependency injection scenarios
 */
export class PostHog {
  private _impl?: PostHogImpl
  private _setupPromise?: Promise<void>
  private _pendingSetup?: Promise<PostHogImpl>
  private _setupResolver?: (impl: PostHogImpl) => void

  constructor() {
    // Always create a promise that will resolve when setup is called
    this._pendingSetup = new Promise<PostHogImpl>((resolve) => {
      this._setupResolver = resolve
    })
  }

  /**
   * Initialize PostHog with API key and options.
   * This is the only way to initialize PostHog - must be called after constructor.
   *
   * @example
   * ```typescript
   * // Setup method initialization
   * const posthog = new PostHog()
   * posthog.setup('api_key', { enableSessionReplay: true })
   * ```
   */
  public setup(apiKey: string, options?: PostHogOptions): Promise<void> {
    if (this._impl) {
      console.warn('PostHog is already initialized. Ignoring duplicate setup.')
      return Promise.resolve()
    }

    console.log('🔧 PostHog setup starting with options:', {
      enableSessionReplay: options?.enableSessionReplay,
      host: options?.host
    })

    this._impl = new PostHogImpl(apiKey, options)
    this._setupPromise = this._impl.ready()

    // Resolve the pending setup promise
    if (this._setupResolver) {
      this._setupResolver(this._impl)
      this._setupResolver = undefined
    }

    this._setupPromise.then(() => {
      console.log('✅ PostHog setup completed successfully!')
    }).catch(e => {
      console.error('❌ PostHog setup failed:', e)
    })

    return this._setupPromise
  }

  private async ensureInitialized(): Promise<PostHogImpl> {
    if (this._impl) {
      await this._setupPromise
      return this._impl
    }

    // Wait for setup to be called
    if (this._pendingSetup) {
      console.log('PostHog: Waiting for setup() to be called...')
      return await this._pendingSetup
    }

    // This should never happen but just in case
    throw new Error('PostHog is not initialized. Call setup() or provide apiKey in constructor.')
  }

  // Proxy all methods to the implementation instance

  async ready(): Promise<void> {
    const impl = await this.ensureInitialized()
    await impl.ready()
  }

  async capture(
    eventName: string,
    properties?: PostHogEventProperties,
    options?: PostHogCaptureOptions
  ): Promise<void> {
    const impl = await this.ensureInitialized()
    return impl.capture(eventName, properties, options)
  }

  async screen(
    name: string,
    properties?: PostHogEventProperties,
    options?: PostHogCaptureOptions
  ): Promise<void> {
    const impl = await this.ensureInitialized()
    return impl.screen(name, properties, options)
  }

  async identify(
    distinctId?: string,
    properties?: PostHogEventProperties,
    options?: PostHogCaptureOptions
  ): Promise<void> {
    const impl = await this.ensureInitialized()
    return impl.identify(distinctId, properties, options)
  }

  async alias(alias: string): Promise<void> {
    const impl = await this.ensureInitialized()
    return impl.alias(alias)
  }

  async group(
    groupType: string,
    groupKey: string,
    properties?: PostHogEventProperties
  ): Promise<void> {
    const impl = await this.ensureInitialized()
    return impl.group(groupType, groupKey, properties)
  }

  async register(properties: PostHogEventProperties): Promise<void> {
    const impl = await this.ensureInitialized()
    return impl.register(properties)
  }

  async unregister(property: string): Promise<void> {
    const impl = await this.ensureInitialized()
    return impl.unregister(property)
  }

  async reset(): Promise<void> {
    const impl = await this.ensureInitialized()
    return impl.reset()
  }

  async flush(): Promise<any[]> {
    const impl = await this.ensureInitialized()
    await impl.flush()
    return []
  }

  async close(): Promise<void> {
    const impl = await this.ensureInitialized()
    // PostHogImpl doesn't have close method, flush instead
    await impl.flush()
  }

  async optIn(): Promise<void> {
    const impl = await this.ensureInitialized()
    return impl.optIn()
  }

  async optOut(): Promise<void> {
    const impl = await this.ensureInitialized()
    return impl.optOut()
  }

  async isFeatureEnabled(key: string): Promise<boolean | undefined> {
    const impl = await this.ensureInitialized()
    return impl.isFeatureEnabled(key)
  }

  async getFeatureFlag(key: string): Promise<boolean | string | undefined> {
    const impl = await this.ensureInitialized()
    return impl.getFeatureFlag(key)
  }

  async getFeatureFlagPayload(key: string): Promise<JsonType | undefined> {
    const impl = await this.ensureInitialized()
    return impl.getFeatureFlagPayload(key)
  }

  async reloadFeatureFlags(): Promise<void> {
    const impl = await this.ensureInitialized()
    return impl.reloadFeatureFlags()
  }

  async reloadFeatureFlagsAsync(): Promise<Record<string, boolean | string> | undefined> {
    const impl = await this.ensureInitialized()
    return impl.reloadFeatureFlagsAsync()
  }

  async setPersonPropertiesForFlags(properties: Record<string, string>): Promise<void> {
    const impl = await this.ensureInitialized()
    return impl.setPersonPropertiesForFlags(properties)
  }

  async resetPersonPropertiesForFlags(): Promise<void> {
    const impl = await this.ensureInitialized()
    return impl.resetPersonPropertiesForFlags()
  }

  async setGroupPropertiesForFlags(properties: Record<string, Record<string, string>>): Promise<void> {
    const impl = await this.ensureInitialized()
    return impl.setGroupPropertiesForFlags(properties)
  }

  async resetGroupPropertiesForFlags(): Promise<void> {
    const impl = await this.ensureInitialized()
    return impl.resetGroupPropertiesForFlags()
  }

  async getSurveys(): Promise<any[]> {
    const impl = await this.ensureInitialized()
    return impl.getSurveys()
  }

  async getDistinctId(): Promise<string> {
    const impl = await this.ensureInitialized()
    return impl.getDistinctId()
  }

  async getAnonymousId(): Promise<string> {
    const impl = await this.ensureInitialized()
    return impl.getAnonymousId()
  }

  async getSessionId(): Promise<string> {
    const impl = await this.ensureInitialized()
    return impl.getSessionId()
  }

  async resetSessionId(): Promise<void> {
    const impl = await this.ensureInitialized()
    return impl.resetSessionId()
  }

  async enableAutocapture(options?: PostHogAutocaptureOptions): Promise<void> {
    const impl = await this.ensureInitialized()
    return impl.enableAutocapture(options)
  }

  async disableAutocapture(): Promise<void> {
    const impl = await this.ensureInitialized()
    return impl.disableAutocapture()
  }

  // Session replay methods
  async startNativeSessionReplay(_options?: PostHogOptions): Promise<void> {
    await this.ensureInitialized()
    // startNativeSessionReplay is a private method in PostHogImpl
    // We need to expose it or use a different approach
    // For now, we'll keep it internal since it's called automatically
    throw new Error('startNativeSessionReplay is handled internally when enableSessionReplay is true')
  }

  async _resetNativeSessionId(sessionId: string): Promise<void> {
    const impl = await this.ensureInitialized()
    return impl._resetNativeSessionId(sessionId)
  }

  // Getter methods that don't need async
  get isDebug(): boolean {
    return this._impl?.isDebug ?? false
  }

  get isDisabled(): boolean {
    return this._impl?.isDisabled ?? false
  }
}