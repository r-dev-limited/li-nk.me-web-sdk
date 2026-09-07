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

const UTM_KEYS = new Set([
    'utm_source',
    'utm_medium',
    'utm_campaign',
    'utm_term',
    'utm_content',
    'utm_id',
    'utm_source_platform',
    'utm_creative_format',
    'utm_marketing_tactic',
    'tags',
]);

function splitSearchParams(searchParams: URLSearchParams): { params?: Record<string, string>; utm?: Record<string, string> } {
    const params: Record<string, string> = {};
    const utm: Record<string, string> = {};
    for (const [key, value] of searchParams.entries()) {
        if (UTM_KEYS.has(key)) {
            utm[key] = value;
        } else {
            params[key] = value;
        }
    }
    return {
        params: Object.keys(params).length ? params : undefined,
        utm: Object.keys(utm).length ? utm : undefined,
    };
}

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
    /**
     * Monotonically increasing lifecycle token. Requests started under an
     * earlier configuration must never publish results into a newer one.
     */
    private generation = 0;

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
        const generation = ++this.generation;
        const normalized = normalizeConfig(config, this.environment);
        const fetchImpl = config.fetch ?? this.environment.getFetch();
        if (typeof fetchImpl !== 'function') {
            throw new Error('fetch is not available; provide config.fetch');
        }
        this.config = normalized;
        this.httpClient = this.httpClientFactory(fetchImpl);
        this.lastPayload = null;
        this.seenCids.clear();
        this.userId = undefined;
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
                void this.resolveFromUrl(undefined, { stripLocation: normalized.stripCid });
            });
        }
        if (normalized.autoResolve) {
            this.debugLog('autoResolve.start');
            const targetUrl = this.environment.getCurrentHref();
            await this.processUrl(targetUrl, { stripLocation: normalized.stripCid }, generation);
        }
    }

    async resolveFromUrl(url?: string, opts?: ProcessUrlOptions): Promise<LinkMePayload | null> {
        const cfg = this.config;
        const generation = this.generation;
        if (!cfg) {
            return null;
        }
        const targetUrl = url ?? this.environment.getCurrentHref();
        return await this.processUrl(targetUrl, { stripLocation: opts?.stripLocation ?? cfg.stripCid }, generation);
    }

    async handleLink(url: string): Promise<LinkMePayload | null> {
        return await this.processUrl(url, { stripLocation: false }, this.generation);
    }

    async claimDeferredIfAvailable(): Promise<LinkMePayload | null> {
        const cfg = this.config;
        const httpClient = this.httpClient;
        const generation = this.generation;
        if (!cfg || !httpClient) {
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
            const res = await requestJson<JsonMap>(httpClient, `${cfg.apiBaseUrl}/deferred/claim`, {
                method: 'POST',
                headers,
                body: JSON.stringify(body),
            });
            if (!this.isCurrent(generation, cfg, httpClient)) {
                return null;
            }
            if (!res.ok || !res.data) {
                this.debugLog('deferred.claim.http_error', { status: res.status });
                return null;
            }
            const payload = normalizePayload(res.data);
            if (payload) {
                if (payload.isLinkMe === undefined) {
                    payload.isLinkMe = true;
                }
                if (!this.handleForcedWebRedirect(payload)) {
                    this.emit(payload);
                }
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

    setUserId(userId: string | null): void {
        this.userId = userId ?? undefined;
    }

    async track(event: string, properties?: Record<string, any>): Promise<void> {
        const cfg = this.config;
        if (!cfg || !this.httpClient || !event) {
            return;
        }
        try {
            const body: JsonMap = {
                type: event,
                platform: 'web',
                timestamp: Math.floor(Date.now() / 1000),
            };
            if (this.lastPayload?.cid) {
                body.cid = this.lastPayload.cid;
            }
            if (this.lastPayload?.linkId) {
                body.linkId = this.lastPayload.linkId;
            }
            if (this.userId) {
                body.userId = this.userId;
            }
            if (properties && typeof properties === 'object') {
                body.detail = JSON.stringify(properties);
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

    dispose(): void {
        this.generation += 1;
        this.detachNavigation();
        this.listeners.clear();
        this.httpClient = undefined;
        this.config = undefined;
        this.lastPayload = null;
        this.seenCids.clear();
        this.userId = undefined;
    }

    private async processUrl(rawUrl: string | null | undefined, opts: ProcessUrlOptions, generation: number): Promise<LinkMePayload | null> {
        const cfg = this.config;
        const httpClient = this.httpClient;
        if (!cfg || !httpClient || !rawUrl || !this.isCurrent(generation, cfg, httpClient)) {
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
            const payload = await this.resolveCid(extraction.cid, cfg, httpClient);
            if (!this.isCurrent(generation, cfg, httpClient)) {
                return null;
            }
            if (payload) {
                payload.cid = payload.cid ?? extraction.cid;
                this.seenCids.add(extraction.cid);
                if (opts.stripLocation && extraction.sanitizedHref) {
                    this.environment.replaceUrl(extraction.sanitizedHref);
                }
                if (!this.handleForcedWebRedirect(payload)) {
                    this.emit(payload);
                }
                this.debugLog('processUrl.cid_success', { cid: extraction.cid });
            } else {
                this.debugLog('processUrl.cid_miss', { cid: extraction.cid });
            }
            return payload;
        }
        if (cfg.resolveUniversalLinks && isSameOrigin(parsed.origin, cfg.origin)) {
            this.debugLog('processUrl.universal', { url: parsed.href });
            const payload = await this.resolveUniversalLink(parsed.href, cfg, httpClient);
            if (!this.isCurrent(generation, cfg, httpClient)) {
                return null;
            }
            if (payload) {
                if (!this.handleForcedWebRedirect(payload)) {
                    this.emit(payload);
                }
                this.debugLog('processUrl.universal_success', { url: parsed.href });
                return payload;
            } else {
                this.debugLog('processUrl.universal_miss', { url: parsed.href });
            }
        }
        return null;
    }

    private async resolveCid(cid: string, cfg: NormalizedConfig, httpClient: HttpClient): Promise<LinkMePayload | null> {
        this.debugLog('resolveCid.request', { cid });
        try {
            const headers = this.buildHeaders(false);
            const device = this.environment.buildDevicePayload(cfg.sendDeviceInfo);
            if (device) {
                headers['x-linkme-device'] = JSON.stringify(device);
            }
            const res = await requestJson<JsonMap>(httpClient, `${cfg.apiBaseUrl}/deeplink?cid=${encodeURIComponent(cid)}`, {
                method: 'GET',
                headers,
            });
            if (!res.ok || !res.data) {
                this.debugLog('resolveCid.http_error', { cid, status: res.status });
                return null;
            }
            const payload = normalizePayload(res.data, cid);
            if (payload && payload.isLinkMe === undefined) {
                payload.isLinkMe = true;
            }
            this.debugLog('resolveCid.success', { cid, resolved: payload != null });
            return payload;
        } catch (err) {
            this.debugLog('resolveCid.error', { cid, error: err instanceof Error ? err.message : String(err) });
            return null;
        }
    }

    private async resolveUniversalLink(url: string, cfg: NormalizedConfig, httpClient: HttpClient): Promise<LinkMePayload | null> {
        this.debugLog('resolveUniversal.request', { url });
        try {
            const body: JsonMap = { url };
            const device = this.environment.buildDevicePayload(cfg.sendDeviceInfo);
            if (device) {
                body.device = device;
            }
            const res = await requestJson<JsonMap>(httpClient, `${cfg.apiBaseUrl}/deeplink/resolve-url`, {
                method: 'POST',
                headers: this.buildHeaders(true),
                body: JSON.stringify(body),
            });
            if (!res.ok || !res.data) {
                const errorCode = (res.data as any)?.error;
                if (errorCode === 'domain_not_found') {
                    const parsed = parseUrl(url, cfg.origin);
                    if (parsed) {
                        const fallback = this.buildBasicUniversalPayload(parsed);
                        this.debugLog('resolveUniversal.non_linkme', { url });
                        return fallback;
                    }
                }
                this.debugLog('resolveUniversal.http_error', { url, status: res.status });
                return null;
            }
            const payload = normalizePayload(res.data);
            if (payload && payload.isLinkMe === undefined) {
                payload.isLinkMe = true;
            }
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

    private handleForcedWebRedirect(payload: LinkMePayload): boolean {
        if (payload.forceRedirectWeb !== true) {
            return false;
        }
        const target = payload.webFallbackUrl?.trim();
        if (!target) {
            this.debugLog('force_web.enabled_but_missing_url', { linkId: payload.linkId ?? null });
            return false;
        }
        try {
            this.environment.openExternalUrl(target);
            this.debugLog('force_web.browser_open', { linkId: payload.linkId ?? null, url: target });
            return true;
        } catch (err) {
            this.debugLog('force_web.browser_open_failed', {
                url: target,
                error: err instanceof Error ? err.message : String(err),
            });
            return false;
        }
    }

    private buildBasicUniversalPayload(url: URL): LinkMePayload {
        const { params, utm } = splitSearchParams(url.searchParams);
        return {
            path: url.pathname || '/',
            params,
            utm,
            url: url.toString(),
            isLinkMe: false,
        };
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

    private isCurrent(generation: number, cfg: NormalizedConfig, httpClient: HttpClient): boolean {
        return this.generation === generation && this.config === cfg && this.httpClient === httpClient;
    }
}
