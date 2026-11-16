export function requestBodyText(body: chrome.webRequest.OnBeforeRequestDetails['requestBody']): string {
    if (!body) return '';

    const parts: string[] = [];
    if (body.formData) {
        for (const [name, values] of Object.entries(body.formData)) {
            for (const value of values ?? []) {
                if (typeof value === 'string') parts.push(`${name}=${value}`);
            }
        }
    }
    if (body.raw) {
        const decoder = new TextDecoder();
        for (const part of body.raw) {
            if (part.bytes) parts.push(decoder.decode(part.bytes));
        }
    }
    return parts.join('&');
}
