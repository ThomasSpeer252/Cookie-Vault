import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { isThirdPartyRequest, XssExfilStore } from './XssExfilStore'

describe('XssExfilStore', () => {
  let store: XssExfilStore

  beforeEach(() => {
    store = XssExfilStore.getInstance()
    store.init({ ringMax: 3 })
  })

  afterEach(() => {
    store.clear()
  })

  it('returns the same instance', () => {
    expect(XssExfilStore.getInstance()).toBe(store)
  })

  it('trims the ring to ringMax', () => {
    for (let i = 0; i < 5; i += 1) {
      store.recordObservation({
        tabId: 1,
        pageUrl: 'https://example.com',
        pageHost: 'example.com',
        source: 'fetch',
        requestUrl: `https://example.com/${i}`,
        method: 'GET',
        destHost: 'example.com',
        isThirdParty: false,
      })
    }
    expect(store.getRecentObservations(10)).toHaveLength(3)
    expect(store.getRecentObservations(1)[0]?.requestUrl).toBe('https://example.com/4')
  })

  it('treats subdomains on the same registrable domain as first party', () => {
    expect(isThirdPartyRequest('www.example.com', 'api.example.com')).toBe(false)
    expect(isThirdPartyRequest('example.com', 'cdn.example.com')).toBe(false)
    expect(isThirdPartyRequest('example.com', 'evil.com')).toBe(true)
  })

  it('filters by tab id', () => {
    store.recordObservation({
      tabId: 1,
      pageUrl: 'https://a.com',
      pageHost: 'a.com',
      source: 'fetch',
      requestUrl: 'https://a.com/1',
      method: 'GET',
      destHost: 'a.com',
      isThirdParty: false,
    })
    store.recordObservation({
      tabId: 2,
      pageUrl: 'https://b.com',
      pageHost: 'b.com',
      source: 'fetch',
      requestUrl: 'https://b.com/1',
      method: 'GET',
      destHost: 'b.com',
      isThirdParty: false,
    })
    expect(store.getObservationsByTabId(2)).toHaveLength(1)
  })
})
