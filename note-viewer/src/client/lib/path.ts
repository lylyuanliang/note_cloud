export function dirname(path: string): string {
  const parts = path.split("/");
  parts.pop();
  return parts.join("/");
}

export function resolveRelativePath(fromFile: string, target: string): string {
  if (/^https?:\/\//.test(target) || target.startsWith("#")) {
    return target;
  }

  const base = dirname(fromFile);
  const stack = [...base.split("/").filter(Boolean)];

  for (const part of target.split("/")) {
    if (!part || part === ".") {
      continue;
    }
    if (part === "..") {
      stack.pop();
    } else {
      stack.push(part);
    }
  }

  return stack.join("/");
}
