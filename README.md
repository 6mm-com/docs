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
