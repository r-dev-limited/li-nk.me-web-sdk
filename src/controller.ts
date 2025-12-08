import { BrowserEnvironment, type LinkMeEnvironment } from './environment.js';
import { normalizeConfig } from './config.js';
import { extractCid, isSameOrigin, parseUrl } from './url.js';
import { normalizePayload } from './payload.js';
import type { LinkListener, LinkMePayload, LinkMeWebConfig, NormalizedConfig, FetchLike } from './types.js';
import { FetchHttpClient, type HttpClient, type HttpRequestInit, requestJson } from './httpClient.js';

type ProcessUrlOptions = {
    stripLocation?: boolean;
};

type JsonMap = Record<string, any>;

export interface LinkMeControllerDeps {
    environment?: LinkMeEnvironment;
    httpClientFactory?: (fetchImpl: FetchLike) => HttpClient;
}

export class LinkMeController {
    private readonly environment: LinkMeEnvironment;
    private readonly httpClientFactory: (fetchImpl: FetchLike) => HttpClient;

    private config?: NormalizedConfig;
    private httpClient?: HttpClient;
    private lastPayload: LinkMePayload | null = null;
    private readonly listeners = new Set<LinkListener>();
    private userId?: string;
    private readonly seenCids = new Set<string>();
    private unsubscribeNavigation: (() => void) | null = null;

    constructor(deps?: LinkMeControllerDeps) {
        this.environment = deps?.environment ?? new BrowserEnvironment();
        this.httpClientFactory = deps?.httpClientFactory ?? ((fetchImpl) => new FetchHttpClient(fetchImpl));
    }

    private debugLog(message: string, data?: Record<string, any>): void {
        if (!this.config?.debug) {
            return;
        }
        if (typeof console !== 'undefined' && typeof console.log === 'function') {
            if (data) {
                console.log('[LinkMe]', message, data);
            } else {
                console.log('[LinkMe]', message);
            }
        }
    }

    async configure(config: LinkMeWebConfig): Promise<void> {
        const normalized = normalizeConfig(config, this.environment);
        const fetchImpl = config.fetch ?? this.environment.getFetch();
        if (typeof fetchImpl !== 'function') {
            throw new Error('fetch is not available; provide config.fetch');
        }
        this.config = normalized;
        this.httpClient = this.httpClientFactory(fetchImpl);
        this.debugLog('configured', {
            baseUrl: normalized.baseUrl,
            appId: normalized.appId ?? null,
            autoResolve: normalized.autoResolve,
            autoListen: normalized.autoListen,
        });
        this.detachNavigation();
        if (normalized.autoListen) {
            this.debugLog('navigation.listen');
            this.unsubscribeNavigation = this.environment.subscribeToNavigation(() => {
                void this.resolveFromUrl();
            });
        }
        if (normalized.autoResolve) {
            this.debugLog('autoResolve.start');
            await this.resolveFromUrl(undefined, { stripLocation: true });
        }
    }

    async resolveFromUrl(url?: string, opts?: ProcessUrlOptions): Promise<LinkMePayload | null> {
        const cfg = this.config;
        if (!cfg) {
            return null;
        }
        const targetUrl = url ?? this.environment.getCurrentHref();
        return await this.processUrl(targetUrl, { stripLocation: opts?.stripLocation ?? url === undefined });
    }

    async handleLink(url: string): Promise<LinkMePayload | null> {
        return await this.processUrl(url, { stripLocation: false });
    }

    async claimDeferredIfAvailable(): Promise<LinkMePayload | null> {
        const cfg = this.config;
        if (!cfg || !this.httpClient) {
            return null;
        }
        this.debugLog('deferred.claim.start');
        try {
            const body: JsonMap = { platform: 'web' };
            const device = this.environment.buildDevicePayload(cfg.sendDeviceInfo);
            if (device) {
                body.device = device;
            }
            const headers = this.buildHeaders(true);
            const res = await requestJson<JsonMap>(this.httpClient, `${cfg.apiBaseUrl}/deferred/claim`, {
                method: 'POST',
                headers,
                body: JSON.stringify(body),
            });
            if (!res.ok || !res.data) {
                this.debugLog('deferred.claim.http_error', { status: res.status });
                return null;
            }
            const payload = normalizePayload(res.data);
            if (payload) {
                this.emit(payload);
                this.debugLog('deferred.claim.success', { cid: payload.cid ?? null, duplicate: payload.duplicate ?? false });
            } else {
                this.debugLog('deferred.claim.empty');
            }
            return payload;
        } catch (err) {
            this.debugLog('deferred.claim.error', { error: err instanceof Error ? err.message : String(err) });
            return null;
        }
    }

