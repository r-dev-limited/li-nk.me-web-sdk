export type LinkMePayload = {
    linkId?: string;
    path?: string;
    params?: Record<string, string>;
    utm?: Record<string, string>;
    custom?: Record<string, string>;
    url?: string;
    isLinkMe?: boolean;
    cid?: string;
    duplicate?: boolean;
    claimId?: string;
    claimMethod?: string;
    matchConfidence?: string;
    attributionStatus?: string;
    contractVersion?: number;
    claimPolicyVersion?: number;

    navigationAllowed?: boolean;
    forceRedirectWeb?: boolean;
    webFallbackUrl?: string;
};

export type LinkListener = (payload: LinkMePayload) => void;

export type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export type LinkMeWebConfig = {
    /** Deadline for the complete fetch/body operation. Defaults to 15000 ms. */
    requestTimeoutMs?: number;
    baseUrl?: string;
    appId?: string;
    appKey?: string;
    fetch?: FetchLike;
    debug?: boolean;
    autoResolve?: boolean;
    autoListen?: boolean;
    stripCid?: boolean;
    sendDeviceInfo?: boolean;
    resolveUniversalLinks?: boolean;
};

export type NormalizedConfig = {
    requestTimeoutMs: number;
    baseUrl: string;
    apiBaseUrl: string;
    origin: string;
    appId?: string;
    appKey?: string;
    debug: boolean;
    autoResolve: boolean;
    autoListen: boolean;
    stripCid: boolean;
    sendDeviceInfo: boolean;
    resolveUniversalLinks: boolean;
};
