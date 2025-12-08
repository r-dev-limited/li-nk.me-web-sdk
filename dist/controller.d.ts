import { type LinkMeEnvironment } from './environment.js';
import type { LinkListener, LinkMePayload, LinkMeWebConfig, FetchLike } from './types.js';
import { type HttpClient } from './httpClient.js';
type ProcessUrlOptions = {
    stripLocation?: boolean;
};
export interface LinkMeControllerDeps {
    environment?: LinkMeEnvironment;
    httpClientFactory?: (fetchImpl: FetchLike) => HttpClient;
}
export declare class LinkMeController {
    private readonly environment;
    private readonly httpClientFactory;
    private config?;
    private httpClient?;
    private lastPayload;
    private readonly listeners;
    private userId?;
    private readonly seenCids;
    private unsubscribeNavigation;
    constructor(deps?: LinkMeControllerDeps);
    private debugLog;
    configure(config: LinkMeWebConfig): Promise<void>;
    resolveFromUrl(url?: string, opts?: ProcessUrlOptions): Promise<LinkMePayload | null>;
    handleLink(url: string): Promise<LinkMePayload | null>;
    claimDeferredIfAvailable(): Promise<LinkMePayload | null>;
    setUserId(userId: string): void;
    track(event: string, properties?: Record<string, any>): Promise<void>;
    onLink(listener: LinkListener): {
        remove: () => void;
    };
    getLastPayload(): LinkMePayload | null;
    private processUrl;
    private resolveCid;
    private resolveUniversalLink;
    private buildHeaders;
    private emit;
    private detachNavigation;
}
export {};
