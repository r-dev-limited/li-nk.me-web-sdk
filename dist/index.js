import { LinkMeController } from './controller.js';
import { extractCidFromUrl as extractCid } from './url.js';
const defaultController = new LinkMeController();
export async function configure(config) {
    await defaultController.configure(config);
}
export function resolveFromUrl(url) {
    return defaultController.resolveFromUrl(url);
}
export function handleLink(url) {
    return defaultController.handleLink(url);
}
export function claimDeferredIfAvailable() {
    return defaultController.claimDeferredIfAvailable();
}
export function setUserId(userId) {
    defaultController.setUserId(userId);
}
export function track(event, properties) {
    return defaultController.track(event, properties);
}
export function onLink(listener) {
    return defaultController.onLink(listener);
}
export function getLastPayload() {
    return defaultController.getLastPayload();
}
export function extractCidFromUrl(url) {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://placeholder.local';
    return extractCid(url, origin);
}
export { BrowserEnvironment } from './environment.js';
export { LinkMeController } from './controller.js';
export class LinkMeWebClient extends LinkMeController {
    constructor(deps) {
        super(deps);
    }
}
export default LinkMeWebClient;
//# sourceMappingURL=index.js.map