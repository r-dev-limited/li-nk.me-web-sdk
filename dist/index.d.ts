import { LinkMeController, type LinkMeControllerDeps } from './controller.js';
import type { LinkListener, LinkMePayload, LinkMeWebConfig } from './types.js';
export declare function configure(config: LinkMeWebConfig): Promise<void>;
export declare function resolveFromUrl(url?: string): Promise<LinkMePayload | null>;
export declare function handleLink(url: string): Promise<LinkMePayload | null>;
export declare function claimDeferredIfAvailable(): Promise<LinkMePayload | null>;
export declare function setUserId(userId: string): void;
export declare function track(event: string, properties?: Record<string, any>): Promise<void>;
export declare function onLink(listener: LinkListener): {
    remove: () => void;
};
export declare function getLastPayload(): LinkMePayload | null;
export declare function extractCidFromUrl(url: string): string | null;
export { BrowserEnvironment } from './environment.js';
export type { LinkMeEnvironment } from './environment.js';
export { LinkMeController } from './controller.js';
export type { LinkMeControllerDeps } from './controller.js';
export type { LinkMePayload, LinkMeWebConfig, LinkListener } from './types.js';
export declare class LinkMeWebClient extends LinkMeController {
    constructor(deps?: LinkMeControllerDeps);
}
export default LinkMeWebClient;
