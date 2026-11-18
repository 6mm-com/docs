const protectedTerms = [
  "Orange Bit Technologies Limited",
  "Embedded API / SDK",
  "Developer API",
  "Trading Widget SDK",
  "Trading Widget",
  "6MM Docs",
  "Agent Java SDK",
  "Agent PHP SDK",
  "Agent SDKs",
  "Agent SDK",
  "6 Market Maker",
  "API Key",
  "REST API",
  "WebSocket",
  "Webhooks",
  "Webhook",
  "webhooks",
  "webhook",
  "Java",
  "PHP",
  "OAuth",
  "OpenAPI",
  "Postman",
  "JWT",
  "HMAC",
  "SHA-256",
  "SDKs",
  "SDK",
  "APIs",
  "API",
  "6MM",
  "USDT",
  "KYC",
  "AML",
  "IP",
  "JSON",
  "HTTP",
  "HTTPS",
  "GET",
  "POST",
  "PUT",
  "DELETE",
  "PATCH",
  "OPTIONS",
  "listenKey",
];
const protectedTermPattern = new RegExp(
  `\\b(?:${protectedTerms
    .sort((left, right) => right.length - left.length)
    .map((term) => term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join("|")})\\b`,
  "g",
);

const validateRestoredText = (restored) => {
  if (/\[\[\[ph\d+\]\]\]/.test(restored)) {
    throw new Error(`Unrestored placeholder in translated text: ${restored}`);
  }
  return restored;
};

