export function frontmatter(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return {};
  const result = {};
  for (const line of match[1].split("\n")) {
    const field = line.match(/^([a-z][\w-]*):\s*(.*)$/i);
    if (field) result[field[1]] = field[2].replace(/^["']|["']$/g, "");
  }
  return result;
}

const internalLinkPatterns = [
  /\bhref=["'](\/[^"']+)["']/g,
  /\]\((\/[^)\s]+)[^)]*\)/g,
];

export function internalDestinations(content) {
  const destinations = [];
  for (const pattern of internalLinkPatterns) {
    for (const match of content.matchAll(pattern)) destinations.push(match[1]);
  }
  return destinations;
}
