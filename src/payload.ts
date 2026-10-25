import type { LinkMePayload } from './types.js';

export function normalizePayload(raw: any, fallbackCid?: string): LinkMePayload | null {
    if (!raw || typeof raw !== 'object') {
        return null;
    }
    if (raw.navigationAllowed != null && typeof raw.navigationAllowed !== 'boolean') return null;
    const payload: LinkMePayload = {};
    let hasPayloadField = false;
    if (typeof raw.linkId === 'string') { payload.linkId = raw.linkId; hasPayloadField = true; }
    if (typeof raw.path === 'string') { payload.path = raw.path; hasPayloadField = true; }
    const params = toRecordOfString(raw.params);
    if (params) { payload.params = params; hasPayloadField = true; }
    const utm = toRecordOfString(raw.utm);
    if (utm) { payload.utm = utm; hasPayloadField = true; }
    const custom = toRecordOfString(raw.custom);
    if (custom) { payload.custom = custom; hasPayloadField = true; }
    if (typeof raw.url === 'string') { payload.url = raw.url; hasPayloadField = true; }
    if (typeof raw.isLinkMe === 'boolean') { payload.isLinkMe = raw.isLinkMe; hasPayloadField = true; }
    if (typeof raw.cid === 'string') { payload.cid = raw.cid; hasPayloadField = true; }
    if (typeof raw.duplicate === 'boolean') { payload.duplicate = raw.duplicate; hasPayloadField = true; }
    for (const key of ["claimId", "claimMethod", "matchConfidence", "attributionStatus"] as const) {
        if (typeof raw[key] === 'string') payload[key] = raw[key];
    }
    for (const key of ["contractVersion", "claimPolicyVersion"] as const) {
        const value = raw[key];
        if (typeof value === 'number' && Number.isInteger(value) && value > 0) payload[key] = value;
    }
    if (typeof raw.navigationAllowed === 'boolean') {
        payload.navigationAllowed = raw.navigationAllowed;
        if (raw.navigationAllowed === false && typeof raw.claimId === 'string' && raw.claimId.trim()) hasPayloadField = true;
    }
    if (typeof raw.forceRedirectWeb === 'boolean') { payload.forceRedirectWeb = raw.forceRedirectWeb; hasPayloadField = true; }
    if (typeof raw.webFallbackUrl === 'string') { payload.webFallbackUrl = raw.webFallbackUrl; hasPayloadField = true; }
    if (!hasPayloadField) return null;
    if (payload.cid === undefined && fallbackCid) payload.cid = fallbackCid;
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
