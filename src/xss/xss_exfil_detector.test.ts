import { describe, expect, it } from 'vitest'
import { cookieNamesFromHeader } from './cookie_header'
import { detectCookieExfil } from './xss_exfil_detector'
import { isAuthSessionCookie } from '../cookies/auth_session_cookie'

describe('cookie header and exfil detection', () => {
  it('reads cookie names from a Cookie header', () => {
    expect(cookieNamesFromHeader('PHPSESSID=abc; uid=1')).toEqual(['PHPSESSID', 'uid'])
  })

  it('treats PHPSESSID as a session cookie and skips infrastructure names', () => {
    expect(isAuthSessionCookie({ name: 'PHPSESSID' })).toBe(true)
    expect(isAuthSessionCookie({ name: 'ipv6' })).toBe(false)
    expect(isAuthSessionCookie({ name: '_EDGE_S' })).toBe(false)
  })

  it('raises a possible XSS hit when a session cookie is sent third-party', () => {
    expect(detectCookieExfil({
      isThirdParty: true,
      destHost: 'attacker.com',
      sentCookieNames: ['PHPSESSID', 'theme'],
      siteCookies: [{ name: 'PHPSESSID' }, { name: 'theme' }, { name: 'other' }],
    })).toEqual({
      kind: 'xss',
      cookieNames: ['PHPSESSID'],
      destHost: 'attacker.com',
    })
  })

  it('ignores non-session cookies sent to a third party', () => {
    expect(detectCookieExfil({
      isThirdParty: true,
      destHost: 'ads.example.net',
      sentCookieNames: ['theme'],
      siteCookies: [{ name: 'theme', value: 'dark' }],
      requestUrl: 'https://ads.example.net/?in=theme%3Ddark',
    })).toBeNull()
  })

  it('raises a possible XSS hit when the session cookie value is in a third-party URL', () => {
    const requestUrl = 'https://attacker.com/?in=' + encodeURIComponent('PHPSESSID=lab-session-123; theme=dark')
    expect(detectCookieExfil({
      isThirdParty: true,
      destHost: 'attacker.com',
      sentCookieNames: [],
      requestUrl,
      siteCookies: [
        { name: 'PHPSESSID', value: 'lab-session-123' },
        { name: 'theme', value: 'dark' },
      ],
    })).toEqual({
      kind: 'xss',
      cookieNames: ['PHPSESSID'],
      destHost: 'attacker.com',
    })
  })

  it('decodes a url-encoded POST body before matching the session cookie', () => {
    const requestBody = 'in=' + encodeURIComponent('PHPSESSID=lab-session-123; theme=dark').replace(/%20/g, '+')
    expect(detectCookieExfil({
      isThirdParty: true,
      destHost: 'attacker.com',
      sentCookieNames: [],
      requestBody,
      siteCookies: [
        { name: 'PHPSESSID', value: 'lab-session-123' },
        { name: 'theme', value: 'dark' },
      ],
    })).toEqual({
      kind: 'xss',
      cookieNames: ['PHPSESSID'],
      destHost: 'attacker.com',
    })
  })

  it('ignores first-party requests and cookies that do not belong to the page', () => {
    expect(detectCookieExfil({
      isThirdParty: false,
      destHost: 'api.example.com',
      sentCookieNames: ['PHPSESSID'],
      siteCookies: [{ name: 'PHPSESSID' }],
    })).toBeNull()

    expect(detectCookieExfil({
      isThirdParty: true,
      destHost: 'attacker.com',
      sentCookieNames: ['unrelated'],
      siteCookies: [{ name: 'PHPSESSID' }],
    })).toBeNull()
  })
})
