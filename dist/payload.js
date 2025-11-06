export function normalizePayload(raw, fallbackCid) {
    if (!raw || typeof raw !== 'object') {
        return null;
    }
    const payload = {};
    if (typeof raw.linkId === 'string')
        payload.linkId = raw.linkId;
    if (typeof raw.path === 'string')
        payload.path = raw.path;
    const params = toRecordOfString(raw.params);
    if (params)
        payload.params = params;
    const utm = toRecordOfString(raw.utm);
    if (utm)
        payload.utm = utm;
    const custom = toRecordOfString(raw.custom);
    if (custom)
        payload.custom = custom;
    if (typeof raw.cid === 'string')
        payload.cid = raw.cid;
    else if (fallbackCid)
        payload.cid = fallbackCid;
    if (typeof raw.duplicate === 'boolean')
        payload.duplicate = raw.duplicate;
    return payload;
}
function toRecordOfString(value) {
    if (!value || typeof value !== 'object') {
        return undefined;
    }
    const entries = Object.entries(value);
    if (entries.length === 0) {
        return undefined;
    }
    const record = {};
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
function safeStringify(value) {
    try {
        return JSON.stringify(value);
    }
    catch {
        return undefined;
    }
}
//# sourceMappingURL=payload.js.map