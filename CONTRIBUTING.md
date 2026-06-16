# Contributing to 6MM Documentation

Thank you for improving the 6MM documentation.

This repository is public so developers, partners, and readers can suggest improvements. All changes are reviewed before they are merged into `main`.

## How to Contribute

For small fixes, use **Edit this page** from the hosted documentation. GitHub will open a pull request if you do not have direct write access.

For larger updates, open a pull request directly against this repository.

## Source Files

Documentation source files live under:

- `fern/docs/pages/` for English pages
- `fern/translations/zh/docs/pages/` for Simplified Chinese pages
- `fern/docs.yml` for English navigation, tabs, redirects, and site configuration
- `fern/translations/zh/docs.yml` for Simplified Chinese navigation

## Validation

Run Fern validation before opening a pull request:

```bash
npm install
npm run fern:check
```

## Content Standards

Good 6MM documentation should be:

- Accurate and current
- Clear enough for engineering teams to implement
- Precise about security, signing, credentials, custody, and trading risk
- Written for partners, developers, and operators rather than for marketing copy
- Consistent across English and Chinese where both languages apply

Do not include:

- API secrets, private keys, tokens, passwords, or credentials
- Internal-only endpoints, dashboards, logs, or unreleased infrastructure details
- Customer data, partner-specific business terms, or private operational incidents
- Unsupported SDK methods or behavior that has not been released

## Pull Request Checklist

Before requesting review:

- Confirm the affected pages and navigation entries are correct.
- Update both English and Chinese pages when required.
- Run `npm run fern:check`.
- Add screenshots or context when the change affects layout, navigation, or downloads.

Maintainers may ask for product, engineering, security, or legal review depending on the content area.

## Contribution Terms

By submitting a contribution, you agree that 6MM may use, edit, publish, and
distribute your contribution as part of the official 6MM documentation and
related materials.
