import type { FetchLike } from './types.js';

export type HttpRequestInit = RequestInit & { headers?: Record<string, string> };

export interface HttpClient {
    request(input: RequestInfo | URL, init?: HttpRequestInit): Promise<Response>;
}

export class FetchHttpClient implements HttpClient {
    private readonly fetchImpl: FetchLike;

    constructor(fetchImpl: FetchLike) {
        this.fetchImpl = fetchImpl;
    }

    request(input: RequestInfo | URL, init?: HttpRequestInit): Promise<Response> {
        return this.fetchImpl(input, init);
    }
}

export type JsonResponse<T> = {
    ok: boolean;
    status: number;
    data: T | null;
};

export async function requestJson<T>(client: HttpClient, input: RequestInfo | URL, init?: HttpRequestInit): Promise<JsonResponse<T>> {
    const res = await client.request(input, init);
    let data: T | null = null;
    try {
        data = await res.json();
    } catch {
        data = null;
    }
    return { ok: res.ok, status: res.status, data };
}
