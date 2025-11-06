export declare function parseUrl(url: string, baseOrigin: string): URL | null;
export declare function extractCid(parsed: URL): {
    cid?: string;
    sanitizedHref?: string;
};
export declare function extractCidFromHash(hash: string): {
    cid?: string;
    sanitizedHash: string;
};
export declare function getOrigin(url: string): string;
export declare function isSameOrigin(a: string, b: string): boolean;
export declare function extractCidFromUrl(url: string, baseOrigin: string): string | null;
