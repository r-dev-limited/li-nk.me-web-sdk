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

For full documentation, guides, and API reference, please visit our [Help Center](https://li-nk.me/docs/help).

## License

Apache-2.0
