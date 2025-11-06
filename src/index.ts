import { LinkMeController, type LinkMeControllerDeps } from './controller.js';
import { extractCidFromUrl as extractCid } from './url.js';
import type { LinkListener, LinkMePayload, LinkMeWebConfig } from './types.js';

const defaultController = new LinkMeController();

export async function configure(config: LinkMeWebConfig): Promise<void> {
    await defaultController.configure(config);
}

export function resolveFromUrl(url?: string): Promise<LinkMePayload | null> {
    return defaultController.resolveFromUrl(url);
}

export function handleLink(url: string): Promise<LinkMePayload | null> {
    return defaultController.handleLink(url);
}

export function claimDeferredIfAvailable(): Promise<LinkMePayload | null> {
    return defaultController.claimDeferredIfAvailable();
}

export function setUserId(userId: string): void {
    defaultController.setUserId(userId);
}

export function track(event: string, properties?: Record<string, any>): Promise<void> {
    return defaultController.track(event, properties);
}

export function onLink(listener: LinkListener): { remove: () => void } {
    return defaultController.onLink(listener);
}

export function getLastPayload(): LinkMePayload | null {
    return defaultController.getLastPayload();
}

export function extractCidFromUrl(url: string): string | null {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://placeholder.local';
    return extractCid(url, origin);
}

export { BrowserEnvironment } from './environment.js';
export type { LinkMeEnvironment } from './environment.js';
export { LinkMeController } from './controller.js';
export type { LinkMeControllerDeps } from './controller.js';
export type { LinkMePayload, LinkMeWebConfig, LinkListener } from './types.js';

export class LinkMeWebClient extends LinkMeController {
    constructor(deps?: LinkMeControllerDeps) {
        super(deps);
    }
}

export default LinkMeWebClient;
