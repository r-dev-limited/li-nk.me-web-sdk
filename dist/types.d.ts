export type LinkMePayload = {
    linkId?: string;
    path?: string;
    params?: Record<string, string>;
    utm?: Record<string, string>;
    custom?: Record<string, string>;
    cid?: string;
    duplicate?: boolean;
};
export type LinkListener = (payload: LinkMePayload) => void;
export type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
export type LinkMeWebConfig = {
    baseUrl?: string;
    appId?: string;
    appKey?: string;
    fetch?: FetchLike;
    autoResolve?: boolean;
    autoListen?: boolean;
    stripCid?: boolean;
    sendDeviceInfo?: boolean;
    resolveUniversalLinks?: boolean;
};
export type NormalizedConfig = {
    baseUrl: string;
    apiBaseUrl: string;
    origin: string;
    appId?: string;
    appKey?: string;
    autoResolve: boolean;
    autoListen: boolean;
    stripCid: boolean;
    sendDeviceInfo: boolean;
    resolveUniversalLinks: boolean;
};
