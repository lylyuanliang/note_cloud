import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { FileContent, PortalData, TreeNode } from "../shared/types";
import { PortalHome } from "./components/PortalHome";
import { Workspace } from "./components/Workspace";
import { api } from "./lib/api";
import { parseMarkdownNavigationTarget } from "./lib/markdown";

type ViewState =
  | { mode: "home" }
  | { mode: "workspace"; path: string; anchor?: string };

type ThemeMode = "light" | "dark" | "system";

function extractErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return "发生未知错误";
}

function findNodeByPath(root: TreeNode, targetPath: string): TreeNode | undefined {
  if (root.path === targetPath) {
    return root;
  }

  for (const child of root.children || []) {
    const found = findNodeByPath(child, targetPath);
    if (found) {
      return found;
    }
  }

  return undefined;
}

function resolveFilePath(node: TreeNode): string | undefined {
  if (node.type === "file") {
    return node.path;
  }
  return node.overviewPath;
}

function systemPrefersDark(): boolean {
  return typeof window.matchMedia === "function" && window.matchMedia("(prefers-color-scheme: dark)").matches;
}

export function App() {
  const [view, setView] = useState<ViewState>({ mode: "home" });
  const [portal, setPortal] = useState<PortalData>();
  const [portalLoading, setPortalLoading] = useState(true);
  const [portalError, setPortalError] = useState<string>();
  const [tree, setTree] = useState<TreeNode>();
  const [workspaceLoading, setWorkspaceLoading] = useState(false);
  const [workspaceError, setWorkspaceError] = useState<string>();
  const [currentFile, setCurrentFile] = useState<FileContent>();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => localStorage.getItem("note-viewer-sidebar-collapsed") === "true");
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => {
    const stored = localStorage.getItem("note-viewer-theme-mode");
    return stored === "light" || stored === "dark" || stored === "system" ? stored : "system";
  });

  const viewRef = useRef(view);
  const currentFileRef = useRef<FileContent | undefined>(currentFile);
  const treeRef = useRef<TreeNode | undefined>(tree);

  useEffect(() => {
    viewRef.current = view;
  }, [view]);

  useEffect(() => {
    currentFileRef.current = currentFile;
  }, [currentFile]);

  useEffect(() => {
    treeRef.current = tree;
  }, [tree]);

  useEffect(() => {
    localStorage.setItem("note-viewer-sidebar-collapsed", String(sidebarCollapsed));
  }, [sidebarCollapsed]);

  useEffect(() => {
    const applyTheme = () => {
      const resolved =
        themeMode === "system"
          ? systemPrefersDark()
            ? "dark"
            : "light"
          : themeMode;
      document.documentElement.dataset.theme = resolved;
    };

    localStorage.setItem("note-viewer-theme-mode", themeMode);
    applyTheme();

    if (themeMode !== "system") {
      return;
    }

    if (typeof window.matchMedia !== "function") {
      return;
    }

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    media.addEventListener("change", applyTheme);
    return () => media.removeEventListener("change", applyTheme);
  }, [themeMode]);

  const loadPortal = useCallback(async () => {
    setPortalLoading(true);
    setPortalError(undefined);
    try {
      setPortal(await api.portal());
    } catch (error) {
      setPortalError(extractErrorMessage(error));
    } finally {
      setPortalLoading(false);
    }
  }, []);

  const loadTree = useCallback(async () => {
    const nextTree = await api.tree();
    setTree(nextTree);
    return nextTree;
  }, []);

  const loadFile = useCallback(async (path: string) => {
    const file = await api.file(path);
    setCurrentFile(file);
    return file;
  }, []);

  const refreshWorkspace = useCallback(
    async (requestedPath: string, existingTree?: TreeNode) => {
      setWorkspaceLoading(true);
      setWorkspaceError(undefined);
      try {
        const nextTree = existingTree || treeRef.current || (await loadTree());
        const node = findNodeByPath(nextTree, requestedPath);
        if (!node) {
          setCurrentFile(undefined);
          throw new Error(`路径不存在：${requestedPath}`);
        }

        const previewPath = resolveFilePath(node);
        if (previewPath) {
          await loadFile(previewPath);
        } else {
          setCurrentFile(undefined);
        }
      } catch (error) {
        setWorkspaceError(extractErrorMessage(error));
      } finally {
        setWorkspaceLoading(false);
      }
    },
    [loadFile, loadTree]
  );

  useEffect(() => {
    void loadPortal();
  }, [loadPortal]);

  useEffect(() => {
    if (view.mode !== "workspace") {
      return;
    }
    void refreshWorkspace(view.path, treeRef.current);
  }, [refreshWorkspace, view.mode, view.mode === "workspace" ? view.path : undefined]);

  useEffect(() => {
    if (view.mode !== "workspace" || !view.anchor || currentFile?.path !== view.path) {
      return;
    }

    const anchor = decodeURIComponent(view.anchor);
    const scrollToAnchor = () => {
      const target =
        document.getElementById(anchor) ||
        document.getElementById(view.anchor || "");
      target?.scrollIntoView({ block: "start" });
    };

    const frameId = window.requestAnimationFrame(scrollToAnchor);
    return () => window.cancelAnimationFrame(frameId);
  }, [currentFile, view]);

  useEffect(() => {
    const eventSource = new EventSource(api.eventsUrl());

    eventSource.addEventListener("tree-changed", () => {
      void loadPortal();
      if (viewRef.current.mode === "workspace") {
        void loadTree().then((nextTree) => refreshWorkspace(viewRef.current.mode === "workspace" ? viewRef.current.path : "", nextTree));
      }
    });

    eventSource.addEventListener("file-changed", () => {
      const openFile = currentFileRef.current;
      if (viewRef.current.mode !== "workspace" || !openFile) {
        return;
      }
      void loadFile(openFile.path).catch((error) => {
        setWorkspaceError(extractErrorMessage(error));
      });
    });

    return () => eventSource.close();
  }, [loadFile, loadPortal, refreshWorkspace]);

  const handleOpenPath = useCallback((path: string) => {
    const target = parseMarkdownNavigationTarget(path);
    setView({ mode: "workspace", path: target.path, anchor: target.anchor });
  }, []);

  const handleBackHome = useCallback(() => {
    setView({ mode: "home" });
    setWorkspaceError(undefined);
  }, []);

  const handleSelectNode = useCallback((node: TreeNode) => {
    setView({ mode: "workspace", path: node.path });
  }, []);

  const handleToggleSidebar = useCallback(() => {
    setSidebarCollapsed((collapsed) => !collapsed);
  }, []);

  const headerTitle = useMemo(
    () => (view.mode === "home" ? "首页门户" : "知识库工作台"),
    [view.mode]
  );

  return (
    <main className="app-shell">
      <header className="app-header">
        <div>
          <p className="app-header__eyebrow">笔记预览器</p>
          <h1>{headerTitle}</h1>
        </div>
        <p className="app-header__status">
          {view.mode === "home" ? "浏览常用入口和仓库简介" : "查看目录树、预览内容并跟随文件变化刷新"}
        </p>
      </header>

      <div className="app-content">
        {view.mode === "home" ? (
          <PortalHome
            data={portal}
            loading={portalLoading}
            error={portalError}
            onOpenPath={handleOpenPath}
          />
        ) : (
          <Workspace
            initialPath={view.path}
            currentFile={currentFile}
            tree={tree}
            loading={workspaceLoading}
            error={workspaceError}
            sidebarCollapsed={sidebarCollapsed}
            themeMode={themeMode}
            onBackHome={handleBackHome}
            onOpenPath={handleOpenPath}
            onSelectNode={handleSelectNode}
            onToggleSidebar={handleToggleSidebar}
            onThemeModeChange={setThemeMode}
          />
        )}
      </div>
    </main>
  );
}
