import type { FetchLike } from './types.js';
export interface LinkMeEnvironment {
    isBrowser(): boolean;
    getFetch(): FetchLike | undefined;
    getCurrentHref(): string | null;
    replaceUrl(url: string): void;
    subscribeToNavigation(onChange: () => void): () => void;
    buildDevicePayload(sendDeviceInfo: boolean): Record<string, any> | undefined;
}
export declare class BrowserEnvironment implements LinkMeEnvironment {
    private readonly win;
    private readonly doc;
    constructor(win?: Window & typeof globalThis);
    isBrowser(): boolean;
    getFetch(): FetchLike | undefined;
    getCurrentHref(): string | null;
    replaceUrl(url: string): void;
    subscribeToNavigation(onChange: () => void): () => void;
    buildDevicePayload(sendDeviceInfo: boolean): Record<string, any> | undefined;
}
