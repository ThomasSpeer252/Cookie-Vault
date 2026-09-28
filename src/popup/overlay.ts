export interface OverlayHandle {
    element: HTMLElement;
    close: () => void;
}

/** Remove all popup overlays and restore the home view focus state. */
export function closeAllOverlays(): void {
    const appContainer = document.getElementById('app');
    if (!appContainer) return;

    for (const element of [...appContainer.children]) {
        if (element instanceof HTMLElement && element.classList.contains('view-overlay')) {
            element.remove();
        }
    }

    for (const element of [...appContainer.children]) {
        if (element instanceof HTMLElement) {
            element.inert = false;
            element.removeAttribute('aria-hidden');
        }
    }
}

export function openOverlay(content: string): OverlayHandle | null {
    const appContainer = document.getElementById('app');
    if (!appContainer) return null;

    const backgroundElements = [...appContainer.children] as HTMLElement[];
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const overlay = document.createElement('div');
    overlay.className = 'view-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.innerHTML = content;

    let isClosed = false;
    const close = () => {
        if (isClosed) return;
        isClosed = true;

        document.removeEventListener('keydown', handleKeydown);
        overlay.remove();

        for (const element of backgroundElements) {
            element.inert = false;
            element.removeAttribute('aria-hidden');
        }

        previouslyFocused?.focus();
    };
    const handleKeydown = (event: KeyboardEvent) => {
        if (event.key === 'Escape') close();
    };

    for (const element of backgroundElements) {
        element.inert = true;
        element.setAttribute('aria-hidden', 'true');
    }

    appContainer.appendChild(overlay);
    document.addEventListener('keydown', handleKeydown);

    return { element: overlay, close };
}
