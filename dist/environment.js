export class BrowserEnvironment {
    constructor(win) {
        if (typeof window !== 'undefined') {
            this.win = win ?? window;
            this.doc = this.win.document;
        }
        else {
            this.win = win;
            this.doc = win?.document;
        }
    }
    isBrowser() {
        return !!this.win && !!this.doc;
    }
    getFetch() {
        return this.win?.fetch ?? (typeof fetch === 'function' ? fetch.bind(globalThis) : undefined);
    }
    getCurrentHref() {
        try {
            return this.win?.location?.href ?? null;
        }
        catch {
            return null;
        }
    }
    replaceUrl(url) {
        if (!this.win || !this.doc) {
            return;
        }
        try {
            const history = this.win.history;
            history.replaceState(history.state, this.doc.title, url);
        }
        catch {
            /* noop */
        }
    }
    subscribeToNavigation(onChange) {
        if (!this.win) {
            return () => { };
        }
        const handler = () => onChange();
        try {
            this.win.addEventListener('popstate', handler);
            this.win.addEventListener('hashchange', handler);
        }
        catch {
            return () => { };
        }
        return () => {
            try {
                this.win?.removeEventListener('popstate', handler);
                this.win?.removeEventListener('hashchange', handler);
            }
            catch {
                /* noop */
            }
        };
    }
    buildDevicePayload(sendDeviceInfo) {
        if (!sendDeviceInfo || !this.win) {
            return undefined;
        }
        const device = { platform: 'web' };
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
                const connection = nav.connection;
                if (connection && typeof connection.effectiveType === 'string') {
                    device.connection = connection.effectiveType;
                }
            }
        }
        catch {
            /* noop */
        }
        try {
            const tz = this.win.Intl?.DateTimeFormat?.().resolvedOptions().timeZone;
            if (tz) {
                device.timezone = tz;
            }
        }
        catch {
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
        }
        catch {
            /* noop */
        }
        return device;
    }
}
//# sourceMappingURL=environment.js.map