# Contributing to 6MM Docs

Thank you for helping improve the 6MM documentation.

## Editing Pages

Documentation source files live under:

- `fern/docs/pages/` for English pages
- `fern/translations/zh/docs/pages/` for Simplified Chinese pages
- `fern/docs.yml` and `fern/translations/zh/docs.yml` for navigation

For small fixes, use the **Edit this page** link in the hosted docs. GitHub will create a pull request if you do not have direct write access.

## Validation

Run the Fern check before opening a pull request:

```bash
npm install
npm run fern:check
```

## Content Guidelines

- Keep public docs accurate, partner-facing, and implementation-focused.
- Do not include private credentials, internal-only endpoints, unreleased secrets, or customer data.
- Keep code identifiers, API paths, SDK method names, and headers unchanged when translating.
- Update both English and Chinese pages when the change affects both languages.

## Pull Requests

Pull requests should explain:

- What changed
- Which pages were updated
- Whether the change affects navigation
- Whether `npm run fern:check` passed
