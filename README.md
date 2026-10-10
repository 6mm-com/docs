# 6MM Documentation

This repository powers the official 6MM documentation site.

6MM provides trading infrastructure for partners building embedded trading experiences, white-label exchanges, institutional liquidity workflows, developer integrations, and AI-native market access.

- Website: https://www.6mm.com
- Documentation: https://docs.6mm.com
- App: https://app.6mm.com
- Official GitHub: https://github.com/6mm-com

## Documentation Scope

The documentation covers:

- Embedded trading and partner integration flows
- Trading Widget SDK and Agent SDK usage
- REST API and WebSocket integration
- Perpetual trading concepts, margin, risk, fees, and order behavior
- Brand assets, launch resources, support paths, and security reporting

## Repository Structure

```text
fern/
  docs.yml                         # English docs configuration, navigation, theme, redirects
  docs/pages/                      # English documentation pages
  translations/<locale>/           # 19 non-English Fern-native overlays, including zh-CN
  docs/assets/                     # Logos, favicon, brand assets, and downloads
scripts/
  generate-translations.mjs        # Translation generation and manifest refresh
  polish-core-translations.mjs     # Deterministic terminology and quality fixes
  check-translations.mjs           # Locale, SEO, link, asset, and manifest validation
```

The production documentation source of truth is the `fern/` directory.

## SDK documentation baseline

Agent Java SDK documentation targets the public `v0.3.0` source tag. The Java
sidebar contains 17 pages covering installation, identity, assets, Contract and
Funding transfers, entry authentication, seconds trading, execution environments,
six perpetual queries, response fields, fiat reference rates and upgrades.

Sources: [tagged README](https://github.com/6mm-com/agent-java-sdk/blob/v0.3.0/README.md),
[partner integration contract](https://github.com/6mm-com/agent-java-sdk/blob/v0.3.0/docs/merchant-integration.md),
and [response fields](https://github.com/6mm-com/agent-java-sdk/blob/v0.3.0/docs/perpetual-response-fields.md).
The public Trading Widget `v1` runtime was checked at version `1.8.0` on
2026-10-10; frontend and backend SDK versions are independent.

English and Simplified Chinese are reviewed together. The other 18 locales use
machine-assisted translation with code, links, identifiers and structure checks;
these checks do not substitute for native-language editorial review. The current
navigation has 139 unique pages per locale.

## Local Development

Install dependencies:

```bash
npm ci
```

Run validation:

```bash
npm run check
```

Start a local Fern preview:

```bash
npm run fern:dev
```

Preview routes:

```text
English: http://127.0.0.1:3000/home
Simplified Chinese: http://127.0.0.1:3000/zh-CN/home
Turkish: http://127.0.0.1:3000/tr/home
Korean: http://127.0.0.1:3000/ko/home
Greek: http://127.0.0.1:3000/el/home
```

## Contributing

Use the **Edit this page** link on the documentation site or open a pull request directly in this repository.

Before submitting a pull request:

- Keep changes accurate, partner-facing, and implementation-focused.
- Update the English source first, then regenerate or intentionally update affected translations.
- Do not include credentials, private endpoints, unreleased secrets, customer data, or internal-only operational details.
- Run `npm run check`.

See [CONTRIBUTING.md](CONTRIBUTING.md) for the full contribution guide.

## Customer support integration

`fern/support-widget.js` loads the SaaS SDK from `https://cs.6mm.com/widget/widget.js` using the 6MM tenant's public `data-app-key`. This is a public tenant identifier, not a signing secret. If the key changes, update the loader and its assertion in `scripts/check-widget-sync.mjs` together.

The tenant's website allowlist must include `https://docs.6mm.com` and, when used, the fixed Fern host `https://6mm.docs.buildwithfern.com`. Other preview domains are not implicitly allowed.

The documentation site uses anonymous visitor access. Never embed identity-signing secrets or administrator passwords. The loader preserves bidirectional language and light/dark theme synchronization, with English as the fallback for unsupported widget languages.

## Publishing

The production site is hosted by Fern.

Configured domains:

```text
6mm.docs.buildwithfern.com
docs.6mm.com
```

Publish with:

```bash
npm run fern:publish
```

Cloudflare should manage DNS for `docs.6mm.com`; the documentation site itself should be published through Fern.

## Security

Please do not report vulnerabilities through public GitHub issues.

See [SECURITY.md](SECURITY.md) for the private reporting path.

## License

Copyright (c) 2026 6MM. All rights reserved.

This repository is public for documentation collaboration, review, and issue
tracking. It does not grant an open source or Creative Commons license for the
documentation, downloads, or brand materials.

## Local prediction content review

The Prediction section adds 17 pages across all 20 configured languages.
English and Simplified Chinese are authored together; Traditional Chinese is converted from the Chinese draft, and the other 17 locales use
machine-assisted translation and need native-language editorial review before release.
Review the business-rule checklist in `docs/prediction-content-review.md` before publication.

```bash
npm ci
npm run check
npm run preview:prediction
```

Open `http://127.0.0.1:3010/zh-CN/prediction/overview` (Chinese) or
`http://127.0.0.1:3010/prediction/overview` (English), then use the existing language menu.
The preview runs the normal Fern renderer with all configured languages.
Ports default to 3010/3011; use `npm run preview:prediction -- --port=3012 --backend-port=3013`
if needed. Nothing is published by this command.

The old Edge translation auth endpoint returned HTTP 404. The generator now defaults
to the public Google dictionary translation endpoint, with request throttling,
bounded retries, and protected-token validation. This unofficial endpoint may change;
`DOCS_TRANSLATION_PROVIDER=edge` retains the previous provider for environments where it works.
Existing manifest hashes still control incremental generation; do not refresh them to hide
missing translations. The full `npm run check` validates all 20 locales.
