import { BrowserEnvironment } from './environment.js';
import { normalizeConfig } from './config.js';
import { extractCid, isSameOrigin, parseUrl } from './url.js';
import { normalizePayload } from './payload.js';
import { FetchHttpClient, requestJson } from './httpClient.js';
export class LinkMeController {
    constructor(deps) {
        this.lastPayload = null;
        this.listeners = new Set();
        this.seenCids = new Set();
        this.unsubscribeNavigation = null;
        this.environment = deps?.environment ?? new BrowserEnvironment();
        this.httpClientFactory = deps?.httpClientFactory ?? ((fetchImpl) => new FetchHttpClient(fetchImpl));
    }
    async configure(config) {
        const normalized = normalizeConfig(config, this.environment);
        const fetchImpl = config.fetch ?? this.environment.getFetch();
        if (typeof fetchImpl !== 'function') {
            throw new Error('fetch is not available; provide config.fetch');
        }
        this.config = normalized;
        this.httpClient = this.httpClientFactory(fetchImpl);
        this.detachNavigation();
        if (normalized.autoListen) {
            this.unsubscribeNavigation = this.environment.subscribeToNavigation(() => {
                void this.resolveFromUrl();
            });
        }
        if (normalized.autoResolve) {
            await this.resolveFromUrl(undefined, { stripLocation: true });
        }
    }
    async resolveFromUrl(url, opts) {
        const cfg = this.config;
        if (!cfg) {
            return null;
        }
        const targetUrl = url ?? this.environment.getCurrentHref();
        return await this.processUrl(targetUrl, { stripLocation: opts?.stripLocation ?? url === undefined });
    }
    async handleLink(url) {
        return await this.processUrl(url, { stripLocation: false });
    }
    async claimDeferredIfAvailable() {
        const cfg = this.config;
        if (!cfg || !this.httpClient) {
            return null;
        }
        try {
            const body = { platform: 'web' };
            const device = this.environment.buildDevicePayload(cfg.sendDeviceInfo);
            if (device) {
                body.device = device;
            }
            const headers = this.buildHeaders(true);
            const res = await requestJson(this.httpClient, `${cfg.apiBaseUrl}/deferred/claim`, {
                method: 'POST',
                headers,
                body: JSON.stringify(body),
            });
            if (!res.ok || !res.data) {
                return null;
            }
            const payload = normalizePayload(res.data);
            if (payload) {
                this.emit(payload);
            }
            return payload;
        }
        catch {
            return null;
        }
    }
    setUserId(userId) {
        this.userId = userId;
    }
    async track(event, properties) {
        const cfg = this.config;
        if (!cfg || !this.httpClient || !event) {
            return;
        }
        try {
            const body = {
                event,
                platform: 'web',
                timestamp: Math.floor(Date.now() / 1000),
            };
            if (this.userId) {
                body.userId = this.userId;
            }
            if (properties && typeof properties === 'object') {
                body.props = properties;
            }
            await this.httpClient.request(`${cfg.apiBaseUrl}/app-events`, {
                method: 'POST',
                headers: this.buildHeaders(true),
                body: JSON.stringify(body),
            });
        }
        catch {
            /* noop */
        }
    }
    onLink(listener) {
        this.listeners.add(listener);
        return {
            remove: () => {
                this.listeners.delete(listener);
            },
        };
    }
    getLastPayload() {
        return this.lastPayload;
    }
    async processUrl(rawUrl, opts) {
        const cfg = this.config;
        if (!cfg || !this.httpClient || !rawUrl) {
            return null;
        }
        const parsed = parseUrl(rawUrl, cfg.origin);
        if (!parsed) {
            return null;
        }
        const extraction = extractCid(parsed);
        if (extraction.cid) {
            if (this.seenCids.has(extraction.cid)) {
                const cached = this.lastPayload;
                if (cached && cached.cid === extraction.cid) {
                    return cached;
                }
            }
            const payload = await this.resolveCid(extraction.cid);
            if (payload) {
                payload.cid = payload.cid ?? extraction.cid;
                this.seenCids.add(extraction.cid);
                if (opts.stripLocation && extraction.sanitizedHref) {
                    this.environment.replaceUrl(extraction.sanitizedHref);
                }
                this.emit(payload);
            }
            return payload;
        }
        if (cfg.resolveUniversalLinks && isSameOrigin(parsed.origin, cfg.origin)) {
            const payload = await this.resolveUniversalLink(parsed.href);
            if (payload) {
                this.emit(payload);
                return payload;
            }
        }
        return null;
    }
    async resolveCid(cid) {
        const cfg = this.config;
        if (!cfg || !this.httpClient) {
            return null;
        }
        try {
            const headers = this.buildHeaders(false);
            const device = this.environment.buildDevicePayload(cfg.sendDeviceInfo);
            if (device) {
                headers['x-linkme-device'] = JSON.stringify(device);
            }
            const res = await requestJson(this.httpClient, `${cfg.apiBaseUrl}/deeplink?cid=${encodeURIComponent(cid)}`, {
                method: 'GET',
                headers,
            });
            if (!res.ok || !res.data) {
                return null;
            }
            return normalizePayload(res.data, cid);
        }
        catch {
            return null;
        }
    }
    async resolveUniversalLink(url) {
        const cfg = this.config;
        if (!cfg || !this.httpClient) {
            return null;
        }
        try {
            const body = { url };
            const device = this.environment.buildDevicePayload(cfg.sendDeviceInfo);
            if (device) {
                body.device = device;
            }
            const res = await requestJson(this.httpClient, `${cfg.apiBaseUrl}/deeplink/resolve-url`, {
                method: 'POST',
                headers: this.buildHeaders(true),
                body: JSON.stringify(body),
            });
            if (!res.ok || !res.data) {
                return null;
            }
            return normalizePayload(res.data);
        }
        catch {
            return null;
        }
    }
    buildHeaders(includeContentType) {
        const headers = { Accept: 'application/json' };
        if (includeContentType) {
            headers['Content-Type'] = 'application/json';
        }
        if (this.config?.appId) {
            headers['x-app-id'] = this.config.appId;
        }
        if (this.config?.appKey) {
            headers['x-api-key'] = this.config.appKey;
        }
        return headers;
    }
    emit(payload) {
        this.lastPayload = payload;
        for (const listener of this.listeners) {
            try {
                listener(payload);
            }
            catch {
                /* noop */
            }
        }
    }
    detachNavigation() {
        try {
            this.unsubscribeNavigation?.();
        }
        catch {
            /* noop */
        }
        this.unsubscribeNavigation = null;
    }
}
//# sourceMappingURL=controller.js.map