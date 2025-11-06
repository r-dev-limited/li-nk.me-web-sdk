import type { FetchLike } from './types.js';
export type HttpRequestInit = RequestInit & {
    headers?: Record<string, string>;
};
export interface HttpClient {
    request(input: RequestInfo | URL, init?: HttpRequestInit): Promise<Response>;
}
export declare class FetchHttpClient implements HttpClient {
    private readonly fetchImpl;
    constructor(fetchImpl: FetchLike);
    request(input: RequestInfo | URL, init?: HttpRequestInit): Promise<Response>;
}
export type JsonResponse<T> = {
    ok: boolean;
    status: number;
    data: T | null;
};
export declare function requestJson<T>(client: HttpClient, input: RequestInfo | URL, init?: HttpRequestInit): Promise<JsonResponse<T>>;
