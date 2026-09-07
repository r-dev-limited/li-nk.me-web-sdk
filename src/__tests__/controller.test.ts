import { describe, expect, it, beforeEach } from 'vitest';
import { LinkMeController } from '../controller.js';
import type { LinkMeControllerDeps } from '../controller.js';
import type { LinkMeEnvironment } from '../environment.js';
import type { FetchLike, LinkMePayload } from '../types.js';
import type { HttpClient, HttpRequestInit } from '../httpClient.js';
import { normalizePayload } from '../payload.js';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

class MockEnvironment implements LinkMeEnvironment {
    currentHref: string | null = null;
    replacedUrl: string | null = null;
    openedUrl: string | null = null;
    listeners: Array<() => void> = [];
    devicePayload: Record<string, any> | undefined = { platform: 'web', test: true };

    isBrowser(): boolean {
        return true;
    }

    getFetch(): FetchLike | undefined {
        return undefined;
    }

    getCurrentHref(): string | null {
        return this.currentHref;
    }

    replaceUrl(url: string): void {
        this.replacedUrl = url;
    }

    openExternalUrl(url: string): void {
        this.openedUrl = url;
    }

    subscribeToNavigation(onChange: () => void): () => void {
        this.listeners.push(onChange);
        return () => {
            this.listeners = this.listeners.filter((cb) => cb !== onChange);
        };
    }

    buildDevicePayload(sendDeviceInfo: boolean): Record<string, any> | undefined {
        return sendDeviceInfo ? this.devicePayload : undefined;
    }
}

type RecordedRequest = { url: string; init?: HttpRequestInit };

class MockHttpClient implements HttpClient {
    private responders = new Map<string, () => Response | Promise<Response>>();
    readonly requests: RecordedRequest[] = [];

    when(method: string, url: string, responder: () => Response | Promise<Response>): void {
        const key = this.key(method, url);
        this.responders.set(key, responder);
    }

    async request(input: RequestInfo | URL, init?: HttpRequestInit): Promise<Response> {
        const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : String(input);
        const method = (init?.method ?? 'GET').toUpperCase();
        this.requests.push({ url, init });
        const responder = this.responders.get(this.key(method, url));
        if (!responder) {
            throw new Error(`No responder registered for ${method} ${url}`);
        }
        return responder();
    }

    private key(method: string, url: string): string {
        return `${method.toUpperCase()} ${url}`;
    }
}

const unusedFetch: FetchLike = (() => {
    throw new Error('fetch should not be called');
}) as FetchLike;

