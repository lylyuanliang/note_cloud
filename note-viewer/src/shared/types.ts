export type FileKind = "markdown" | "text" | "image" | "unsupported";

export type TreeNode = {
  name: string;
  path: string;
  type: "directory" | "file";
  children?: TreeNode[];
  overviewPath?: string;
  updatedAt?: string;
  fileKind?: FileKind;
};

export type FileContent = {
  path: string;
  name: string;
  kind: "markdown" | "text";
  language?: string;
  content: string;
  updatedAt?: string;
};

export type PortalData = {
  repoReadme?: FileContent;
  entryCards: Array<{
    title: string;
    path: string;
    description?: string;
    kind: "top-level" | "highlight";
  }>;
};

export type SearchResult = {
  title: string;
  path: string;
  type: "directory" | "file";
  snippet?: string;
};

export type ViewerConfig = {
  repoRoot: string;
  contentRoot: string;
  port: number;
  publicBasePath: string;
};

declare global {
  interface Window {
    __NOTE_VIEWER_CONFIG__?: {
      publicBasePath: string;
    };
  }
}
