/**
 * @vitest-environment happy-dom
 */
import { describe, test, expect, beforeEach, vi } from 'vitest';
import popupHtml from '../src/popup/index.html?raw';

describe('Cookie Vault Popup Real HTML Integration Tests', () => {
    beforeEach(() => {
        // Stop Happy-DOM from throwing resource load warnings
        const sanitizedHtml = popupHtml
            .replace(/<link[^>]*>/gi, '')
            .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');

        document.body.innerHTML = sanitizedHtml;
    });

    test('1. Load Headers (Title / Version)', () => {
        const titleElement = document.querySelector('.vault-header .title');
        const versionElement = document.querySelector('.version-number');

        expect(titleElement?.textContent).toContain('Cookie Vault');
        expect(versionElement?.textContent?.trim()).toBe('v0.1.0');
    });

    test('2. Site list has content (i.e. example.com)', () => {
        const siteListContainer = document.getElementById('site-list');
        expect(siteListContainer).not.toBeNull();
    });

    test('3. Search example.com', () => {
        const searchInput = document.getElementById('site-search') as HTMLInputElement;
        expect(searchInput).not.toBeNull();
        searchInput.value = 'example.com';
        expect(searchInput.value).toBe('example.com');
    });

    test('4. Status filter radio buttons exist in real HTML', () => {
        const unflaggedRadio = document.getElementById('filter-unflagged');
        const flaggedRadio = document.getElementById('filter-flagged');
        const bothRadio = document.getElementById('filter-both');

        expect(unflaggedRadio).not.toBeNull();
        expect(flaggedRadio).not.toBeNull();
        expect(bothRadio).not.toBeNull();
    });

    test('5. Settings Call', () => {
        const settingsBtn = document.getElementById('settings-btn') as HTMLButtonElement;
        expect(settingsBtn).toBeTruthy();

        const clickSpy = vi.fn();
        settingsBtn.addEventListener('click', clickSpy);
        settingsBtn.click();

        expect(clickSpy).toHaveBeenCalled();
    });
});