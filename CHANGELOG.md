# Changelog

All notable changes to the LinkMe Web SDK.

## 0.2.15

- Drops in-flight link and deferred-claim responses after disposal or reconfiguration so an older app configuration cannot emit stale payloads.
- Adds regression coverage for cross-configuration response isolation.

## 0.2.14

- Sends analytics using Edge's `type` and serialized `detail` fields with link/CID context.
- Preserves forced-web payload fields, honors `stripCid`, adds browser redirect ownership, and supports disposal and identity reset.
- Preserves `cid`/`duplicate` attribution fields and rejects empty or unknown response objects.
- Upgrades the test/build toolchain to Vitest 5, coverage-v8 5, TypeScript 6, and rimraf 6; production builds exclude tests.

## 0.2.13

- Tightens deferred claim parsing to LinkMe hosts/token format only.
- General improvements to URL resolution reliability.

## 0.2.12

- Adds support for force-web redirect payloads.
- Improved handling of cross-origin link resolution.

## 0.2.11

- Internal reliability improvements for link resolution.

## 0.2.10

- Improved slug resolution behavior.
- Better routing consistency across redirect scenarios.

## 0.2.9

- Improved handling of edge redirect scenarios.

## 0.2.8

- General stability and bug fixes.

## 0.2.7

- Adds `isLinkMe` and `url` fields to payloads to distinguish LinkMe-managed links from basic universal links.

## 0.2.5

- Relaxes deferred claim parsing to accept branded LinkMe domains and structured tokens.

## 0.2.4

- SDK alignment release across all platforms.

## 0.2.3

- Internal improvements to deferred claim handling.

## 0.2.1

- Adds `debug` flag to config for verbose console instrumentation.
- Fingerprint-based deferred claim improvements.

## 0.2.0

- Deferred deep linking via fingerprint-based claim.
- `resolveFromUrl()` for automatic URL resolution on page load.
- `onLink()` listener for navigation-triggered link resolution.
- `autoResolve`, `autoListen`, `stripCid` configuration options.
- `resolveUniversalLinks` for same-origin URL resolution.
- Analytics event tracking with `track()`.
- User ID association with `setUserId()`.
- Class-based `LinkMeWebClient` API for dependency injection.

## 0.1.0

- Initial public release on npm.
- Zero-dependency TypeScript library for all modern frameworks.
