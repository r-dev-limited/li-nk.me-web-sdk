# LinkMe Web SDK (Browser)

Zero-dependency TypeScript SDK for handling LinkMe deep links, deferred links, and lightweight analytics directly in the browser. Works with vanilla JS and any modern framework (Next.js, React, Vue, Svelte, Angular, etc.).

- Repo docs: ../../docs/help/docs/setup/web.md *(coming soon)*
- Hosted docs: https://li-nk.me/resources/developer/setup/web *(coming soon)*
- License: Apache-2.0

## Installation

```bash
npm install @li-nk.me/web-sdk
# or
pnpm add @li-nk.me/web-sdk
yarn add @li-nk.me/web-sdk
```

## Quick start

```ts
import { configure, resolveFromUrl, onLink, claimDeferredIfAvailable } from '@li-nk.me/web-sdk';

await configure({
  appId: 'app_123',
  // Use a read-only app key if your Edge instance enforces app credentials.
  appKey: 'lk_live_read_only_key',
});

// Initial page load (auto-run if you keep autoResolve = true)
const initial = await resolveFromUrl();
if (initial?.path) {
  routeUser(initial);
}

// Subscribe to future changes (history navigation, router pushes, manual handleLink)
const subscription = onLink((payload) => {
  routeUser(payload);
});

// Optional: deferred link fallback (probabilistic)
const deferred = await claimDeferredIfAvailable();
if (deferred?.path) {
  routeUser(deferred);
}

// Later, when appropriate
subscription.remove();
```

### Configuration options

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `appId` | `string` | `undefined` | Optional app identifier. Sent via `x-app-id` header. |
| `appKey` | `string` | `undefined` | Optional app key. Use a read-only key when enforced. |
| `fetch` | `typeof fetch` | `globalThis.fetch` | Provide your own fetch for environments that need a polyfill. |
| `autoResolve` | `boolean` | `true` in the browser | Resolve `window.location.href` immediately after `configure`. |
| `autoListen` | `boolean` | `true` in the browser | Subscribe to `popstate`/`hashchange` to pick up navigation changes. |
| `stripCid` | `boolean` | `true` | Removes `cid` from the address bar after it has been resolved. |
| `sendDeviceInfo` | `boolean` | `true` | Sends basic locale/UA/screen metadata when resolving links. |
| `resolveUniversalLinks` | `boolean` | `true` | POSTs to `/api/deeplink/resolve-url` when no `cid` is present but the URL matches your domain. |

### Runtime API

- `configure(config)` – call once on the client.
- `resolveFromUrl(url?)` – parse a URL (or current location) for `cid`/universal links.
- `handleLink(url)` – manually resolve an arbitrary URL string.
- `claimDeferredIfAvailable()` – probabilistic fallback for first launch after install.
- `onLink(listener)` – subscribe to resolved payloads; returns `{ remove }`.
- `getLastPayload()` – retrieve the most recent resolved payload (if any).
- `setUserId(id)` – associate analytics events with a user.
- `track(event, props?)` – emit custom events to `/api/app-events`.
- `LinkMeController` / `LinkMeWebClient` – class-shaped API for dependency injection and unit testing.

`LinkMePayload` includes `linkId`, `path`, `params`, `utm`, `custom`, `cid`, and `duplicate`.

### Advanced (DI & testing)

The SDK exposes the `LinkMeController` class, plus a pluggable `LinkMeEnvironment` and `HttpClient` factory. You can inject mocks for deterministic browser-free testing:

```ts
import { LinkMeController } from '@li-nk.me/web-sdk';

const controller = new LinkMeController({
  environment: myMockEnvironment,
  httpClientFactory: () => myMockHttpClient,
});

await controller.configure({ appId: 'app_123', appKey: 'key_123', fetch: unusedFetch });
const payload = await controller.resolveFromUrl('https://links.example?cid=abc');
```

Run the included unit tests with `npm -w sdks/web-sdk run test`.

## Framework recipes

Below are minimal client-side examples. Guard all `configure` calls so they only run in the browser (e.g., inside lifecycle hooks).

### Next.js (App Router)

```tsx
'use client';

import { useEffect } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { configure, onLink, resolveFromUrl } from '@li-nk.me/web-sdk';

export function LinkMeProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();

  useEffect(() => {
    let mounted = true;
    const bootstrap = async () => {
      await configure({
        appId: process.env.NEXT_PUBLIC_LINKME_APP_ID,
        appKey: process.env.NEXT_PUBLIC_LINKME_APP_READ_KEY,
      });

      const initial = await resolveFromUrl();
      if (mounted && initial?.path) {
        router.replace(initial.path.startsWith('/') ? initial.path : `/${initial.path}`);
      }
    };

    bootstrap();
    const subscription = onLink((payload) => {
      if (!payload?.path) return;
      router.push(payload.path.startsWith('/') ? payload.path : `/${payload.path}`);
    });

    return () => {
      mounted = false;
      subscription.remove();
    };
  }, [router]);

  // Force re-check whenever the visible URL changes.
  useEffect(() => {
    void resolveFromUrl(`${pathname}?${search.toString()}`);
  }, [pathname, search]);

  return <>{children}</>;
}
```

Mount `<LinkMeProvider>` at the root of your client layout (`app/layout.tsx`).

### Next.js (Pages Router)

