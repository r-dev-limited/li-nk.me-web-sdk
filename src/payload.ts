import type { LinkMePayload } from './types.js';

export function normalizePayload(raw: any, fallbackCid?: string): LinkMePayload | null {
    if (!raw || typeof raw !== 'object') {
        return null;
    }
    const payload: LinkMePayload = {};
    if (typeof raw.linkId === 'string') payload.linkId = raw.linkId;
    if (typeof raw.path === 'string') payload.path = raw.path;
    const params = toRecordOfString(raw.params);
    if (params) payload.params = params;
    const utm = toRecordOfString(raw.utm);
    if (utm) payload.utm = utm;
    const custom = toRecordOfString(raw.custom);
    if (custom) payload.custom = custom;
    if (typeof raw.url === 'string') payload.url = raw.url;
    if (typeof raw.isLinkMe === 'boolean') payload.isLinkMe = raw.isLinkMe;
    if (typeof raw.cid === 'string') payload.cid = raw.cid;
    else if (fallbackCid) payload.cid = fallbackCid;
    if (typeof raw.duplicate === 'boolean') payload.duplicate = raw.duplicate;
    return payload;
}

function toRecordOfString(value: unknown): Record<string, string> | undefined {
    if (!value || typeof value !== 'object') {
        return undefined;
    }
    const entries = Object.entries(value as Record<string, unknown>);
    if (entries.length === 0) {
        return undefined;
    }
    const record: Record<string, string> = {};
    let hasValue = false;
    for (const [key, val] of entries) {
        if (typeof key !== 'string' || val == null) {
            continue;
        }
        const normalized = typeof val === 'string' ? val : safeStringify(val);
        if (normalized === undefined) {
            continue;
        }
        record[key] = normalized;
        hasValue = true;
    }
    return hasValue ? record : undefined;
}

function safeStringify(value: unknown): string | undefined {
    try {
        return JSON.stringify(value);
    } catch {
        return undefined;
    }
}
