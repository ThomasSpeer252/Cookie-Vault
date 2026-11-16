export const XSS_EXFIL_RING_MAX = 200

export const XSS_MSG_RECORD_OUTBOUND = 'XSS_RECORD_OUTBOUND'
export const XSS_MSG_GET_OBSERVATIONS = 'XSS_GET_OBSERVATIONS'
export const XSS_MSG_GET_OBSERVATIONS_FOR_TAB = 'XSS_GET_OBSERVATIONS_FOR_TAB'
export const XSS_HOOK_POST_MESSAGE = 'XSS_OUTBOUND_HOOK'

export type XssOutboundSource = 'fetch' | 'xhr' | 'sendBeacon' | 'webRequest'

export interface XssOutboundObservation {
  id: string
  tabId: number
  pageUrl: string
  pageHost: string
  source: XssOutboundSource
  timestamp: number
  requestUrl: string
  method: string
  destHost: string
  isThirdParty: boolean
  bodyPreview?: string
  resourceType?: string
}

export type XssOutboundObservationInput = Omit<XssOutboundObservation, 'id' | 'timestamp'> & {
  id?: string
  timestamp?: number
}

export class XssExfilStore {
  private static instance: XssExfilStore | null = null

  private ring: XssOutboundObservation[] = []
  private ringMax = XSS_EXFIL_RING_MAX
  private initialized = false

  private constructor() {}

  public static getInstance(): XssExfilStore {
    if (!XssExfilStore.instance) {
      XssExfilStore.instance = new XssExfilStore()
    }
    return XssExfilStore.instance
  }

  /**
   * @description Prepares the in-memory observation ring for recording.
   * @param {object} [options]
   * @param {number} [options.ringMax] - Maximum observations retained.
   */
  public init(options?: { ringMax?: number }): void {
    if (options?.ringMax !== undefined) {
      this.ringMax = options.ringMax
    }
    this.ring = []
    this.initialized = true
  }

  /**
   * @description Records an outbound request observation (harness / future exfil detection).
   */
  public recordObservation(input: XssOutboundObservationInput): XssOutboundObservation {
    if (!this.initialized) {
      throw new Error('XssExfilStore not initialized')
    }

    const observation: XssOutboundObservation = {
      id: input.id ?? crypto.randomUUID(),
      timestamp: input.timestamp ?? Date.now(),
      tabId: input.tabId,
      pageUrl: input.pageUrl,
      pageHost: input.pageHost,
      source: input.source,
      requestUrl: input.requestUrl,
      method: input.method,
      destHost: input.destHost,
      isThirdParty: input.isThirdParty,
      bodyPreview: input.bodyPreview,
      resourceType: input.resourceType,
    }

    this.ring.push(observation)
    if (this.ring.length > this.ringMax) {
      this.ring.splice(0, this.ring.length - this.ringMax)
    }

    return observation
  }

  /**
   * @description Returns the most recent observations (newest first).
   */
  public getRecentObservations(limit = 50): XssOutboundObservation[] {
    if (!this.initialized) {
      throw new Error('XssExfilStore not initialized')
    }

    return this.ring.slice(-limit).reverse()
  }

  public getObservationsByTabId(tabId: number, limit = 80): XssOutboundObservation[] {
    if (!this.initialized) {
      throw new Error('XssExfilStore not initialized')
    }

    return this.ring
      .filter(obs => obs.tabId === tabId)
      .slice(-limit)
      .reverse()
  }

  public clear(): void {
    this.ring = []
  }
}

export function hostFromUrl(url: string): string {
  try {
    return new URL(url).hostname
  } catch {
    return ''
  }
}

/** Same heuristic as cookie list grouping: last two labels when host has 3+ parts. */
export function registrableDomain(host: string): string {
  const normalized = host.toLowerCase().replace(/^\.+/, '')
  const labels = normalized.split('.').filter(Boolean)
  if (labels.length <= 2) return labels.join('.')
  return labels.slice(-2).join('.')
}

export function isThirdPartyRequest(pageHost: string, destHost: string): boolean {
  const page = pageHost.toLowerCase().replace(/^\.+/, '')
  const dest = destHost.toLowerCase().replace(/^\.+/, '')
  if (!page || !dest) return false
  if (page === dest) return false
  if (registrableDomain(page) === registrableDomain(dest)) return false
  if (dest.endsWith(`.${page}`) || page.endsWith(`.${dest}`)) return false
  return true
}