export function protectText(value) {
  const protectedValues = [];
  let text = value;
  const protect = (match) => {
    const token = `[[[ph${String(protectedValues.length).padStart(6, "0")}]]]`;
    protectedValues.push({ token, value: match });
    return token;
  };

  text = text.replace(/`[^`\n]+`/g, protect);
  text = text.replace(/\{[^{}\n]*\}/g, protect);
  text = text.replace(/(?<=\]\()\/[^)\s]+(?=\))/g, protect);
  text = text.replace(/https?:\/\/[^\s)>"']+/g, protect);
  text = text.replace(/\b[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}\b/g, protect);
  text = text.replace(/\|/g, protect);
  text = text.replace(/<[^>\n]+>/g, protect);

  text = text.replace(protectedTermPattern, protect);
  text = text.replace(/\b[a-z]+[A-Z][A-Za-z0-9]*\b/g, protect);
  text = text.replace(/\b[A-Z][A-Z0-9_-]{2,}\b/g, protect);

  if (protectedValues.length === 0) return { text, restore: validateRestoredText };

  return {
    text,
    restore(translated) {
      let restored = translated;
      for (let index = protectedValues.length - 1; index >= 0; index--) {
        const { token, value } = protectedValues[index];
        // Protected source text is literal, including JavaScript replacement tokens.
        restored = restored.replaceAll(token, () => value);
      }
      return validateRestoredText(restored);
    },
  };
}

function shouldTranslateLine(line) {
  if (!line.trim()) return false;
  if (/^\s*(?:---|\|?\s*:?-{3,}:?\s*(?:\|\s*:?-{3,}:?\s*)+\|?)\s*$/.test(line)) {
    return false;
  }
  if (/^\s*(?:slug|layout|icon|canonical-url|hide-[\w-]+):/.test(line)) {
    return false;
  }
  return /[A-Za-z]/.test(line);
}

export function extractDocumentRecords(content) {
  const lines = content.split("\n");
  const records = [];
  let attributeSequence = 0;
  let inFence = false;
  let inFrontmatter = false;
  let frontmatterClosed = false;

  function translationToken(value, index) {
    const token = `[[[attr${String(attributeSequence).padStart(6, "0")}]]]`;
    attributeSequence += 1;
    records.push({
      kind: "attribute",
      index,
      token,
      ...protectText(value),
    });
    return token;
  }

  function tokenizeTextFragment(fragment, index) {
    if (!/[A-Za-z]/.test(fragment)) return fragment;
    const leading = fragment.match(/^\s*/)?.[0] ?? "";
    const trailing = fragment.match(/\s*$/)?.[0] ?? "";
    const core = fragment.slice(leading.length, fragment.length - trailing.length || undefined);
    if (!core) return fragment;
    return `${leading}${translationToken(core, index)}${trailing}`;
  }

  function tokenizeMarkdownLinks(value, index) {
    if (!value.includes("](")) return null;
    const linkPattern = /(!?)\[([^\]]+)\]\(([^)]+)\)/g;
    let cursor = 0;
    let output = "";
    let matched = false;
    for (const match of value.matchAll(linkPattern)) {
      matched = true;
      output += tokenizeTextFragment(value.slice(cursor, match.index), index);
      output += `${match[1]}[${translationToken(match[2], index)}](${match[3]})`;
      cursor = match.index + match[0].length;
    }
    if (!matched) return null;
    output += tokenizeTextFragment(value.slice(cursor), index);
    return output;
  }

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];

    if (index === 0 && line.trim() === "---") {
      inFrontmatter = true;
      continue;
    }
    if (inFrontmatter && line.trim() === "---") {
      inFrontmatter = false;
      frontmatterClosed = true;
      continue;
    }
    if (!inFrontmatter && /^```/.test(line.trim())) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;

    if (inFrontmatter) {
      const frontmatterMatch = line.match(
        /^(\s*(?:title|headline|subtitle|description):\s*)(["']?)(.*?)(\2)\s*$/,
      );
      if (frontmatterMatch && frontmatterMatch[3]) {
        const protectedRecord = protectText(frontmatterMatch[3]);
        records.push({
          kind: "line",
          index,
          prefix: `${frontmatterMatch[1]}${frontmatterMatch[2]}`,
          suffix: frontmatterMatch[4],
          ...protectedRecord,
        });
      }
      continue;
    }

    if (!frontmatterClosed || !shouldTranslateLine(line)) continue;

    const lineWithAttributeTokens = line.replace(
      /\b(title|alt|aria-label|label|placeholder)="([^"]+)"/g,
      (match, attribute, value) => {
        if (!/[A-Za-z]/.test(value)) return match;
        return `${attribute}="${translationToken(value, index)}"`;
      },
    );
    lines[index] = lineWithAttributeTokens;

    if (/^\s*\|.*\|\s*$/.test(lineWithAttributeTokens)) {
      const cells = lineWithAttributeTokens.split("|");
      const rebuilt = cells.map((cell) => {
        if (!/[A-Za-z]/.test(cell)) return cell;
        const leading = cell.match(/^\s*/)?.[0] ?? "";
        const trailing = cell.match(/\s*$/)?.[0] ?? "";
        const core = cell.slice(leading.length, cell.length - trailing.length || undefined);
        if (!core || /^:?-+:?$/.test(core)) return cell;
        if (
          /^(?:string|bool|boolean|int32|int64|float|double|integer|number|object|array|null)$/i.test(
            core,
          )
        ) {
          return cell;
        }
        const linked = tokenizeMarkdownLinks(core, index);
        return `${leading}${linked ?? translationToken(core, index)}${trailing}`;
      });
      lines[index] = rebuilt.join("|");
      continue;
    }

    if (
      /^\s*<\/?(?:h[1-6]|div|span|p|Card|CardGroup|Button|Frame|Tabs|Tab|Accordion|AccordionGroup|Note|Warning|Tip|Info|img)\b/i.test(
        lineWithAttributeTokens,
      )
    ) {
      const parts = lineWithAttributeTokens.split(/(<[^>\n]+>)/g);
      const rebuilt = parts.map((part) => {
        if (!part || /^<[^>\n]+>$/.test(part) || !/[A-Za-z]/.test(part)) return part;
        return tokenizeTextFragment(part, index);
      });
      lines[index] = rebuilt.join("");
      continue;
    }

    const blockPrefix = lineWithAttributeTokens.match(/^(\s*(?:(?:>\s*)+|#{1,6}\s+|\d+\.\s+|[-*]\s+))/)?.[0] ?? "";
    const linkedLine = tokenizeMarkdownLinks(lineWithAttributeTokens.slice(blockPrefix.length), index);
    if (linkedLine != null) {
      lines[index] = blockPrefix + linkedLine;
      continue;
    }

    const protectedRecord = protectText(lineWithAttributeTokens.slice(blockPrefix.length));
    if (
      !/[A-Za-z]/.test(
        protectedRecord.text.replace(/\[\[\[ph\d+\]\]\]/g, ""),
      )
    ) {
      continue;
    }
    records.push({ kind: "line", index, prefix: blockPrefix, suffix: "", ...protectedRecord });
  }

  return { lines, records };
}
