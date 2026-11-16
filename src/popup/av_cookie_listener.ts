import { handleCookieChanged } from './auto_vault';

// Background worker that listens for new cookies while the popup is not open
chrome.cookies?.onChanged.addListener(handleCookieChanged);
chrome.permissions.onAdded.addListener(() => {
  chrome.cookies.onChanged.addListener(handleCookieChanged);
});