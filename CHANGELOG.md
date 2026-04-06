# Changelog

All notable changes to the LinkMe Web SDK.

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
