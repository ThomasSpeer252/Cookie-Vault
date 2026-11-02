export function cookieNamesFromHeader(header: string | undefined): string[] {
    if (!header) return [];

    const names: string[] = [];
    for (const part of header.split(';')) {
        const name = part.split('=')[0]?.trim();
        if (name) names.push(name);
    }
    return names;
}

export function cookieHeaderFromRequest(
    headers: chrome.webRequest.HttpHeader[] | undefined,
): string | undefined {
    return headers?.find(header => header.name.toLowerCase() === 'cookie')?.value;
}
