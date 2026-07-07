function stripHash(value: string): [string, string | undefined] {
  const hashIndex = value.indexOf("#");
  if (hashIndex === -1) {
    return [value, undefined];
  }

  return [value.slice(0, hashIndex), value.slice(hashIndex + 1) || undefined];
}

function stripSearch(value: string): string {
  const searchIndex = value.indexOf("?");
  return searchIndex === -1 ? value : value.slice(0, searchIndex);
}

function baseHeadingId(text: string): string {
  const normalized = text
    .normalize("NFKD")
    .toLowerCase()
    .trim()
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{Letter}\p{Number}\s-]/gu, "")
    .replace(/[\s-]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return normalized || "section";
}

export function isInternalMarkdownLink(target: string): boolean {
  if (!target || target.startsWith("#") || /^(https?:)?\/\//.test(target) || target.startsWith("mailto:")) {
    return false;
  }

  const [withoutHash] = stripHash(target);
  return stripSearch(withoutHash).toLowerCase().endsWith(".md");
}

export function parseMarkdownNavigationTarget(target: string): {
  path: string;
  anchor?: string;
} {
  const [withoutHash, anchor] = stripHash(target);
  return {
    path: stripSearch(withoutHash),
    anchor
  };
}

export function buildHeadingId(text: string, duplicates: Map<string, number>): string {
  const baseId = baseHeadingId(text);
  const seen = duplicates.get(baseId) || 0;
  duplicates.set(baseId, seen + 1);
  return seen === 0 ? baseId : `${baseId}-${seen}`;
}

export function buildHeadingIds(texts: string[]): string[] {
  const duplicates = new Map<string, number>();
  return texts.map((text) => buildHeadingId(text, duplicates));
}
