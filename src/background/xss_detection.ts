import { XSS_TAB_ALERT } from '../xss/xss_alert_message'
import { cookieHeaderFromRequest, cookieNamesFromHeader } from '../xss/cookie_header'
import { requestBodyText } from '../xss/request_body'
import { clearSiteCookieSnapshot, getSiteCookiesForPage } from '../xss/site_cookie_snapshot'
import { detectCookieExfil } from '../xss/xss_exfil_detector'
import {
  hostFromUrl,
  isThirdPartyRequest,
  XssExfilStore,
  XSS_MSG_GET_OBSERVATIONS,
  XSS_MSG_GET_OBSERVATIONS_FOR_TAB,
  XSS_MSG_RECORD_OUTBOUND,
  type XssOutboundObservationInput,
} from '../xss/XssExfilStore'

const tabPageUrlById = new Map<number, string>()
const alertedRequestIds = new Set<string>()
let detectionActive: boolean | null = null

async function detectionEnabled(): Promise<boolean> {
  if (detectionActive !== null) return detectionActive
  const stored = await chrome.storage.sync.get({ detectionActive: false })
  detectionActive = Boolean(stored.detectionActive)
  return detectionActive
}

function rememberTabUrl(tabId: number, url: string | undefined) {
  if (url && (url.startsWith('http://') || url.startsWith('https://'))) {
    tabPageUrlById.set(tabId, url)
  }
}

async function pageUrlForRequest(tabId: number, initiator?: string): Promise<string> {
  const remembered = tabPageUrlById.get(tabId)
  if (remembered) return remembered
  try {
    const tab = await chrome.tabs.get(tabId)
    if (tab.url && (tab.url.startsWith('http://') || tab.url.startsWith('https://'))) {
      tabPageUrlById.set(tabId, tab.url)
      return tab.url
    }
  } catch {
    // The tab can close before the lookup finishes.
  }
  if (initiator && (initiator.startsWith('http://') || initiator.startsWith('https://'))) return initiator
  return ''
}

async function inspectThirdPartyCookies(details: {
  tabId: number
  url: string
  initiator?: string
  requestId?: string
  requestHeaders?: chrome.webRequest.HttpHeader[]
  requestBody?: string
}): Promise<void> {
  if (details.tabId < 0 || !await detectionEnabled()) return

  const pageUrl = await pageUrlForRequest(details.tabId, details.initiator)
  let pageHost = ''
  try {
    pageHost = pageUrl ? new URL(pageUrl).hostname : ''
  } catch {
    pageHost = ''
  }

  const destHost = hostFromUrl(details.url)
  if (!isThirdPartyRequest(pageHost, destHost)) return

  const siteCookies = await getSiteCookiesForPage(details.tabId, pageUrl)
  const hit = detectCookieExfil({
    isThirdParty: true,
    destHost,
    sentCookieNames: cookieNamesFromHeader(cookieHeaderFromRequest(details.requestHeaders)),
    siteCookies,
    requestUrl: details.url,
    requestBody: details.requestBody,
  })
  if (!hit) return
  if (details.requestId) {
    if (alertedRequestIds.has(details.requestId)) return
    alertedRequestIds.add(details.requestId)
    if (alertedRequestIds.size > 500) {
      const oldest = alertedRequestIds.values().next().value
      if (oldest) alertedRequestIds.delete(oldest)
    }
  }

  void deliverTabAlert(details.tabId, hit)
}

function deliverTabAlert(tabId: number, payload: { kind: 'xss'; cookieNames: string[]; destHost: string }): void {
  void chrome.tabs.sendMessage(tabId, {
    type: XSS_TAB_ALERT,
    payload,
  }).catch(() => {
    void chrome.scripting.executeScript({
      target: { tabId },
      func: showInjectedAlert,
      args: [payload],
    }).catch(() => undefined)
  })
}

