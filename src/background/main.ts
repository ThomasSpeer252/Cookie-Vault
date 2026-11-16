import { handleCookieChanged } from '../popup/auto_vault'
import { registerXssDetection } from './xss_detection'

chrome.cookies?.onChanged.addListener(handleCookieChanged)
chrome.permissions.onAdded.addListener(() => {
  chrome.cookies.onChanged.addListener(handleCookieChanged)
})

registerXssDetection()
