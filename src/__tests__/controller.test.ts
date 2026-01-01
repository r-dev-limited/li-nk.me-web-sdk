import { describe, expect, it, beforeEach } from 'vitest';
import { LinkMeController } from '../controller.js';
import type { LinkMeControllerDeps } from '../controller.js';
import type { LinkMeEnvironment } from '../environment.js';
import type { FetchLike, LinkMePayload } from '../types.js';
import type { HttpClient, HttpRequestInit } from '../httpClient.js';

class MockEnvironment implements LinkMeEnvironment {
    currentHref: string | null = null;
    replacedUrl: string | null = null;
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
    private responders = new Map<string, () => Response>();
    readonly requests: RecordedRequest[] = [];

    when(method: string, url: string, responder: () => Response): void {
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
});
