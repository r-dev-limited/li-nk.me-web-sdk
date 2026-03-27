# LinkMe Web SDK

Zero-dependency browser SDK for LinkMe deep and deferred links.

- **Main Site**: [li-nk.me](https://li-nk.me)
- **Documentation**: [Web Setup](https://li-nk.me/docs/developer/setup/web)
- **Package**: [npm](https://www.npmjs.com/package/@li-nk.me/web-sdk)

## Installation

```bash
npm install @li-nk.me/web-sdk
```

## Basic Usage

```ts
import { configure, resolveFromUrl } from '@li-nk.me/web-sdk';

await configure({
  appId: 'app_123',
  appKey: 'lk_live_read_only_key',
  debug: process.env.NODE_ENV !== 'production',
});

const initial = await resolveFromUrl();
if (initial?.path) {
  // Route user
}
```

## API

| Function | Description |
| --- | --- |
| `configure(config)` | Initialize the SDK. |
| `resolveFromUrl(url?)` | Resolve the current (or given) URL. Returns `LinkMePayload \| null`. |
| `handleLink(url)` | Resolve a specific URL without stripping the location. |
| `onLink(callback)` | Subscribe to future payloads. Returns `{ remove }`. |
| `claimDeferredIfAvailable()` | Fingerprint-based deferred claim. |
| `track(event, properties?)` | Send analytics events. |
| `setUserId(userId)` | Associate a user ID with events. |
| `getLastPayload()` | Return the most recently resolved payload. |
| `extractCidFromUrl(url)` | Extract a `cid` parameter from a URL string. |

### Config options

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `baseUrl` | `string` | `https://li-nk.me` | Your custom edge domain. |
| `appId` | `string` | — | Required. |
| `appKey` | `string` | — | Optional read-only key. |
| `fetch` | `FetchLike` | — | Custom `fetch` for SSR. |
| `autoResolve` | `boolean` | `true` (browser) | Auto-resolve current URL on load. |
| `autoListen` | `boolean` | `true` (browser) | Hook into navigation events. |
| `stripCid` | `boolean` | `true` | Strip `cid` from URL after resolution. |
| `sendDeviceInfo` | `boolean` | `true` | Include device metadata. |
| `resolveUniversalLinks` | `boolean` | `true` | Resolve same-origin URLs. |
| `debug` | `boolean` | `false` | Log to console. |

### Class API

```ts
import { LinkMeWebClient } from '@li-nk.me/web-sdk';

const client = new LinkMeWebClient();
await client.configure({ appId: 'app_123' });
```

`LinkMeWebClient` extends `LinkMeController` and exposes the same methods as the top-level functions.

## iOS Pasteboard (Deferred Install)

Clipboard attribution on iOS is **not** performed by the Web SDK. It's handled by LinkMe Edge when redirecting to the App Store:

- When a link resolves to an `apps.apple.com` destination and **pasteboard is enabled for the app** (`ios_enable_pasteboard`), Edge serves an interstitial page that attempts to write a `cid` token to the clipboard before continuing to the App Store.
- Store URLs may be `https://apps.apple.com/...` or `itms-apps://apps.apple.com/...` (both should trigger the interstitial).
- Modern iOS Safari often **requires a user gesture** (tap) for clipboard writes, so this is best‑effort and may fall back to probabilistic fingerprint matching.

For full documentation, guides, and API reference, please visit our [Help Center](https://li-nk.me/docs/help).

## License

Apache-2.0
