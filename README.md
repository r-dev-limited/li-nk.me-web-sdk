# LinkMe Web SDK

Zero-dependency browser SDK for LinkMe deep and deferred links.

- **Main Site**: [li-nk.me](https://li-nk.me)
- **Documentation**: [Web Setup](https://li-nk.me/docs/developer/setup/web)
- **Package**: [npm](https://www.npmjs.com/package/@li-nk/web-sdk)

## Installation

```bash
npm install @li-nk/web-sdk
```

## Basic Usage

```ts
import { configure, resolveFromUrl } from '@li-nk/web-sdk';

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

## iOS Pasteboard (Deferred Install)

Clipboard attribution on iOS is **not** performed by the Web SDK. It’s handled by LinkMe Edge when redirecting to the App Store:

- When a link resolves to an `apps.apple.com` destination and **pasteboard is enabled for the app** (`ios_enable_pasteboard`), Edge serves an interstitial page that attempts to write a `cid` token to the clipboard before continuing to the App Store.
- Store URLs may be `https://apps.apple.com/...` or `itms-apps://apps.apple.com/...` (both should trigger the interstitial).
- Modern iOS Safari often **requires a user gesture** (tap) for clipboard writes, so this is best‑effort and may fall back to probabilistic fingerprint matching.

For full documentation, guides, and API reference, please visit our [Help Center](https://li-nk.me/docs/help).

## License

Apache-2.0
