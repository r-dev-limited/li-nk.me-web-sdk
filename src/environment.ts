import type { FetchLike } from './types.js';

export interface LinkMeEnvironment {
    isBrowser(): boolean;
    getFetch(): FetchLike | undefined;
    getCurrentHref(): string | null;
    replaceUrl(url: string): void;
    subscribeToNavigation(onChange: () => void): () => void;
    buildDevicePayload(sendDeviceInfo: boolean): Record<string, any> | undefined;
}

export class BrowserEnvironment implements LinkMeEnvironment {
    private readonly win: (Window & typeof globalThis) | undefined;
    private readonly doc: Document | undefined;

    constructor(win?: Window & typeof globalThis) {
        if (typeof window !== 'undefined') {
            this.win = win ?? window;
            this.doc = this.win.document;
        } else {
            this.win = win;
            this.doc = win?.document;
        }
    }

    isBrowser(): boolean {
        return !!this.win && !!this.doc;
    }

    getFetch(): FetchLike | undefined {
        return this.win?.fetch ?? (typeof fetch === 'function' ? fetch.bind(globalThis) : undefined);
    }

    getCurrentHref(): string | null {
        try {
            return this.win?.location?.href ?? null;
        } catch {
            return null;
        }
    }

    replaceUrl(url: string): void {
        if (!this.win || !this.doc) {
            return;
        }
        try {
            const history = this.win.history;
            history.replaceState(history.state, this.doc.title, url);
        } catch {
            /* noop */
        }
    }

    subscribeToNavigation(onChange: () => void): () => void {
        if (!this.win) {
            return () => {};
        }
        const handler = () => onChange();
        try {
            this.win.addEventListener('popstate', handler);
            this.win.addEventListener('hashchange', handler);
        } catch {
            return () => {};
        }
        return () => {
            try {
                this.win?.removeEventListener('popstate', handler);
                this.win?.removeEventListener('hashchange', handler);
            } catch {
                /* noop */
            }
        };
    }

    buildDevicePayload(sendDeviceInfo: boolean): Record<string, any> | undefined {
        if (!sendDeviceInfo || !this.win) {
            return undefined;
        }
        const device: Record<string, any> = { platform: 'web' };
        try {
            const nav = this.win.navigator;
            if (nav) {
                if (typeof nav.userAgent === 'string') {
                    device.userAgent = nav.userAgent;
                }
                if (typeof nav.language === 'string') {
                    device.locale = nav.language;
                }
                if (Array.isArray(nav.languages) && nav.languages.length > 0) {
                    device.preferredLocales = nav.languages;
                }
                const connection = (nav as any).connection;
                if (connection && typeof connection.effectiveType === 'string') {
                    device.connection = connection.effectiveType;
                }
            }
        } catch {
            /* noop */
        }
        try {
            const tz = this.win.Intl?.DateTimeFormat?.().resolvedOptions().timeZone;
            if (tz) {
                device.timezone = tz;
            }
        } catch {
            /* noop */
        }
        try {
            const screenInfo = this.win.screen;
            if (screenInfo) {
                device.screen = {
                    width: screenInfo.width,
                    height: screenInfo.height,
                    pixelRatio: this.win.devicePixelRatio ?? 1,
                };
            }
        } catch {
            /* noop */
        }
        return device;
    }
}
