# 6MM Docs

Official 6MM documentation for crypto infrastructure, embedded trading, SDKs, APIs, AI Hub, and partner integration.

The production docs are edited and published from the `fern/` directory through Fern.

- Website: https://www.6mm.com
- Documentation: https://docs.6mm.com
- App demo: https://app.6mm.com

## Fern Files

- `fern/docs.yml` configures hosting, tabs, navigation, theme, logo, and links.
- `fern/docs/pages/` contains the English default docs.
- `fern/translations/zh/` contains the Chinese localized docs and navigation.
- `fern/docs/assets/` contains the 6MM logo and favicon.

## Commands

```bash
npm install
npm run fern:check
npm run fern:dev
```

## Contributing

Use the **Edit this page** link in the published docs or open a pull request directly against this repository.

Before submitting a documentation change, run:

```bash
npm run fern:check
```

Local Fern preview:

```text
English: http://127.0.0.1:3000/home
Chinese: http://127.0.0.1:3000/zh/home
```

Fern localization renders the language selector in the header.

## Publish

Log in to Fern:

```bash
npx fern-api login
```

Publish:

```bash
npm run fern:publish
```

The configured Fern instance is:

```text
6mm.docs.buildwithfern.com
```

The intended custom domain is:

```text
docs.6mm.com
```

Cloudflare should only manage DNS for `docs.6mm.com`; do not deploy this site with Cloudflare Pages unless you move away from Fern hosting.
