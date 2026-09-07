import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BrowserEnvironment } from '../environment.js';
import { normalizeConfig } from '../config.js';
import { FetchHttpClient, requestJson } from '../httpClient.js';
import { extractCidFromHash, extractCidFromUrl, getOrigin, isSameOrigin, parseUrl } from '../url.js';
import { normalizePayload } from '../payload.js';
import * as publicApi from '../index.js';

describe('Web SDK contract helpers', () => {
    it('handles absolute, relative, hash, malformed, and origin URL cases', () => {
        expect(parseUrl('https://links.example/a', 'https://fallback.example')).toBeInstanceOf(URL);
        expect(parseUrl('/a?x=1', 'https://links.example')).toEqual(new URL('https://links.example/a?x=1'));
        expect(parseUrl('http://[invalid', 'https://links.example')).toBeNull();
        expect(extractCidFromUrl('https://links.example/a?cid=abc', 'https://links.example')).toBe('abc');
        expect(extractCidFromUrl('https://links.example/a#cid=hash', 'https://links.example')).toBe('hash');
        expect(extractCidFromHash('#/route?cid=hash&tab=one')).toEqual({ cid: 'hash', sanitizedHash: '#/route?tab=one' });
        expect(extractCidFromHash('#/route?tab=one')).toEqual({ sanitizedHash: '#/route?tab=one' });
        expect(getOrigin('https://links.example/path')).toBe('https://links.example');
        expect(getOrigin('not a URL')).toBe('');
        expect(isSameOrigin('https://a.example/', 'https://a.example')).toBe(true);
        expect(isSameOrigin('', 'https://a.example')).toBe(false);
    });

    it('normalizes payload fields and rejects unknown-only values', () => {
        const payload = normalizePayload({
            fixtureVersion: 1,
            cid: 'cid-1',
            path: '/春',
            params: { ok: 'yes', bad: 42 },
            duplicate: false,
        });
        expect(payload).toEqual({ cid: 'cid-1', path: '/春', params: { ok: 'yes', bad: '42' }, duplicate: false });
        expect(normalizePayload({}, 'fallback-cid')).toBeNull();
        expect(normalizePayload({ serverFutureField: 'ignored' }, 'fallback-cid')).toBeNull();
        expect(normalizePayload({ path: '/fallback' }, 'fallback-cid')).toMatchObject({ cid: 'fallback-cid', path: '/fallback' });
        expect(normalizePayload(null)).toBeNull();
    });

    it('uses a browser window safely and unsubscribes navigation listeners', async () => {
        const events = new Map<string, EventListener>();
        let replaced = '';
        let assigned = '';
        const fakeWindow = {
            document: { title: 'fixture' },
            location: { href: 'https://links.example/', origin: 'https://links.example', assign: (url: string) => { assigned = url; } },
            history: { state: { a: 1 }, replaceState: (_state: unknown, _title: string, url: string) => { replaced = url; } },
            navigator: { userAgent: 'fixture-agent', language: 'en-NZ', languages: ['en-NZ', 'en'], connection: { effectiveType: '4g' } },
            Intl,
            screen: { width: 1024, height: 768 },
            devicePixelRatio: 2,
            fetch: vi.fn(async () => new Response(null, { status: 204 })),
            addEventListener: (name: string, listener: EventListener) => events.set(name, listener),
            removeEventListener: (name: string, listener: EventListener) => { if (events.get(name) === listener) events.delete(name); },
        } as any;
        const env = new BrowserEnvironment(fakeWindow);
        expect(env.isBrowser()).toBe(true);
        expect(env.getCurrentHref()).toBe('https://links.example/');
        env.replaceUrl('/clean');
        expect(replaced).toBe('/clean');
        env.openExternalUrl('https://links.example/forced');
        expect(assigned).toBe('https://links.example/forced');
        expect(env.buildDevicePayload(false)).toBeUndefined();
        expect(env.buildDevicePayload(true)).toMatchObject({ platform: 'web', userAgent: 'fixture-agent', locale: 'en-NZ', screen: { pixelRatio: 2 } });
        const listener = vi.fn();
        const remove = env.subscribeToNavigation(listener);
        events.get('popstate')?.(new Event('popstate'));
        expect(listener).toHaveBeenCalledOnce();
        remove();
        expect(events.has('popstate')).toBe(false);
        expect(new BrowserEnvironment().isBrowser()).toBe(false);
    });

    it('normalizes config and wraps fetch responses', async () => {
        const config = normalizeConfig({ baseUrl: 'https://links.example/', autoResolve: false }, { isBrowser: () => false } as any);
        expect(config).toMatchObject({ baseUrl: 'https://links.example', apiBaseUrl: 'https://links.example/api', autoResolve: false, autoListen: false });
        const browserDefaults = normalizeConfig({}, { isBrowser: () => true } as any);
        expect(browserDefaults).toMatchObject({ baseUrl: 'https://li-nk.me', autoResolve: true, autoListen: true, stripCid: true, sendDeviceInfo: true });
        const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 200 }));
        const client = new FetchHttpClient(fetchImpl);
        const response = await client.request('/health');
        expect(response.status).toBe(200);
        expect(fetchImpl).toHaveBeenCalledWith('/health', undefined);
        await expect(requestJson(client, '/health')).resolves.toMatchObject({ ok: true, status: 200, data: { ok: true } });
    });
});

describe('Web SDK public module', () => {
    beforeEach(() => publicApi.dispose());

    it('exposes the singleton lifecycle and CID helper', async () => {
        const fetchImpl = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
            if (String(input).includes('/app-events')) return new Response(null, { status: 204 });
            return new Response(JSON.stringify({ linkId: 'link-1', cid: 'cid-1', path: '/welcome' }), { status: 200 });
        });
        await publicApi.configure({ baseUrl: 'https://links.example', fetch: fetchImpl, autoResolve: false, autoListen: false });
        const received: unknown[] = [];
        const subscription = publicApi.onLink((payload) => received.push(payload));
        await expect(publicApi.handleLink('https://links.example/?cid=cid-1')).resolves.toMatchObject({ cid: 'cid-1' });
        publicApi.setUserId('user-1');
        await publicApi.track('open', { source: 'fixture' });
        expect(received).toHaveLength(1);
        expect(publicApi.getLastPayload()).toMatchObject({ linkId: 'link-1' });
        expect(publicApi.extractCidFromUrl('https://links.example/?cid=cid-1')).toBe('cid-1');
        subscription.remove();
        publicApi.dispose();
        expect(publicApi.getLastPayload()).toBeNull();
        expect(fetchImpl).toHaveBeenCalled();
    });
});
