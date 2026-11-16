import type { XssAlertKind } from './xss_exfil_detector';

export const XSS_TAB_ALERT = 'XSS_TAB_ALERT';

export interface XssTabAlertPayload {
    kind: XssAlertKind;
    cookieNames: string[];
    destHost: string;
}
