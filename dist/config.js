import { getOrigin } from './url.js';
export function normalizeConfig(config, env) {
    if (!config?.baseUrl) {
        throw new Error('baseUrl is required');
    }
    const trimmed = config.baseUrl.replace(/\/$/, '');
    const origin = getOrigin(trimmed);
    const isBrowser = env.isBrowser();
    return {
        baseUrl: trimmed,
        apiBaseUrl: `${trimmed}/api`,
        origin,
        appId: config.appId,
        appKey: config.appKey,
        autoResolve: config.autoResolve ?? isBrowser,
        autoListen: config.autoListen ?? isBrowser,
        stripCid: config.stripCid ?? true,
        sendDeviceInfo: config.sendDeviceInfo ?? true,
        resolveUniversalLinks: config.resolveUniversalLinks ?? true,
    };
}
//# sourceMappingURL=config.js.map