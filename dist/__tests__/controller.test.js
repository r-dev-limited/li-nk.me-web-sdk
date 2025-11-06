import { describe, expect, it, beforeEach } from 'vitest';
import { LinkMeController } from '../controller.js';
class MockEnvironment {
    constructor() {
        this.currentHref = null;
        this.replacedUrl = null;
        this.listeners = [];
        this.devicePayload = { platform: 'web', test: true };
    }
    isBrowser() {
        return true;
    }
    getFetch() {
        return undefined;
    }
    getCurrentHref() {
        return this.currentHref;
    }
    replaceUrl(url) {
        this.replacedUrl = url;
    }
    subscribeToNavigation(onChange) {
        this.listeners.push(onChange);
        return () => {
            this.listeners = this.listeners.filter((cb) => cb !== onChange);
        };
    }
    buildDevicePayload(sendDeviceInfo) {
        return sendDeviceInfo ? this.devicePayload : undefined;
    }
}
class MockHttpClient {
    constructor() {
        this.responders = new Map();
        this.requests = [];
    }
    when(method, url, responder) {
        const key = this.key(method, url);
        this.responders.set(key, responder);
    }
    async request(input, init) {
        const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : String(input);
        const method = (init?.method ?? 'GET').toUpperCase();
        this.requests.push({ url, init });
        const responder = this.responders.get(this.key(method, url));
        if (!responder) {
            throw new Error(`No responder registered for ${method} ${url}`);
        }
        return responder();
    }
    key(method, url) {
        return `${method.toUpperCase()} ${url}`;
    }
}
const unusedFetch = (() => {
    throw new Error('fetch should not be called');
});
describe('LinkMeController', () => {
    let environment;
    let httpClient;
    let controller;
    beforeEach(() => {
        environment = new MockEnvironment();
        httpClient = new MockHttpClient();
        const deps = {
            environment,
            httpClientFactory: () => httpClient,
        };
        controller = new LinkMeController(deps);
    });
    it('resolves cid from query string and strips it from location', async () => {
        environment.currentHref = 'https://links.example/campaign?cid=abc123';
        httpClient.when('GET', 'https://links.example/api/deeplink?cid=abc123', () => new Response(JSON.stringify({ path: '/offer', cid: 'abc123' }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        }));
        await controller.configure({
            baseUrl: 'https://links.example',
            autoListen: false,
            autoResolve: false,
            fetch: unusedFetch,
        });
        const payload = await controller.resolveFromUrl();
        expect(payload).toEqual({ path: '/offer', cid: 'abc123' });
        expect(environment.replacedUrl).toBe('https://links.example/campaign');
    });
    it('claims deferred payload and emits it', async () => {
        environment.currentHref = 'https://links.example/';
        httpClient.when('POST', 'https://links.example/api/deferred/claim', () => new Response(JSON.stringify({ linkId: 'lnk_1', path: '/welcome' }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        }));
        await controller.configure({
            baseUrl: 'https://links.example',
            autoResolve: false,
            autoListen: false,
            fetch: unusedFetch,
        });
        let emitted = null;
        controller.onLink((payload) => {
            emitted = payload;
        });
        const deferred = await controller.claimDeferredIfAvailable();
        expect(deferred).toEqual({ linkId: 'lnk_1', path: '/welcome' });
        expect(emitted).toEqual({ linkId: 'lnk_1', path: '/welcome' });
        const request = httpClient.requests.find((r) => r.url.endsWith('/api/deferred/claim'));
        expect(request?.init?.headers?.['Content-Type']).toBe('application/json');
        expect(request?.init?.body).toBeDefined();
        const parsedBody = request?.init?.body ? JSON.parse(request.init.body) : null;
        expect(parsedBody?.device).toMatchObject({ platform: 'web', test: true });
    });
});
//# sourceMappingURL=controller.test.js.map