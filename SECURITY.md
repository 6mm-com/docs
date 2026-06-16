# Security Policy

Security reports should be handled privately.

Please do not disclose vulnerabilities, credential exposure, authentication issues, webhook verification issues, trading-entry issues, or partner-impacting security findings through public GitHub issues or pull requests.

## Reporting a Security Issue

Use the official 6MM support and security reporting paths:

- https://docs.6mm.com/resources/support/security-reporting
- https://docs.6mm.com/resources/contact/support

When reporting an issue, include:

- Affected product area, endpoint, SDK, or documentation page
- Environment and approximate time range
- Reproduction steps
- Request IDs, webhook event IDs, logs, screenshots, or other evidence
- Whether the issue is currently active
- Any known impact to users, partners, orders, balances, credentials, or availability

## Sensitive Information

Do not include secrets in this repository, including:

- API keys, tokens, passwords, private keys, signing secrets, or session cookies
- Internal infrastructure URLs or dashboards
- Customer data or partner-specific confidential information
- Production logs that contain identifiers or credentials

If sensitive information was committed or exposed, rotate the affected secret immediately and contact the 6MM team through the official security reporting path.