```tsx
import { useEffect } from 'react';
import { useRouter } from 'next/router';
import { configure, onLink, resolveFromUrl } from '@li-nk.me/web-sdk';

export default function LinkMeGate({ children }) {
  const router = useRouter();

  useEffect(() => {
    let active = true;
    const init = async () => {
      await configure({
        appId: process.env.NEXT_PUBLIC_LINKME_APP_ID,
        appKey: process.env.NEXT_PUBLIC_LINKME_APP_READ_KEY,
      });
      const initial = await resolveFromUrl();
      if (active && initial?.path) {
        router.replace(initial.path);
      }
    };
    init();

    const sub = onLink((payload) => {
      if (payload?.path) router.push(payload.path);
    });
    return () => {
      active = false;
      sub.remove();
    };
  }, [router]);

  return children;
}
```

Wrap your custom `_app.tsx` with `<LinkMeGate>`.

### React (Vite / CRA)

```tsx
import { useEffect } from 'react';
import { configure, onLink, resolveFromUrl } from '@li-nk.me/web-sdk';

export function useLinkMe(onPayload: (payload: any) => void) {
  useEffect(() => {
    let mounted = true;
    const start = async () => {
      await configure({
        appId: import.meta.env.VITE_LINKME_APP_ID,
        appKey: import.meta.env.VITE_LINKME_APP_READ_KEY,
      });
      const initial = await resolveFromUrl();
      if (mounted && initial) onPayload(initial);
    };
    start();
    const subscription = onLink((payload) => onPayload(payload));
    return () => {
      mounted = false;
      subscription.remove();
    };
  }, [onPayload]);
}
```

Call `useLinkMe` inside your root component, and handle payloads however you like (router pushes, analytics, etc.).

### Vue 3 (Composition API)

```ts
import { onMounted, onBeforeUnmount } from 'vue';
import { configure, onLink, resolveFromUrl } from '@li-nk.me/web-sdk';
import { useRouter } from 'vue-router';

export function useLinkMe() {
  const router = useRouter();
  let unsubscribe: (() => void) | null = null;

  onMounted(async () => {
    await configure({
      appId: import.meta.env.VITE_LINKME_APP_ID,
      appKey: import.meta.env.VITE_LINKME_APP_READ_KEY,
    });
    const initial = await resolveFromUrl();
    if (initial?.path) {
      router.replace(initial.path);
    }
    unsubscribe = onLink((payload) => {
      if (payload?.path) router.push(payload.path);
    }).remove;
  });

  onBeforeUnmount(() => {
    unsubscribe?.();
  });
}
```

### Svelte

```ts
import { onMount } from 'svelte';
import { goto } from '$app/navigation';
import { configure, resolveFromUrl, onLink } from '@li-nk.me/web-sdk';

onMount(() => {
  let active = true;
  (async () => {
    await configure({
      appId: import.meta.env.VITE_LINKME_APP_ID,
      appKey: import.meta.env.VITE_LINKME_APP_READ_KEY,
    });
    const initial = await resolveFromUrl();
    if (active && initial?.path) goto(initial.path, { replaceState: true });
  })();
  const { remove } = onLink((payload) => {
    if (payload?.path) goto(payload.path);
  });
  return () => {
    active = false;
    remove();
  };
});
```

### Angular

```ts
import { Injectable, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { configure, onLink, resolveFromUrl } from '@li-nk.me/web-sdk';

@Injectable({ providedIn: 'root' })
export class LinkMeService implements OnDestroy {
  private teardown?: () => void;

  constructor(private readonly router: Router) {
    this.bootstrap();
  }

  private async bootstrap() {
    await configure({
      appId: environment.linkMeAppId,
      appKey: environment.linkMeAppReadKey,
    });
    const initial = await resolveFromUrl();
    if (initial?.path) {
      void this.router.navigateByUrl(initial.path);
    }
    this.teardown = onLink((payload) => {
      if (payload?.path) void this.router.navigateByUrl(payload.path);
    }).remove;
  }

  ngOnDestroy() {
    this.teardown?.();
  }
}
```

Inject `LinkMeService` in your root component (e.g. `AppComponent`) to activate the SDK.

## Deferred links & analytics

- `claimDeferredIfAvailable()` should be called once on startup (after `configure`). It performs a probabilistic match when no `cid` is available and returns a payload if a deferred click is found.
- Use `setUserId()` right after your own authentication succeeds to attribute analytics events to a stable identifier.
- `track('open')` or `track('purchase', { plan: 'starter' })` can be invoked anywhere you need lightweight event logging.

## Security notes

- When keys are required, issue a *read-only* key for browser usage. The SDK only calls read endpoints (`GET /api/deeplink`, `POST /api/deeplink/resolve-url`, `POST /api/deferred/claim`, `POST /api/app-events`).
- Consider rate limiting public usage if you expose the SDK on public marketing pages.
- The SDK strips `cid` parameters from the address bar after they are resolved to avoid leaking tokens via referrers.

## Troubleshooting

- Verify `cid` query parameters make it through your router. If the parameter is removed before `configure`, pass the full URL into `resolveFromUrl(urlString)`.
- Use the browser devtools network tab to inspect calls to `/api/deeplink` and `/api/deferred/claim`.

---

Need a framework-specific helper we did not cover? Open an issue or PR — contributions welcome.