describe('LinkMeController', () => {
    let environment: MockEnvironment;
    let httpClient: MockHttpClient;
    let controller: LinkMeController;

    beforeEach(() => {
        environment = new MockEnvironment();
        httpClient = new MockHttpClient();
        const deps: LinkMeControllerDeps = {
            environment,
            httpClientFactory: () => httpClient,
        };
        controller = new LinkMeController(deps);
    });

    it('resolves cid from query string and strips it from location', async () => {
        environment.currentHref = 'https://links.example/campaign?cid=abc123';
        httpClient.when(
            'GET',
            'https://links.example/api/deeplink?cid=abc123',
            () =>
                new Response(JSON.stringify({ path: '/offer', cid: 'abc123' }), {
                    status: 200,
                    headers: { 'Content-Type': 'application/json' },
                })
        );

        await controller.configure({
            baseUrl: 'https://links.example',
            autoListen: false,
            autoResolve: false,
            fetch: unusedFetch,
        });

        const payload = await controller.resolveFromUrl();
        expect(payload).toEqual({ path: '/offer', cid: 'abc123', isLinkMe: true });
        expect(environment.replacedUrl).toBe('https://links.example/campaign');
    });

    it('claims deferred payload and emits it', async () => {
        environment.currentHref = 'https://links.example/';
        httpClient.when(
            'POST',
            'https://links.example/api/deferred/claim',
            () =>
                new Response(JSON.stringify({ linkId: 'lnk_1', path: '/welcome' }), {
                    status: 200,
                    headers: { 'Content-Type': 'application/json' },
                })
        );

        await controller.configure({
            baseUrl: 'https://links.example',
            autoResolve: false,
            autoListen: false,
            fetch: unusedFetch,
        });

        let emitted: LinkMePayload | null = null;
        controller.onLink((payload) => {
            emitted = payload;
        });

        const deferred = await controller.claimDeferredIfAvailable();
        expect(deferred).toEqual({ linkId: 'lnk_1', path: '/welcome', isLinkMe: true });
        expect(emitted).toEqual({ linkId: 'lnk_1', path: '/welcome', isLinkMe: true });

        const request = httpClient.requests.find((r) => r.url.endsWith('/api/deferred/claim'));
        expect(request?.init?.headers?.['Content-Type']).toBe('application/json');
        expect(request?.init?.body).toBeDefined();
        const parsedBody = request?.init?.body ? JSON.parse(request!.init!.body as string) : null;
        expect(parsedBody?.device).toMatchObject({ platform: 'web', test: true });
    });

    it('uses the Edge analytics contract and preserves redirect fields', async () => {
        httpClient.when('POST', 'https://links.example/api/app-events', () => new Response(null, { status: 204 }));
        await controller.configure({ baseUrl: 'https://links.example', autoResolve: false, autoListen: false, fetch: unusedFetch });
        await controller.track('open', { page: 'home' });
        const request = httpClient.requests.find((r) => r.url.endsWith('/api/app-events'));
        const body = JSON.parse(request!.init!.body as string);
        expect(body).toMatchObject({ type: 'open', platform: 'web', detail: JSON.stringify({ page: 'home' }) });

        httpClient.when('GET', 'https://links.example/api/deeplink?cid=abc123', () => new Response(JSON.stringify({ linkId: 'l', forceRedirectWeb: true, webFallbackUrl: 'https://example.test' }), { status: 200 }));
        const payload = await controller.handleLink('https://links.example/?cid=abc123');
        expect(payload).toMatchObject({ linkId: 'l', forceRedirectWeb: true, webFallbackUrl: 'https://example.test' });
        expect(environment.openedUrl).toBe('https://example.test');
    });

    it('honors stripCid=false and disposes navigation state', async () => {
        environment.currentHref = 'https://links.example/campaign?cid=abc123';
        httpClient.when('GET', 'https://links.example/api/deeplink?cid=abc123', () => new Response(JSON.stringify({ path: '/offer' }), { status: 200 }));
        await controller.configure({ baseUrl: 'https://links.example', autoListen: false, autoResolve: false, stripCid: false, fetch: unusedFetch });
        await controller.resolveFromUrl();
        expect(environment.replacedUrl).toBeNull();
        controller.dispose();
        expect(await controller.resolveFromUrl()).toBeNull();
    });

    it('drops an in-flight response after reconfiguration', async () => {
        let releaseOldResponse!: (response: Response) => void;
        const oldResponse = new Promise<Response>((resolve) => {
            releaseOldResponse = resolve;
        });
        httpClient.when('GET', 'https://old.example/api/deeplink?cid=old123', () => oldResponse);
        httpClient.when(
            'GET',
            'https://new.example/api/deeplink?cid=new123',
            () => new Response(JSON.stringify({ cid: 'new123', path: '/new' }), { status: 200 })
        );
        httpClient.when('POST', 'https://new.example/api/app-events', () => new Response(null, { status: 204 }));
        await controller.configure({ baseUrl: 'https://old.example', autoListen: false, autoResolve: false, fetch: unusedFetch });
        controller.setUserId('old-user');
        const received: LinkMePayload[] = [];
        controller.onLink((payload) => received.push(payload));

        const oldRequest = controller.handleLink('https://old.example/?cid=old123');
        await Promise.resolve();
        await controller.configure({ baseUrl: 'https://new.example', autoListen: false, autoResolve: false, fetch: unusedFetch });
        releaseOldResponse(new Response(JSON.stringify({ cid: 'old123', path: '/old' }), { status: 200 }));

        await expect(oldRequest).resolves.toBeNull();
        expect(received).toHaveLength(0);
        expect(controller.getLastPayload()).toBeNull();
        await expect(controller.handleLink('https://new.example/?cid=new123')).resolves.toMatchObject({ path: '/new' });
        expect(received).toHaveLength(1);
        await controller.track('open');
        const event = httpClient.requests.find((request) => request.url.endsWith('/api/app-events'));
        expect(JSON.parse(event!.init!.body as string)).not.toHaveProperty('userId');
    });

    it('rejects empty or unknown response objects', async () => {
        environment.currentHref = 'https://links.example/?cid=abc123';
        httpClient.when('GET', 'https://links.example/api/deeplink?cid=abc123', () => new Response(JSON.stringify({}), { status: 200 }));
        await controller.configure({ baseUrl: 'https://links.example', autoListen: false, autoResolve: false, fetch: unusedFetch });
        expect(await controller.resolveFromUrl()).toBeNull();
    });

    it('accepts the versioned v1 golden payload without leaking unknown fields', () => {
        const fixture = JSON.parse(readFileSync(new URL('../../test-fixtures/link-payload.valid.json', import.meta.url), 'utf8')) as Record<string, unknown>;
        const payload = normalizePayload(fixture);
        expect(payload).toMatchObject({
            cid: 'cid-golden-001',
            linkId: 'link-golden-001',
            path: '/welcome/春',
            duplicate: false,
            forceRedirectWeb: false,
        });
        expect(payload).not.toHaveProperty('fixtureVersion');
        expect(payload).not.toHaveProperty('serverFutureField');
    });

    it('auto-resolves and reacts to navigation changes', async () => {
        environment.currentHref = 'https://links.example/?cid=abc123';
        httpClient.when('GET', 'https://links.example/api/deeplink?cid=abc123', () => new Response(JSON.stringify({ path: '/auto', cid: 'abc123' }), { status: 200 }));
        await controller.configure({ baseUrl: 'https://links.example', autoListen: true, autoResolve: true, fetch: unusedFetch });
        expect(controller.getLastPayload()).toMatchObject({ path: '/auto', cid: 'abc123' });
        expect(environment.listeners).toHaveLength(1);
        environment.listeners[0]();
        await new Promise((resolve) => setTimeout(resolve, 0));
        expect(httpClient.requests.filter((request) => request.url.includes('deeplink?cid=abc123'))).toHaveLength(1);
    });

    it('rejects missing fetch and handles deferred failures, malformed values, and forced redirects', async () => {
        await expect(controller.configure({ baseUrl: 'https://links.example', autoResolve: false, autoListen: false })).rejects.toThrow('fetch is not available');
        await controller.configure({ baseUrl: 'https://links.example', autoResolve: false, autoListen: false, fetch: unusedFetch });
        expect(await controller.claimDeferredIfAvailable()).toBeNull();
        httpClient.when('POST', 'https://links.example/api/deferred/claim', () => new Response(JSON.stringify({}), { status: 200 }));
        expect(await controller.claimDeferredIfAvailable()).toBeNull();
        httpClient.when('POST', 'https://links.example/api/deferred/claim', () => new Response(JSON.stringify({ forceRedirectWeb: true }), { status: 200 }));
        const emitted: LinkMePayload[] = [];
        controller.onLink((payload) => emitted.push(payload));
        const forcedWithoutTarget = await controller.claimDeferredIfAvailable();
        expect(forcedWithoutTarget).toMatchObject({ forceRedirectWeb: true });
        expect(emitted).toHaveLength(1);
        httpClient.when('POST', 'https://links.example/api/deferred/claim', () => { throw new Error('offline'); });
        expect(await controller.claimDeferredIfAvailable()).toBeNull();
    });

    it('resolves same-origin universal links and falls back for unknown domains', async () => {
        await controller.configure({ baseUrl: 'https://links.example', autoResolve: false, autoListen: false, fetch: unusedFetch });
        httpClient.when('POST', 'https://links.example/api/deeplink/resolve-url', () => new Response(JSON.stringify({ linkId: 'universal-1', path: '/resolved' }), { status: 200 }));
        await expect(controller.handleLink('https://links.example/resolved')).resolves.toMatchObject({ linkId: 'universal-1', isLinkMe: true });
        httpClient.when('POST', 'https://links.example/api/deeplink/resolve-url', () => new Response(JSON.stringify({ error: 'domain_not_found' }), { status: 404 }));
        await expect(controller.handleLink('https://links.example/fallback?utm_source=fixture&ref=one')).resolves.toMatchObject({
            path: '/fallback',
            utm: { utm_source: 'fixture' },
            params: { ref: 'one' },
            isLinkMe: false,
        });
        httpClient.when('POST', 'https://links.example/api/deeplink/resolve-url', () => new Response(JSON.stringify({ error: 'forbidden' }), { status: 403 }));
        await expect(controller.handleLink('https://links.example/denied')).resolves.toBeNull();
        await controller.configure({ baseUrl: 'https://links.example', autoResolve: false, autoListen: false, resolveUniversalLinks: false, fetch: unusedFetch });
        await expect(controller.handleLink('https://links.example/disabled')).resolves.toBeNull();
    });

    it('keeps listener failures isolated and handles failed or missing forced-web targets', async () => {
        await controller.configure({ baseUrl: 'https://links.example', autoResolve: false, autoListen: false, fetch: unusedFetch });
        const received: LinkMePayload[] = [];
        controller.onLink(() => { throw new Error('listener failure'); });
        controller.onLink((payload) => received.push(payload));
        httpClient.when('GET', 'https://links.example/api/deeplink?cid=missing-target', () => new Response(JSON.stringify({ forceRedirectWeb: true }), { status: 200 }));
        await controller.handleLink('https://links.example/?cid=missing-target');
        expect(received).toHaveLength(1);

        environment.openExternalUrl = () => { throw new Error('blocked'); };
        httpClient.when('GET', 'https://links.example/api/deeplink?cid=blocked-target', () => new Response(JSON.stringify({ forceRedirectWeb: true, webFallbackUrl: 'https://example.test' }), { status: 200 }));
        await controller.handleLink('https://links.example/?cid=blocked-target');
        expect(received).toHaveLength(2);
    });

    it('returns null for an invalid URL and a universal resolver transport error', async () => {
        await controller.configure({ baseUrl: 'https://links.example', autoResolve: false, autoListen: false, fetch: unusedFetch });
        await expect(controller.handleLink('http://[invalid')).resolves.toBeNull();
        httpClient.when('POST', 'https://links.example/api/deeplink/resolve-url', () => { throw 'network'; });
        await expect(controller.handleLink('https://links.example/error')).resolves.toBeNull();
    });
});
