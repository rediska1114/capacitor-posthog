import { PostHogAutocaptureElement, JsonType } from '@posthog/core'

export interface PostHogAutocaptureOptions {
  captureTouches?: boolean
  customLabelProp?: string
  noCaptureProp?: string
  maxElementsCaptured?: number
  ignoreLabels?: string[]
  propsToCapture?: string[]
  captureAllDomEvents?: boolean
}

const sanitiseLabel = (label: string): string => {
  return label.replace(/[^a-z0-9]+/gi, '-')
}

const getElementPath = (element: HTMLElement, maxDepth: number = 20): PostHogAutocaptureElement[] => {
  const elements: PostHogAutocaptureElement[] = []
  let currentElement: HTMLElement | null = element
  let depth = 0

  while (currentElement && depth < maxDepth) {
    const el: PostHogAutocaptureElement = {
      tag_name: currentElement.tagName?.toLowerCase() || '',
    }

    // Capture element attributes
    if (currentElement.id) {
      el.attr__id = currentElement.id
    }

    if (currentElement.className) {
      el.attr__class = currentElement.className
    }

    // Capture data attributes
    for (let i = 0; i < currentElement.attributes.length; i++) {
      const attr = currentElement.attributes[i]
      if (attr.name.startsWith('data-')) {
        el[`attr__${attr.name}`] = attr.value as JsonType
      }
    }

    // Capture text content for leaf elements
    if (currentElement.childNodes.length === 1 && currentElement.childNodes[0].nodeType === Node.TEXT_NODE) {
      const text = currentElement.textContent?.trim()
      if (text && text.length < 200) {
        el.$el_text = text
      }
    }

    // Special handling for form elements
    if (currentElement instanceof HTMLInputElement || currentElement instanceof HTMLSelectElement || currentElement instanceof HTMLTextAreaElement) {
      el.attr__type = currentElement.type
      el.attr__name = currentElement.name

      if (currentElement instanceof HTMLInputElement && (currentElement.type === 'button' || currentElement.type === 'submit')) {
        el.$el_text = currentElement.value
      }
    }

    // Button text
    if (currentElement instanceof HTMLButtonElement) {
      el.$el_text = currentElement.textContent?.trim() || ''
    }

    // Link href
    if (currentElement instanceof HTMLAnchorElement) {
      el.attr__href = currentElement.href
    }

    elements.push(el)
    currentElement = currentElement.parentElement
    depth++
  }

  return elements
}

interface PostHogInstance {
  capture(eventName: string, properties?: any, options?: any): void
  autocapture?(eventType: string, elements: any[], properties?: any, options?: any): void
}

export const initAutocapture = (posthog: PostHogInstance, options: PostHogAutocaptureOptions = {}): () => void => {
  const {
    noCaptureProp = 'ph-no-capture',
    customLabelProp = 'ph-label',
    maxElementsCaptured = 20,
    ignoreLabels = [],
    captureAllDomEvents = false,
  } = options

  const handleEvent = (eventType: string) => (e: Event): void => {
    if (!(e.target instanceof HTMLElement)) {
      return
    }

    // Check if any parent has no-capture attribute
    let element: HTMLElement | null = e.target
    while (element) {
      if (element.getAttribute(noCaptureProp) !== null || element.dataset[noCaptureProp] !== undefined) {
        return
      }
      element = element.parentElement
    }

    const elements = getElementPath(e.target as HTMLElement, maxElementsCaptured)

    // Process custom labels
    const customLabelAttr = `attr__data-${customLabelProp}`
    let lastLabel: string | undefined

    for (let i = elements.length - 1; i >= 0; i--) {
      const element = elements[i]

      // Check for custom label
      if (element[customLabelAttr]) {
        lastLabel = element[customLabelAttr] as string
      }

      // Apply custom label if found
      if (lastLabel && !ignoreLabels.includes(lastLabel)) {
        element.tag_name = sanitiseLabel(lastLabel)
      }
    }

    // Filter out ignored labels
    const filteredElements = elements.filter(el => !ignoreLabels.includes(el.tag_name))

    if (filteredElements.length > 0) {
      const properties: Record<string, JsonType> = {}

      // Add event-specific properties
      if (e instanceof MouseEvent) {
        properties.$click_x = e.pageX
        properties.$click_y = e.pageY
      } else if (e instanceof TouchEvent && e.touches.length > 0) {
        properties.$touch_x = e.touches[0].pageX
        properties.$touch_y = e.touches[0].pageY
      }

      posthog.autocapture?.(eventType, filteredElements, properties)
    }
  }

  // Event listeners
  const listeners: Array<{ type: string; handler: (e: Event) => void }> = []

  // Click events
  const clickHandler = handleEvent('click')
  document.addEventListener('click', clickHandler, true)
  listeners.push({ type: 'click', handler: clickHandler })

  // Touch events (for mobile)
  if (options.captureTouches !== false) {
    const touchHandler = handleEvent('touch')
    document.addEventListener('touchend', touchHandler, true)
    listeners.push({ type: 'touchend', handler: touchHandler })
  }

  // Additional DOM events
  if (captureAllDomEvents) {
    const events = ['submit', 'change', 'input', 'focus', 'blur']
    events.forEach(eventType => {
      const handler = handleEvent(eventType)
      document.addEventListener(eventType, handler, true)
      listeners.push({ type: eventType, handler })
    })
  }

  // Return cleanup function
  return () => {
    listeners.forEach(({ type, handler }) => {
      document.removeEventListener(type, handler, true)
    })
  }
}

