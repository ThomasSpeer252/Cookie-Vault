import { isThirdPartyRequest, XSS_HOOK_POST_MESSAGE } from '../xss/XssExfilStore'

function hostOf(url: string): string {
  try {
    return new URL(url, location.href).hostname
  } catch {
    return ''
  }
}

function previewBody(body: unknown): string | undefined {
  if (body == null) return undefined
  if (typeof body === 'string') return body.slice(0, 256)
  try {
    return JSON.stringify(body).slice(0, 256)
  } catch {
    return String(body).slice(0, 256)
  }
}

function emit(
  source: 'fetch' | 'xhr' | 'sendBeacon',
  detail: { requestUrl: string; method: string; bodyPreview?: string },
) {
  const destHost = hostOf(detail.requestUrl)
  window.postMessage({
    type: XSS_HOOK_POST_MESSAGE,
    payload: {
      source,
      pageUrl: location.href,
      pageHost: location.hostname,
      requestUrl: detail.requestUrl,
      method: detail.method,
      destHost,
      isThirdParty: isThirdPartyRequest(location.hostname, destHost),
      bodyPreview: detail.bodyPreview,
    },
  }, '*')
}

const nativeFetch = window.fetch.bind(window)
window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
  const url = typeof input === 'string'
    ? input
    : input instanceof URL
      ? input.href
      : input.url
  const method = (init?.method ?? (input instanceof Request ? input.method : 'GET')).toUpperCase()
  emit('fetch', { requestUrl: url, method, bodyPreview: previewBody(init?.body) })
  return nativeFetch(input, init)
}

const xhrOpen = XMLHttpRequest.prototype.open
const xhrSend = XMLHttpRequest.prototype.send

XMLHttpRequest.prototype.open = function open(
  method: string,
  url: string | URL,
  async?: boolean,
  username?: string | null,
  password?: string | null,
) {
  this.__xssMethod = method
  this.__xssUrl = typeof url === 'string' ? url : url.href
  return xhrOpen.call(this, method, url, async ?? true, username, password)
}

XMLHttpRequest.prototype.send = function send(body?: Document | XMLHttpRequestBodyInit | null) {
  emit('xhr', {
    requestUrl: this.__xssUrl ?? '',
    method: (this.__xssMethod ?? 'GET').toUpperCase(),
    bodyPreview: previewBody(body),
  })
  return xhrSend.call(this, body)
}

if (navigator.sendBeacon) {
  const nativeBeacon = navigator.sendBeacon.bind(navigator)
  navigator.sendBeacon = (url: string | URL, data?: BodyInit | null) => {
    const requestUrl = typeof url === 'string' ? url : url.href
    emit('sendBeacon', { requestUrl, method: 'POST', bodyPreview: previewBody(data) })
    return nativeBeacon(url, data)
  }
}

declare global {
  interface XMLHttpRequest {
    __xssMethod?: string
    __xssUrl?: string
  }
}

export {}
