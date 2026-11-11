# Customer support tenant documentation review

## Sources verified on 2026-11-11

- Tenant console navigation and Chinese locale descriptions in customer-saas.
- Website integration script and identity attributes in Settings.tsx.
- Knowledge article DTO: categoryId is required; path IDs are strings in MCP.
- MCP catalog, controller, registry and execution service: Streamable HTTP, OAuth, preview, requestId, expectedVersion, approval and operation status.
- MCP capabilities page: role inheritance and read-only statistics/billing/logs.
- Supported content language list; documentation and support locales differ.

## Publication boundaries

This release publishes documentation only, not customer-saas code. Console availability and tool schemas govern the deployed product. No exchange trading-account access, native mobile SDK, automatic email notification, or compatibility with every AI client is promised. New local customer-details UI is not documented as already deployed. File upload limits must be checked against the deployed tool schema. The documentation states the current implementation limit without promising every earlier deployment supports it.

## Translation

English and Simplified Chinese are authored and checked against source. Other locales use machine-assisted translation, protected code and structural validation. Native-language editorial review remains useful for finance terminology. Existing navigation translations and unchanged content are retained.

## MCP examples

JSON-RPC examples are post-initialization messages, not standalone HTTP requests. IDs, operation IDs and the 64-character preview version are placeholders. They must be replaced with the user's authorized tenant records. No real credentials or customer data are included.
