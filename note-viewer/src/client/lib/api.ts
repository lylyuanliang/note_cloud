import type {
  FileContent,
  PortalData,
  SearchResult,
  TreeNode
} from "../../shared/types";

function runtimeBasePath(): string {
  const configured = window.__NOTE_VIEWER_CONFIG__?.publicBasePath || "/";
  const withStart = configured.startsWith("/") ? configured : `/${configured}`;
  return withStart.endsWith("/") ? withStart : `${withStart}/`;
}

function apiUrl(path: string, params?: Record<string, string>) {
  const basePath = runtimeBasePath();
  const url = new URL(
    `${basePath.replace(/\/$/, "")}/${path.replace(/^\//, "")}`,
    window.location.origin
  );

  for (const [key, value] of Object.entries(params || {})) {
    url.searchParams.set(key, value);
  }

  return url.toString();
}

async function getJson<T>(path: string, params?: Record<string, string>): Promise<T> {
  const response = await fetch(apiUrl(path, params));
  if (!response.ok) {
    throw new Error(await response.text());
  }
  return response.json() as Promise<T>;
}

export const api = {
  portal: () => getJson<PortalData>("api/portal"),
  tree: () => getJson<TreeNode>("api/tree"),
  file: (path: string) => getJson<FileContent>("api/file", { path }),
  search: (q: string) => getJson<SearchResult[]>("api/search", { q }),
  assetUrl: (path: string) => apiUrl("api/asset", { path }),
  eventsUrl: () => apiUrl("api/events")
};