function showInjectedAlert(payload: { kind: 'xss'; cookieNames: string[]; destHost: string }): void {
  const title = 'POSSIBLE XSS'
  const detail = `${payload.cookieNames.join(', ')} sent to ${payload.destHost}`
  const tone = '#f87171'
  const host = document.createElement('div')
  host.style.cssText = 'all:initial;position:fixed;top:16px;right:16px;z-index:2147483647;'
  const shadow = host.attachShadow({ mode: 'open' })
  shadow.innerHTML = `<div style="width:320px;font-family:system-ui,sans-serif;background:#111827;color:#e5e7eb;border:1px solid #374151;border-left:3px solid ${tone};border-radius:10px;padding:12px 14px;box-shadow:0 12px 32px rgba(0,0,0,.45)"><div style="font-family:ui-monospace,monospace;font-size:11px;letter-spacing:.06em;color:${tone};font-weight:700">${title}</div><div style="margin-top:6px;font-size:13px">${detail}</div></div>`
  document.documentElement.appendChild(host)
  window.setTimeout(() => host.remove(), 12000)
}

export function registerXssDetection(): void {
  XssExfilStore.getInstance().init()
  void detectionEnabled()

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'sync' && changes.detectionActive) {
      detectionActive = Boolean(changes.detectionActive.newValue)
    }
  })

  void chrome.tabs.query({}).then((tabs) => {
    for (const tab of tabs) {
      if (tab.id !== undefined) rememberTabUrl(tab.id, tab.url)
    }
  })

  chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.url) rememberTabUrl(tabId, changeInfo.url)
    else rememberTabUrl(tabId, tab.url)
  })

  chrome.tabs.onRemoved.addListener((tabId) => {
    tabPageUrlById.delete(tabId)
    clearSiteCookieSnapshot(tabId)
  })

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message?.type === XSS_MSG_RECORD_OUTBOUND) {
      const tabId = sender.tab?.id ?? message.payload?.tabId ?? -1
      const payload = message.payload as XssOutboundObservationInput
      XssExfilStore.getInstance().recordObservation({ ...payload, tabId })
      sendResponse({ ok: true })
      return true
    }

    if (message?.type === XSS_MSG_GET_OBSERVATIONS_FOR_TAB) {
      const tabId = message.tabId as number
      const limit = typeof message.limit === 'number' ? message.limit : 80
      const observations = XssExfilStore.getInstance().getObservationsByTabId(tabId, limit)
      sendResponse({ observations })
      return true
    }

    if (message?.type === XSS_MSG_GET_OBSERVATIONS) {
      const limit = typeof message.limit === 'number' ? message.limit : 50
      const observations = XssExfilStore.getInstance().getRecentObservations(limit)
      sendResponse({ observations })
      return true
    }

    return undefined
  })

  chrome.webRequest.onBeforeRequest.addListener(
    (details) => {
      if (details.tabId < 0) return

      const pageUrl = tabPageUrlById.get(details.tabId) ?? ''
      let pageHost = ''
      try {
        pageHost = pageUrl ? new URL(pageUrl).hostname : ''
      } catch {
        pageHost = ''
      }

      const destHost = hostFromUrl(details.url)
      XssExfilStore.getInstance().recordObservation({
        tabId: details.tabId,
        pageUrl,
        pageHost,
        source: 'webRequest',
        requestUrl: details.url,
        method: details.method,
        destHost,
        isThirdParty: isThirdPartyRequest(pageHost, destHost),
        resourceType: details.type,
      })

      void inspectThirdPartyCookies({
        ...details,
        requestBody: requestBodyText(details.requestBody),
      })

      return undefined
    },
    { urls: ['<all_urls>'] },
    ['requestBody'],
  )

  const observeHeaders = (details: chrome.webRequest.OnBeforeSendHeadersDetails) => {
    void inspectThirdPartyCookies(details)
  }
  const listener = observeHeaders as Parameters<typeof chrome.webRequest.onBeforeSendHeaders.addListener>[0]

  try {
    chrome.webRequest.onBeforeSendHeaders.addListener(
      listener,
      { urls: ['<all_urls>'] },
      ['requestHeaders', 'extraHeaders'],
    )
  } catch {
    chrome.webRequest.onBeforeSendHeaders.addListener(
      listener,
      { urls: ['<all_urls>'] },
      ['requestHeaders'],
    )
  }
}
