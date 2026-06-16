# 6MM Documentation Website Design

## Positioning

This site should feel like a serious developer documentation product for 6MM partners. It should not feel like a marketing landing page. The first screen should help developers answer:

- Which SDK do I need?
- What does the frontend integrate?
- What does the backend integrate?
- Where do I start?

## Style Direction

Use a clean, technical, enterprise SaaS style aligned with the black/white theme behavior of `6mm.com`, closer to the feel of Fern-style API documentation than a default documentation template:

- White default theme with black text, subtle gray borders, and low-noise navigation.
- Dark theme with near-black backgrounds, white text, restrained borders, and code-first contrast.
- 6MM blue as the accent color for links, active navigation, and important technical highlights.
- Left navigation, center docs, right page outline.
- Search-first top bar with compact external links and theme/language controls.
- Neutral gray text, restrained borders, and compact spacing.
- Code blocks with copy affordances and clear syntax highlighting.
- Tables for API fields, headers, status codes, and checklists.
- No decorative gradient blobs, oversized marketing hero, or heavy illustration.

## Layout

Recommended layout:

- Top navigation: 6MM Docs, 6MM website, Launch App, language switcher.
- Left sidebar: stable SDK navigation grouped by integration path.
- Main content: readable documentation width, code-first examples, tables, warnings.
- Right rail: page table of contents.
- Footer: SDK links and 6MM ecosystem links.

## Implementation

The current production implementation is a Fern documentation site. The source of truth for published docs is the `fern/` directory, not the legacy Vite/React prototype or the generated `build/` directory.

## Domain

Use:

```text
docs.6mm.com
```

The root path serves English documentation. Simplified Chinese is served under:

```text
/zh/
```

## Information Architecture

Recommended top-level groups:

1. Overview
2. Trading Widget SDK
3. Agent SDK
4. Security & Operations
5. FAQ / Troubleshooting

The homepage should briefly explain the recommended architecture:

```text
Partner Web App -> Trading Widget SDK -> Partner Backend -> Agent SDK -> 6MM Agent API
```

## Bilingual Strategy

Use separate language routes:

- `/` for English
- `/zh/` for Simplified Chinese

Do not mix Chinese and English in the same page. Translate by concept, not sentence-by-sentence. Keep API names, method names, event names, headers, and code identifiers unchanged.

## Content Cleanup Before Launch

Before publishing, clean the source documents:

- Normalize Trading Widget version language: public docs should say `Trading Widget SDK v1`, current capability version `1.3.0`.
- Fix heading numbering in the Trading Widget document where section 5 contains `3.1` and `3.2`.
- Move shared concepts such as signing, webhook verification, idempotency, and secret handling into common Security pages.
- Keep Java and PHP pages language-specific only where API usage differs.
- Clearly mark that Java SDK supports `createEmbedToken`, while PHP SDK currently does not wrap it.

## Visual Tone

The visual tone should be:

- Precise
- Stable
- Partner-facing
- Infrastructure-grade
- Easier to scan than a GitBook export

The site should quietly inherit 6MM branding without copying the public homepage's promotional composition.