    setUserId(userId: string): void {
        this.userId = userId;
    }

    async track(event: string, properties?: Record<string, any>): Promise<void> {
        const cfg = this.config;
        if (!cfg || !this.httpClient || !event) {
            return;
        }
        try {
            const body: JsonMap = {
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
        } catch {
            /* noop */
        }
    }

    onLink(listener: LinkListener): { remove: () => void } {
        this.listeners.add(listener);
        return {
            remove: () => {
                this.listeners.delete(listener);
            },
        };
    }

    getLastPayload(): LinkMePayload | null {
        return this.lastPayload;
    }

    private async processUrl(rawUrl: string | null | undefined, opts: ProcessUrlOptions): Promise<LinkMePayload | null> {
        const cfg = this.config;
        if (!cfg || !this.httpClient || !rawUrl) {
            return null;
        }
        this.debugLog('processUrl.start', { url: rawUrl });
        const parsed = parseUrl(rawUrl, cfg.origin);
        if (!parsed) {
            this.debugLog('processUrl.parse_failed', { url: rawUrl });
            return null;
        }
        const extraction = extractCid(parsed);
        if (extraction.cid) {
            this.debugLog('processUrl.cid_detected', { cid: extraction.cid });
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
                this.debugLog('processUrl.cid_success', { cid: extraction.cid });
            } else {
                this.debugLog('processUrl.cid_miss', { cid: extraction.cid });
            }
            return payload;
        }
        if (cfg.resolveUniversalLinks && isSameOrigin(parsed.origin, cfg.origin)) {
            this.debugLog('processUrl.universal', { url: parsed.href });
            const payload = await this.resolveUniversalLink(parsed.href);
            if (payload) {
                this.emit(payload);
                this.debugLog('processUrl.universal_success', { url: parsed.href });
                return payload;
            } else {
                this.debugLog('processUrl.universal_miss', { url: parsed.href });
            }
        }
        return null;
    }

    private async resolveCid(cid: string): Promise<LinkMePayload | null> {
        const cfg = this.config;
        if (!cfg || !this.httpClient) {
            return null;
        }
        this.debugLog('resolveCid.request', { cid });
        try {
            const headers = this.buildHeaders(false);
            const device = this.environment.buildDevicePayload(cfg.sendDeviceInfo);
            if (device) {
                headers['x-linkme-device'] = JSON.stringify(device);
            }
            const res = await requestJson<JsonMap>(this.httpClient, `${cfg.apiBaseUrl}/deeplink?cid=${encodeURIComponent(cid)}`, {
                method: 'GET',
                headers,
            });
            if (!res.ok || !res.data) {
                this.debugLog('resolveCid.http_error', { cid, status: res.status });
                return null;
            }
            const payload = normalizePayload(res.data, cid);
            this.debugLog('resolveCid.success', { cid, resolved: payload != null });
            return payload;
        } catch (err) {
            this.debugLog('resolveCid.error', { cid, error: err instanceof Error ? err.message : String(err) });
            return null;
        }
    }

    private async resolveUniversalLink(url: string): Promise<LinkMePayload | null> {
        const cfg = this.config;
        if (!cfg || !this.httpClient) {
            return null;
        }
        this.debugLog('resolveUniversal.request', { url });
        try {
            const body: JsonMap = { url };
            const device = this.environment.buildDevicePayload(cfg.sendDeviceInfo);
            if (device) {
                body.device = device;
            }
            const res = await requestJson<JsonMap>(this.httpClient, `${cfg.apiBaseUrl}/deeplink/resolve-url`, {
                method: 'POST',
                headers: this.buildHeaders(true),
                body: JSON.stringify(body),
            });
            if (!res.ok || !res.data) {
                this.debugLog('resolveUniversal.http_error', { url, status: res.status });
                return null;
            }
            const payload = normalizePayload(res.data);
            this.debugLog('resolveUniversal.success', { url, resolved: payload != null });
            return payload;
        } catch (err) {
            this.debugLog('resolveUniversal.error', { url, error: err instanceof Error ? err.message : String(err) });
            return null;
        }
    }

    private buildHeaders(includeContentType: boolean): Record<string, string> {
        const headers: Record<string, string> = { Accept: 'application/json' };
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

    private emit(payload: LinkMePayload): void {
        this.lastPayload = payload;
        for (const listener of this.listeners) {
            try {
                listener(payload);
            } catch {
                /* noop */
            }
        }
    }

    private detachNavigation(): void {
        try {
            this.unsubscribeNavigation?.();
        } catch {
            /* noop */
        }
        this.unsubscribeNavigation = null;
    }
}
