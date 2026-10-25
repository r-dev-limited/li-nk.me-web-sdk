# LinkMe Web SDK

Zero-dependency browser SDK for deep linking, deferred linking, and attribution on the web.

[![npm](https://img.shields.io/npm/v/@li-nk.me/web-sdk)](https://www.npmjs.com/package/@li-nk.me/web-sdk)
[![License](https://img.shields.io/badge/license-Apache--2.0-blue)](LICENSE)

- [Main Site](https://li-nk.me)
- [Setup Guide](https://help.li-nk.me/hc/link-me/en/developer-setup/web-setup-guide)
- [SDK Reference](https://help.li-nk.me/hc/link-me/en/sdks)
- [Help Center](https://help.li-nk.me/hc/link-me/en)

Works with Next.js, React, Vue, Svelte, Angular, and vanilla JavaScript.

## Quick start

### 1. Prerequisites

- A LinkMe app with an API key (read-only scope is sufficient for browser usage)
- Modern build tooling (Next.js 13+, Vite, etc.) or a plain `<script>` tag

### 2. Install

```bash
npm install @li-nk.me/web-sdk
```

### 3. Configure environment variables

```bash
# .env.local (Next.js)
NEXT_PUBLIC_LINKME_APP_ID=app_123
NEXT_PUBLIC_LINKME_APP_READ_KEY=lk_live_read_...
```

Use the appropriate prefix for your framework (`NEXT_PUBLIC_` for Next.js, `VITE_` for Vite, etc.).

### 4. Bootstrap the SDK

#### Next.js (App Router)

```tsx
'use client';

import { ReactNode, useEffect } from 'react';
import { configure, resolveFromUrl, onLink, claimDeferredIfAvailable } from '@li-nk.me/web-sdk';
import { useRouter } from 'next/navigation';

export function LinkMeProvider({ children }: { children: ReactNode }) {
  const router = useRouter();

  useEffect(() => {
    let mounted = true;
    let unsubscribe: { remove: () => void } | null = null;

    (async () => {
      await configure({
        appId: process.env.NEXT_PUBLIC_LINKME_APP_ID!,
        appKey: process.env.NEXT_PUBLIC_LINKME_APP_READ_KEY,
      });

      const initial = await resolveFromUrl();
      if (mounted && initial?.path) {
        router.replace(initial.path.startsWith('/') ? initial.path : `/${initial.path}`);
      } else {
        const deferred = await claimDeferredIfAvailable();
        if (mounted && deferred?.path) {
          router.replace(deferred.path.startsWith('/') ? deferred.path : `/${deferred.path}`);
        }
      }

      unsubscribe = onLink((payload) => {
        if (payload?.path) router.replace(payload.path.startsWith('/') ? payload.path : `/${payload.path}`);
      });
    })();

    return () => { mounted = false; unsubscribe?.remove(); };
  }, [router]);

  return <>{children}</>;
}
```

Wrap your layout:

```tsx
// app/layout.tsx
import { LinkMeProvider } from './LinkMeProvider';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html><body><LinkMeProvider>{children}</LinkMeProvider></body></html>
  );
}
```

#### React (with React Router)

```tsx
import { useEffect } from 'react';
import { configure, resolveFromUrl, onLink } from '@li-nk.me/web-sdk';
import { useNavigate } from 'react-router-dom';

export function useLinkMe() {
  const navigate = useNavigate();
  useEffect(() => {
    let cleanup: (() => void) | null = null;
    (async () => {
      await configure({ appId: import.meta.env.VITE_LINKME_APP_ID });
      const initial = await resolveFromUrl();
      if (initial?.path) navigate(initial.path);
      const sub = onLink((payload) => payload?.path && navigate(payload.path));
      cleanup = () => sub.remove();
    })();
    return () => cleanup?.();
  }, [navigate]);
}
```

#### Svelte (SvelteKit)

```ts
import { onMount } from 'svelte';
import { goto } from '$app/navigation';
import { configure, resolveFromUrl, onLink } from '@li-nk.me/web-sdk';

onMount(() => {
  let active = true;
  (async () => {
    await configure({ appId: import.meta.env.VITE_LINKME_APP_ID });
    const initial = await resolveFromUrl();
    if (active && initial?.path) goto(initial.path, { replaceState: true });
  })();
  const { remove } = onLink((payload) => {
    if (payload?.path) goto(payload.path);
  });
  return () => { active = false; remove(); };
});
```

#### Angular

```ts
import { Injectable, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { configure, onLink, resolveFromUrl } from '@li-nk.me/web-sdk';

@Injectable({ providedIn: 'root' })
export class LinkMeService implements OnDestroy {
  private teardown?: () => void;

  constructor(private readonly router: Router) { this.bootstrap(); }

  private async bootstrap() {
    await configure({ appId: environment.linkMeAppId });
    const initial = await resolveFromUrl();
    if (initial?.path) void this.router.navigateByUrl(initial.path);
    this.teardown = onLink((payload) => {
      if (payload?.path) void this.router.navigateByUrl(payload.path);
    }).remove;
  }

  ngOnDestroy() { this.teardown?.(); }
}
```

## API reference

| Function | Description |
| --- | --- |
| `configure(config)` | Initialize the SDK |
| `resolveFromUrl(url?)` | Resolve the current (or given) URL. Returns `LinkMePayload \| null` |
| `handleLink(url)` | Resolve a specific URL without stripping the location |
| `onLink(callback)` | Subscribe to future payloads (returns `{ remove }`) |
| `dispose()` | Remove navigation listeners and reset controller state |
| `claimDeferredIfAvailable()` | Fingerprint-based deferred claim |
| `track(event, properties?)` | Send analytics events |
| `setUserId(userId)` | Associate a user ID with events; pass `null` to clear it |
| `getLastPayload()` | Return the most recently resolved payload |
| `extractCidFromUrl(url)` | Extract a `cid` parameter from a URL string |

Payloads with `forceRedirectWeb: true` and a non-empty `webFallbackUrl` are handed to the browser without emitting `onLink`. Direct resolution methods still return the resolved payload so callers can observe the redirect decision.

### Config options

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `appId` | `string` | — | Required |
| `appKey` | `string` | — | Optional read-only key |
| `fetch` | `FetchLike` | — | Custom `fetch` for SSR |
| `autoResolve` | `boolean` | `true` (browser) | Auto-resolve current URL on load |
| `autoListen` | `boolean` | `true` (browser) | Hook into navigation events |
| `stripCid` | `boolean` | `true` | Strip `cid` from URL after resolution |
| `sendDeviceInfo` | `boolean` | `true` | Include device metadata |
| `resolveUniversalLinks` | `boolean` | `true` | Resolve same-origin URLs |
| `debug` | `boolean` | `false` | Log to console |

### Payload structure

```ts
type LinkMePayload = {
  linkId?: string;
  path?: string;
  params?: Record<string, string>;
  utm?: Record<string, string>;
  custom?: Record<string, string>;
  cid?: string;
  duplicate?: boolean;
};
```

### Class API

```ts
import { LinkMeWebClient } from '@li-nk.me/web-sdk';

const client = new LinkMeWebClient();
await client.configure({ appId: 'app_123' });
```

`LinkMeWebClient` exposes the same methods as the top-level functions.

## Security notes

- Use a **read-only** API key for browser usage. The SDK only calls read endpoints.
- The SDK strips `cid` parameters from the address bar after resolution to avoid leaking tokens via referrers.
- Ensure `configure` is only called on the client side when using SSR frameworks.

## Testing

For SDK development, run `nvm install && nvm use` to select the patched Node 24.22.1 LTS runtime. CI tests Node 22.23.4 and 24.22.1 and audits the independent lockfile.

- Run your dev server, click a LinkMe slug pointing to your domain, and confirm the page routes without a full reload.
- Open the same slug in an incognito window to validate the deferred flow.
- Use the browser network tab to inspect `/api/deeplink` and `/api/deferred/claim` requests.

## License

Apache-2.0

## Claim metadata (unreleased)

Updated Edge claims can include `claimId`, `claimMethod`, `matchConfidence`,
`attributionStatus`, `contractVersion`, and `claimPolicyVersion`. These optional
fields are preserved in the payload. Treat `fingerprint_exact` / `inferred` as
heuristic attribution, not a verified install or authenticated identity.
Replaying a CID returns its saved outcome; `duplicate` is a deprecated legacy
projection and must not suppress a new link navigation based on shared IP/UA.

Supply your app ID for deferred matching. New apps have fingerprint fallback
disabled; enable inferred attribution explicitly in app settings if appropriate.
Enabled matching requires a unique exact IP/UA candidate within 30 minutes.
Explicit CID and Play referrer claims use the deterministic 72-hour token window,
subject to link expiry and current app/link/domain policy.


Fingerprint matches return campaign/claim metadata with `navigationAllowed: false`.
They withhold the CID, link ID, path, custom data, query parameters and destination
URLs. The SDK suppresses app-routing callbacks and automatic browser launches for
these responses. Web callers can inspect returned metadata explicitly; native
routing APIs may return no link. A claim receipt is not a redeemable link token.
An independently supplied valid CID/referrer can still authorize navigation with
`navigationAllowed: true`; it retains the original claim receipt and attribution
classification rather than generating another claim.

## Tracking credentials and acceptance (unreleased Edge)

Configure an app ID and a key with `can_ingest` for client telemetry. In Portal,
select **Client analytics and link reading**; it cannot manage links, settings,
or keys, and cannot read private management/visitor diagnostics. A read-only key cannot ingest events. Both event routes require validated
credentials even when link resolution permits optional keys.

The existing `track` API uses the legacy `/api/app-events` route. Its return does
not prove delivery, durable webhook acknowledgement, or a verified conversion.
The SDK currently has no durable telemetry queue and does not promise event-ID
retry semantics. New Edge stores legacy events with app scope; an omitted event
ID receives a server ID, so calling `track` again creates another event. Optional
`userId` is a caller-provided pseudonym, not authenticated identity.

For explicit persistence receipts and safe HTTP retries, `/api/app-events/v1`
accepts a versioned envelope with a stable `eventId`, `occurredAt`, SDK/version,
platform, consent and structured properties. Reuse the same event ID and content
on retry; a successful receipt is 202, changed content is 409. The route requires
`can_ingest`, bounds the body to 32 KiB, and rate-limits by app. Claim events are
server-owned. This SDK has not yet adopted the versioned sender/queue contract.

## Request deadlines and cancellation (unreleased)

`requestTimeoutMs` defaults to 15000 and covers the complete HTTP fetch and
response-body operation. Set a positive integer up to 2147483647 milliseconds;
invalid overrides fail during configuration. `cancelPendingRequests()` aborts
current transport signals and settles callers even if an injected fetch ignores
abort. Later requests remain usable. No implicit retry is added. Cancellation or
a timeout cannot retract work already accepted by the server.

Reconfiguring or disposing cancels pending network work. Changing `setUserId`
also invalidates pending results; an old response cannot emit a route, launch a
browser or replace current payload state. Reconfigure clears payload, identity
and attribution context. Listeners survive reconfiguration, receive future
results without automatic replay, and are removed by `dispose()`. A lifecycle
change inside one listener stops delivery of that result to later listeners.

Web link methods return `null` on transport failure; React Native `handleUrl`
returns `false` and deferred methods return no link. Tracking keeps its existing
best-effort `void` result. These changes cover HTTP operations. Native URL,
clipboard and Install Referrer discovery waits and the complete cross-platform
lifecycle matrix still require separate qualification.
