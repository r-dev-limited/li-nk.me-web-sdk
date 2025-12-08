import type { LinkMeWebConfig, NormalizedConfig } from './types.js';
import type { LinkMeEnvironment } from './environment.js';
import { getOrigin } from './url.js';

export function normalizeConfig(config: LinkMeWebConfig, env: LinkMeEnvironment): NormalizedConfig {
    const baseUrl = config?.baseUrl || 'https://li-nk.me';
    const trimmed = baseUrl.replace(/\/$/, '');
    const origin = getOrigin(trimmed);
    const isBrowser = env.isBrowser();
    return {
        baseUrl: trimmed,
        apiBaseUrl: `${trimmed}/api`,
        origin,
        appId: config.appId,
        appKey: config.appKey,
        debug: config.debug ?? false,
        autoResolve: config.autoResolve ?? isBrowser,
        autoListen: config.autoListen ?? isBrowser,
        stripCid: config.stripCid ?? true,
        sendDeviceInfo: config.sendDeviceInfo ?? true,
        resolveUniversalLinks: config.resolveUniversalLinks ?? true,
    };
}
