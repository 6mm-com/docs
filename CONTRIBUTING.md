# Contributing to 6MM Documentation

Thank you for improving the 6MM documentation.

This repository is public so developers, partners, and readers can suggest improvements. All changes are reviewed before they are merged into `main`.

## How to Contribute

For small fixes, use **Edit this page** from the hosted documentation. GitHub will open a pull request if you do not have direct write access.

For larger updates, open a pull request directly against this repository.

## Source Files

Documentation source files live under:

- `fern/docs/pages/` for English pages
- `fern/docs.yml` for English navigation, tabs, redirects, and site configuration
- `fern/translations/<locale>/` for locales handled by Fern's native localization

List every English source page in `fern/docs.yml` navigation. Generation and
validation use that list directly when pages are added or retired.

English is the source of truth. If an English page changes, regenerate the affected
locales with `npm run translations:generate -- --locales=<locale>`. For a deliberate
manual translation, refresh its source hash with
`npm run translations:refresh-manifest -- --locales=<locale>`.

Incremental generation reuses an existing navigation overlay once its English
navigation has been cached. Review navigation changes when the English tabs or
sidebar change, or run `npm run translations:generate -- --labels-only --locales=<locale>`
to regenerate navigation labels explicitly.

After translation generation, run `npm run translations:polish`. The repository
checks verify all 20 public locales, canonical URLs, internal links, code
samples, and locale configuration.

## Validation

Use Node.js 22 to match CI (Node.js 20+ is required). Run validation before opening
a pull request:

```bash
npm ci
npm run check
```

For changes to scripts, styles, or navigation, also run the browser regression
suite. CI runs this suite for every pull request:

```bash
npm ci --prefix tests/browser --ignore-scripts
npm --prefix tests/browser run install:browsers
npm run browser:check
```

The suite tests the custom UI in Chromium and WebKit with simulated Fern routing
and customer-support services. It does not publish or send production requests.

## Content Standards

Good 6MM documentation should be:

- Accurate and current
- Clear enough for engineering teams to implement
- Precise about security, signing, credentials, custody, and trading risk
- Written for partners, developers, and operators rather than for marketing copy
- Consistent across all supported locales

Do not include:

- API secrets, private keys, tokens, passwords, or credentials
- Internal-only endpoints, dashboards, logs, or unreleased infrastructure details
- Customer data, partner-specific business terms, or private operational incidents
- Unsupported SDK methods or behavior that has not been released

## Pull Request Checklist

Before requesting review:

- Confirm the affected pages and navigation entries are correct.
- Update or regenerate all affected locales.
- Run `npm run check`.
- Add screenshots or context when the change affects layout, navigation, or downloads.

Maintainers may ask for product, engineering, security, or legal review depending on the content area.

## Contribution Terms

By submitting a contribution, you agree that 6MM may use, edit, publish, and
distribute your contribution as part of the official 6MM documentation and
related materials.
