export type PostHogCustomAppProperties = {
  $app_build?: string | null
  $app_name?: string | null
  $app_namespace?: string | null
  $app_version?: string | null
  $device_manufacturer?: string | null
  $device_name?: string | null
  $device_model?: string | null
  $device_type?: string | null
  $os_name?: string | null
  $os_version?: string | null
  $locale?: string | null
  $timezone?: string | null
}

export interface PostHogCustomStorage {
  getItem: (key: string) => string | null | Promise<string | null>
  setItem: (key: string, value: string) => void | Promise<void>
  removeItem?: (key: string) => void | Promise<void>
}

export type PostHogSessionReplayConfig = {
  maskAllTextInputs?: boolean
  maskAllImages?: boolean
  maskAllSandboxedViews?: boolean
  captureLog?: boolean
  throttleDelayMs?: number
  captureNetworkTelemetry?: boolean
}