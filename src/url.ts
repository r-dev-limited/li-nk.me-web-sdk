export function parseUrl(url: string, baseOrigin: string): URL | null {
    try {
        return new URL(url);
    } catch {
        try {
            return new URL(url, baseOrigin || 'https://placeholder.local');
        } catch {
            return null;
        }
    }
}

export function extractCid(parsed: URL): { cid?: string; sanitizedHref?: string } {
    let cid = parsed.searchParams.get('cid') ?? undefined;
    const sanitized = new URL(parsed.href);
    if (cid) {
        sanitized.searchParams.delete('cid');
        if (!sanitized.searchParams.toString()) {
            sanitized.search = '';
        }
    }
    if (!cid && parsed.hash) {
        const { cid: hashCid, sanitizedHash } = extractCidFromHash(parsed.hash);
        if (hashCid) {
            cid = hashCid;
            sanitized.hash = sanitizedHash;
        }
    } else if (parsed.hash) {
        sanitized.hash = parsed.hash;
    }
    const sanitizedHref = cid ? sanitized.toString() : undefined;
    return { cid, sanitizedHref };
}

export function extractCidFromHash(hash: string): { cid?: string; sanitizedHash: string } {
    if (!hash) {
        return { sanitizedHash: '' };
    }
    const trimmed = hash.startsWith('#') ? hash.slice(1) : hash;
    const [pathPart, queryPart] = splitHash(trimmed);
    if (queryPart) {
        const params = new URLSearchParams(queryPart);
        const cid = params.get('cid') ?? undefined;
        if (cid) {
            params.delete('cid');
            const nextQuery = params.toString();
            const sanitized = buildHash(pathPart, nextQuery);
            return { cid, sanitizedHash: sanitized };
        }
        return { sanitizedHash: hash };
    }
    if (trimmed.startsWith('cid=')) {
        const params = new URLSearchParams(trimmed);
        const cid = params.get('cid') ?? undefined;
        params.delete('cid');
        const remaining = params.toString();
        const sanitized = remaining ? `#${remaining}` : '';
        return { cid, sanitizedHash: sanitized };
    }
    return { sanitizedHash: hash };
}

function splitHash(hash: string): [string | undefined, string | undefined] {
    const idx = hash.indexOf('?');
    if (idx === -1) {
        return [hash || undefined, undefined];
    }
    const pathPart = idx > 0 ? hash.slice(0, idx) : undefined;
    const queryPart = hash.slice(idx + 1);
    return [pathPart, queryPart || undefined];
}

function buildHash(path: string | undefined, query: string | undefined): string {
    if (!path && !query) {
        return '';
    }
    if (!path) {
        return query ? `#?${query}` : '';
    }
    if (!query) {
        return `#${path}`;
    }
    return `#${path}?${query}`;
}

export function getOrigin(url: string): string {
    try {
        return new URL(url).origin;
    } catch {
        return '';
    }
}

export function isSameOrigin(a: string, b: string): boolean {
    return Boolean(a) && Boolean(b) && a.replace(/\/$/, '') === b.replace(/\/$/, '');
}

export function extractCidFromUrl(url: string, baseOrigin: string): string | null {
    const parsed = parseUrl(url, baseOrigin);
    if (!parsed) {
        return null;
    }
    return extractCid(parsed).cid ?? null;
}
