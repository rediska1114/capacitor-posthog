import { Device } from '@capacitor/device'
import { App } from '@capacitor/app'
import { Preferences } from '@capacitor/preferences'
import { PostHogCustomAppProperties, PostHogCustomStorage } from './types'
import { Capacitor } from '@capacitor/core'

const getDeviceType = async (): Promise<string> => {
  const info = await Device.getInfo()
  const platform = info.platform

  if (platform === 'ios' || platform === 'android') {
    return 'Mobile'
  } else if (platform === 'web') {
    return 'Web'
  }
  return 'Desktop'
}

export const getAppProperties = async (): Promise<PostHogCustomAppProperties> => {
  const properties: PostHogCustomAppProperties = {}

  try {
    const deviceInfo = await Device.getInfo()
    const languageInfo = await Device.getLanguageCode()

    properties.$device_type = await getDeviceType()
    properties.$device_manufacturer = deviceInfo.manufacturer || null
    properties.$device_name = deviceInfo.model || null
    properties.$device_model = deviceInfo.model || null
    properties.$os_name = deviceInfo.operatingSystem || null
    properties.$os_version = deviceInfo.osVersion || null
    properties.$locale = languageInfo.value || null

    if (Capacitor.isNativePlatform()) {
      try {
        const appInfo = await App.getInfo()
        properties.$app_build = appInfo.build || null
        properties.$app_name = appInfo.name || null
        properties.$app_namespace = appInfo.id || null
        properties.$app_version = appInfo.version || null
      } catch (e) {
        console.warn('PostHog: Could not get app info', e)
      }
    }

    try {
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone
      properties.$timezone = timezone || null
    } catch (e) {
      console.warn('PostHog: Could not get timezone', e)
    }
  } catch (e) {
    console.warn('PostHog: Could not get device properties', e)
  }

  return properties
}

export const buildCapacitorStorage = (): PostHogCustomStorage => {
  return {
    async getItem(key: string): Promise<string | null> {
      try {
        const result = await Preferences.get({ key })
        return result.value || null
      } catch (e) {
        console.warn('PostHog: Storage getItem failed', e)
        return null
      }
    },

    async setItem(key: string, value: string): Promise<void> {
      try {
        await Preferences.set({ key, value })
      } catch (e) {
        console.warn('PostHog: Storage setItem failed', e)
      }
    },

    async removeItem(key: string): Promise<void> {
      try {
        await Preferences.remove({ key })
      } catch (e) {
        console.warn('PostHog: Storage removeItem failed', e)
      }
    }
  }
}