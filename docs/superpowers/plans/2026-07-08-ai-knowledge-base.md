# AI Knowledge Base Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a local-first AI knowledge base to `note-viewer` with semantic search, note-grounded Q&A, citations, and provider interfaces that can switch from Ollama to OpenAI-compatible online services.

**Architecture:** Add an isolated `src/server/services/ai/` module for provider abstraction, document chunking, index persistence, vector search, and RAG orchestration. Expose the feature through `/api/ai/*`, then add a compact React AI panel that uses those APIs and reuses existing file navigation.

**Tech Stack:** TypeScript, Node 20, Express, React 18, Vite, Vitest, local Ollama HTTP API, JSON file persistence, in-memory cosine similarity.

## Global Constraints

- Default local provider is `AI_PROVIDER=ollama`.
- Future online provider is `AI_PROVIDER=openai-compatible`.
- Default Ollama base URL is `http://localhost:11434`.
- Docker Desktop host Ollama URL should be documented as `http://host.docker.internal:11434`.
- Default chat model is `qwen2.5:7b`.
- Default embedding model is `bge-m3`.
- Default AI index directory is `/app/data/ai-index`.
- Default retrieval count is `AI_TOP_K=6`.
- Default context limit is `AI_MAX_CONTEXT_CHARS=12000`.
- First version indexes Markdown and currently previewable text/config files only.
- First version skips images, zip files, binary files, ignored paths, and files over the configured maximum.
- First version uses manual reindex and marks the AI index stale on file changes.
- First version does not add editing, write-back, image understanding, OCR, agents, tool calls, auth, or external knowledge-base platforms.
- User-facing copy should be Chinese; code identifiers, commands, env vars, and model names remain in their original form.
- Follow existing Vitest patterns and keep all AI provider network calls mocked in automated tests.

---

## File Structure

Create or modify these files:

- Modify `note-viewer/src/shared/types.ts`: add shared AI request/response/config types and extend `ViewerConfig`.
- Modify `note-viewer/src/server/config.ts`: read AI-related environment variables.
- Create `note-viewer/src/server/services/ai/errors.ts`: typed HTTP-style AI errors.
- Create `note-viewer/src/server/services/ai/providers/types.ts`: provider interfaces.
- Create `note-viewer/src/server/services/ai/providers/createProvider.ts`: provider factory.
- Create `note-viewer/src/server/services/ai/providers/ollamaProvider.ts`: Ollama HTTP implementation.
- Create `note-viewer/src/server/services/ai/providers/openAiCompatibleProvider.ts`: OpenAI-compatible HTTP implementation.
- Create `note-viewer/src/server/services/ai/chunkDocuments.ts`: convert file contents into searchable chunks.
- Create `note-viewer/src/server/services/ai/vectorSearch.ts`: cosine similarity and topK search.
- Create `note-viewer/src/server/services/ai/aiIndexStore.ts`: load/save JSON index state.
- Create `note-viewer/src/server/services/ai/aiRepository.ts`: scan readable files, embed chunks, persist/load index, mark stale.
- Create `note-viewer/src/server/services/ai/ragService.ts`: semantic search and grounded Q&A.
- Create `note-viewer/src/server/routes/ai.ts`: `/api/ai/status`, `/api/ai/reindex`, `/api/ai/search`, `/api/ai/ask`.
- Modify `note-viewer/src/server/app.ts`: parse JSON, construct AI services, mount AI router, return stable AI HTTP errors.
- Modify `note-viewer/src/server/index.ts`: mark AI index stale when watcher sees repository changes.
- Modify `note-viewer/src/client/lib/api.ts`: add AI API client methods.
- Create `note-viewer/src/client/components/AiPanel.tsx`: user-facing AI panel.
- Modify `note-viewer/src/client/components/Workspace.tsx`: render AI panel and pass `onOpenPath`.
- Modify `note-viewer/src/client/styles/base.css`: add compact AI panel styling.
- Modify `note-viewer/docker-compose.yml`: add AI env vars and persistent `./data:/app/data`.
- Modify `note-viewer/.dockerignore`: ignore local data directory from image build context.
- Modify `note-viewer/README.md`: document Ollama setup, AI env vars, reindex, and provider switching.

---

### Task 1: Shared AI Types And Config

**Files:**
- Modify: `note-viewer/src/shared/types.ts`
- Modify: `note-viewer/src/server/config.ts`
- Test: `note-viewer/src/server/config.test.ts`

**Interfaces:**
- Produces: `ViewerConfig.ai: AiConfig`
- Produces: `AiConfig`, `AiStatus`, `AiSearchRequest`, `AiSearchResult`, `AiAskRequest`, `AiAskResponse`, `AiCitation`
- Consumed by later tasks: all server AI services and frontend API client

- [ ] **Step 1: Write the failing config test**

Create `note-viewer/src/server/config.test.ts`:

```ts
import { afterEach, describe, expect, it } from "vitest";
import { getConfig } from "./config";

const originalEnv = { ...process.env };

describe("getConfig AI settings", () => {
  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("uses local Ollama defaults for AI configuration", () => {
    delete process.env.AI_ENABLED;
    delete process.env.AI_PROVIDER;
    delete process.env.OLLAMA_BASE_URL;
    delete process.env.AI_CHAT_MODEL;
    delete process.env.AI_EMBEDDING_MODEL;
    delete process.env.AI_INDEX_DIR;
    delete process.env.AI_TOP_K;
    delete process.env.AI_MAX_CONTEXT_CHARS;

    const config = getConfig();

    expect(config.ai).toMatchObject({
      enabled: false,
      provider: "ollama",
      ollamaBaseUrl: "http://localhost:11434",
      chatModel: "qwen2.5:7b",
      embeddingModel: "bge-m3",
      topK: 6,
      maxContextChars: 12000
    });
    expect(config.ai.indexDir.endsWith("data/ai-index") || config.ai.indexDir.endsWith("data\\ai-index")).toBe(true);
  });

  it("reads OpenAI-compatible settings from environment", () => {
    process.env.AI_ENABLED = "true";
    process.env.AI_PROVIDER = "openai-compatible";
    process.env.OPENAI_COMPATIBLE_BASE_URL = "https://api.example.com/v1";
    process.env.OPENAI_API_KEY = "secret-key";
    process.env.AI_CHAT_MODEL = "chat-model";
    process.env.AI_EMBEDDING_MODEL = "embedding-model";
    process.env.AI_INDEX_DIR = "D:/ai-index";
    process.env.AI_TOP_K = "8";
    process.env.AI_MAX_CONTEXT_CHARS = "9000";

    expect(getConfig().ai).toEqual({
      enabled: true,
      provider: "openai-compatible",
      ollamaBaseUrl: "http://localhost:11434",
      openAiCompatibleBaseUrl: "https://api.example.com/v1",
      openAiApiKey: "secret-key",
      chatModel: "chat-model",
      embeddingModel: "embedding-model",
      indexDir: "D:\\ai-index",
      topK: 8,
      maxContextChars: 9000,
      maxFileChars: 200000
    });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```powershell
cd note-viewer
npm test -- src/server/config.test.ts
```

Expected: FAIL because `ViewerConfig` has no `ai` property and `config.test.ts` references missing types/config fields.

- [ ] **Step 3: Add shared AI types**

Modify `note-viewer/src/shared/types.ts` by adding these exports before `ViewerConfig`, then adding `ai: AiConfig` to `ViewerConfig`:

```ts
export type AiProviderName = "ollama" | "openai-compatible";

export type AiConfig = {
  enabled: boolean;
  provider: AiProviderName;
  ollamaBaseUrl: string;
  openAiCompatibleBaseUrl?: string;
  openAiApiKey?: string;
  chatModel: string;
  embeddingModel: string;
  indexDir: string;
  topK: number;
  maxContextChars: number;
  maxFileChars: number;
};

export type AiStatus = {
  enabled: boolean;
  provider: AiProviderName;
  chatModel?: string;
  embeddingModel?: string;
  indexedChunks: number;
  indexedFiles: number;
  lastIndexedAt?: string;
  indexing: boolean;
  stale: boolean;
};

export type AiSearchRequest = {
  query: string;
  topK?: number;
};

export type AiSearchResult = {
  path: string;
  title: string;
  heading?: string;
  snippet: string;
  score: number;
};

export type AiAskRequest = {
  question: string;
  topK?: number;
};

export type AiCitation = {
  path: string;
  title: string;
  heading?: string;
  snippet: string;
};

export type AiAskResponse = {
  answer: string;
  citations: AiCitation[];
  model: string;
};
```

Change `ViewerConfig` to:

```ts
export type ViewerConfig = {
  repoRoot: string;
  contentRoot: string;
  port: number;
  publicBasePath: string;
  ai: AiConfig;
};
```

- [ ] **Step 4: Implement config parsing**

Modify `note-viewer/src/server/config.ts`:

```ts
import { resolve } from "node:path";
import type { AiProviderName, ViewerConfig } from "../shared/types";

function normalizeBasePath(value: string | undefined): string {
  const raw = value || "/";
  const withStart = raw.startsWith("/") ? raw : `/${raw}`;
  return withStart.endsWith("/") ? withStart : `${withStart}/`;
}

function booleanEnv(value: string | undefined): boolean {
  return value === "true";
}

function numberEnv(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function providerEnv(value: string | undefined): AiProviderName {
  return value === "openai-compatible" ? "openai-compatible" : "ollama";
}

export function getConfig(): ViewerConfig {
  return {
    repoRoot: resolve(process.env.REPO_ROOT || "/workspace"),
    contentRoot: resolve(process.env.CONTENT_ROOT || "/workspace/笔记"),
    port: Number(process.env.PORT || 8080),
    publicBasePath: normalizeBasePath(process.env.PUBLIC_BASE_PATH),
    ai: {
      enabled: booleanEnv(process.env.AI_ENABLED),
      provider: providerEnv(process.env.AI_PROVIDER),
      ollamaBaseUrl: process.env.OLLAMA_BASE_URL || "http://localhost:11434",
      openAiCompatibleBaseUrl: process.env.OPENAI_COMPATIBLE_BASE_URL,
      openAiApiKey: process.env.OPENAI_API_KEY,
      chatModel: process.env.AI_CHAT_MODEL || "qwen2.5:7b",
      embeddingModel: process.env.AI_EMBEDDING_MODEL || "bge-m3",
      indexDir: resolve(process.env.AI_INDEX_DIR || "./data/ai-index"),
      topK: numberEnv(process.env.AI_TOP_K, 6),
      maxContextChars: numberEnv(process.env.AI_MAX_CONTEXT_CHARS, 12000),
      maxFileChars: numberEnv(process.env.AI_MAX_FILE_CHARS, 200000)
    }
  };
}
```

Update existing test fixtures that construct `ViewerConfig` manually. Use this helper shape:

```ts
const ai = {
  enabled: false,
  provider: "ollama" as const,
  ollamaBaseUrl: "http://localhost:11434",
  chatModel: "qwen2.5:7b",
  embeddingModel: "bge-m3",
  indexDir: join(repoRoot, "data", "ai-index"),
  topK: 6,
  maxContextChars: 12000,
  maxFileChars: 200000
};
```

- [ ] **Step 5: Run tests**

Run:

```powershell
cd note-viewer
npm test -- src/server/config.test.ts
npm run typecheck
```

Expected: both commands pass.

- [ ] **Step 6: Commit**

```powershell
git add -- note-viewer/src/shared/types.ts note-viewer/src/server/config.ts note-viewer/src/server/config.test.ts note-viewer/src/**/*.test.ts
git commit -m "feat: add ai configuration types"
```

---

### Task 2: Provider Interfaces And Mockable Implementations

**Files:**
- Create: `note-viewer/src/server/services/ai/errors.ts`
- Create: `note-viewer/src/server/services/ai/providers/types.ts`
- Create: `note-viewer/src/server/services/ai/providers/createProvider.ts`
- Create: `note-viewer/src/server/services/ai/providers/ollamaProvider.ts`
- Create: `note-viewer/src/server/services/ai/providers/openAiCompatibleProvider.ts`
- Test: `note-viewer/src/server/services/ai/providers/createProvider.test.ts`

**Interfaces:**
- Consumes: `AiConfig`
- Produces: `AiError`, `ChatMessage`, `ChatOptions`, `ChatResult`, `EmbeddingProvider`, `ChatProvider`, `AiProvider`, `createAiProvider(config: AiConfig): AiProvider`

- [ ] **Step 1: Write failing provider factory tests**

Create `note-viewer/src/server/services/ai/providers/createProvider.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import type { AiConfig } from "../../../../shared/types";
import { createAiProvider } from "./createProvider";

function config(overrides: Partial<AiConfig> = {}): AiConfig {
  return {
    enabled: true,
    provider: "ollama",
    ollamaBaseUrl: "http://localhost:11434",
    chatModel: "qwen2.5:7b",
    embeddingModel: "bge-m3",
    indexDir: "data/ai-index",
    topK: 6,
    maxContextChars: 12000,
    maxFileChars: 200000,
    ...overrides
  };
}

describe("createAiProvider", () => {
  it("creates an Ollama provider", () => {
    const provider = createAiProvider(config());

    expect(provider.name).toBe("ollama");
    expect(provider.chat.model).toBe("qwen2.5:7b");
    expect(provider.embedding.model).toBe("bge-m3");
  });

  it("creates an OpenAI-compatible provider", () => {
    const provider = createAiProvider(
      config({
        provider: "openai-compatible",
        openAiCompatibleBaseUrl: "https://api.example.com/v1",
        openAiApiKey: "secret"
      })
    );

    expect(provider.name).toBe("openai-compatible");
    expect(provider.chat.model).toBe("qwen2.5:7b");
    expect(provider.embedding.model).toBe("bge-m3");
  });

  it("rejects OpenAI-compatible provider without base URL or API key", () => {
    expect(() => createAiProvider(config({ provider: "openai-compatible" }))).toThrow("OpenAI 兼容接口缺少配置");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```powershell
cd note-viewer
npm test -- src/server/services/ai/providers/createProvider.test.ts
```

Expected: FAIL because provider modules do not exist.

- [ ] **Step 3: Add AI error type**

Create `note-viewer/src/server/services/ai/errors.ts`:

```ts
export class AiError extends Error {
  constructor(
    message: string,
    readonly statusCode: number = 500,
    readonly cause?: unknown
  ) {
    super(message);
    this.name = "AiError";
  }
}

export function isAiError(error: unknown): error is AiError {
  return error instanceof AiError;
}
```

- [ ] **Step 4: Add provider interfaces**

Create `note-viewer/src/server/services/ai/providers/types.ts`:

```ts
export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type ChatOptions = {
  temperature?: number;
  maxTokens?: number;
};

export type ChatResult = {
  content: string;
  model: string;
};

export type EmbeddingProvider = {
  name: string;
  model: string;
  embedTexts(texts: string[]): Promise<number[][]>;
};

export type ChatProvider = {
  name: string;
  model: string;
  chat(messages: ChatMessage[], options?: ChatOptions): Promise<ChatResult>;
};

export type AiProvider = {
  name: string;
  embedding: EmbeddingProvider;
  chat: ChatProvider;
};
```

- [ ] **Step 5: Implement Ollama provider**

Create `note-viewer/src/server/services/ai/providers/ollamaProvider.ts`:

```ts
import type { AiConfig } from "../../../../shared/types";
import { AiError } from "../errors";
import type { AiProvider, ChatMessage, ChatOptions } from "./types";

async function postJson<T>(url: string, body: unknown): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
  } catch (error) {
    throw new AiError("无法连接 Ollama，请检查 OLLAMA_BASE_URL", 502, error);
  }

  if (!response.ok) {
    throw new AiError(`Ollama 请求失败：${response.status}`, 502, await response.text());
  }

  return response.json() as Promise<T>;
}

export function createOllamaProvider(config: AiConfig): AiProvider {
  const baseUrl = config.ollamaBaseUrl.replace(/\/$/, "");

  return {
    name: "ollama",
    embedding: {
      name: "ollama",
      model: config.embeddingModel,
      async embedTexts(texts: string[]) {
        const vectors: number[][] = [];
        for (const text of texts) {
          const result = await postJson<{ embedding?: number[] }>(`${baseUrl}/api/embeddings`, {
            model: config.embeddingModel,
            prompt: text
          });
          if (!Array.isArray(result.embedding)) {
            throw new AiError("Ollama embedding 响应格式不正确", 502);
          }
          vectors.push(result.embedding);
        }
        return vectors;
      }
    },
    chat: {
      name: "ollama",
      model: config.chatModel,
      async chat(messages: ChatMessage[], options?: ChatOptions) {
        const result = await postJson<{ message?: { content?: string }; model?: string }>(`${baseUrl}/api/chat`, {
          model: config.chatModel,
          messages,
          stream: false,
          options: {
            temperature: options?.temperature,
            num_predict: options?.maxTokens
          }
        });
        const content = result.message?.content;
        if (!content) {
          throw new AiError("Ollama chat 响应格式不正确", 502);
        }
        return { content, model: result.model || config.chatModel };
      }
    }
  };
}
```

- [ ] **Step 6: Implement OpenAI-compatible provider**

Create `note-viewer/src/server/services/ai/providers/openAiCompatibleProvider.ts`:

```ts
import type { AiConfig } from "../../../../shared/types";
import { AiError } from "../errors";
import type { AiProvider, ChatMessage, ChatOptions } from "./types";

async function postJson<T>(url: string, apiKey: string, body: unknown): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify(body)
    });
  } catch (error) {
    throw new AiError("无法连接 OpenAI 兼容接口，请检查 OPENAI_COMPATIBLE_BASE_URL", 502, error);
  }

  if (!response.ok) {
    throw new AiError(`OpenAI 兼容接口请求失败：${response.status}`, 502, await response.text());
  }

  return response.json() as Promise<T>;
}

export function createOpenAiCompatibleProvider(config: AiConfig): AiProvider {
  if (!config.openAiCompatibleBaseUrl || !config.openAiApiKey) {
    throw new AiError("OpenAI 兼容接口缺少配置", 500);
  }

  const baseUrl = config.openAiCompatibleBaseUrl.replace(/\/$/, "");
  const apiKey = config.openAiApiKey;

  return {
    name: "openai-compatible",
    embedding: {
      name: "openai-compatible",
      model: config.embeddingModel,
      async embedTexts(texts: string[]) {
        const result = await postJson<{ data?: Array<{ embedding?: number[] }> }>(
          `${baseUrl}/embeddings`,
          apiKey,
          { model: config.embeddingModel, input: texts }
        );
        const vectors = result.data?.map((item) => item.embedding);
        if (!vectors || vectors.some((vector) => !Array.isArray(vector))) {
          throw new AiError("OpenAI 兼容 embedding 响应格式不正确", 502);
        }
        return vectors as number[][];
      }
    },
    chat: {
      name: "openai-compatible",
      model: config.chatModel,
      async chat(messages: ChatMessage[], options?: ChatOptions) {
        const result = await postJson<{ choices?: Array<{ message?: { content?: string } }> }>(
          `${baseUrl}/chat/completions`,
          apiKey,
          {
            model: config.chatModel,
            messages,
            temperature: options?.temperature,
            max_tokens: options?.maxTokens
          }
        );
        const content = result.choices?.[0]?.message?.content;
        if (!content) {
          throw new AiError("OpenAI 兼容 chat 响应格式不正确", 502);
        }
        return { content, model: config.chatModel };
      }
    }
  };
}
```

- [ ] **Step 7: Implement provider factory**

Create `note-viewer/src/server/services/ai/providers/createProvider.ts`:

```ts
import type { AiConfig } from "../../../../shared/types";
import type { AiProvider } from "./types";
import { createOllamaProvider } from "./ollamaProvider";
import { createOpenAiCompatibleProvider } from "./openAiCompatibleProvider";

export function createAiProvider(config: AiConfig): AiProvider {
  if (config.provider === "openai-compatible") {
    return createOpenAiCompatibleProvider(config);
  }
  return createOllamaProvider(config);
}
```

- [ ] **Step 8: Run tests**

Run:

```powershell
cd note-viewer
npm test -- src/server/services/ai/providers/createProvider.test.ts
npm run typecheck
```

Expected: both commands pass.

- [ ] **Step 9: Commit**

```powershell
git add -- note-viewer/src/server/services/ai/errors.ts note-viewer/src/server/services/ai/providers
git commit -m "feat: add ai provider abstraction"
```

---

### Task 3: Document Chunking And Vector Search

**Files:**
- Create: `note-viewer/src/server/services/ai/chunkDocuments.ts`
- Create: `note-viewer/src/server/services/ai/vectorSearch.ts`
- Test: `note-viewer/src/server/services/ai/chunkDocuments.test.ts`
- Test: `note-viewer/src/server/services/ai/vectorSearch.test.ts`

**Interfaces:**
- Produces: `SourceDocument`, `PendingDocumentChunk`, `chunkDocument(document, options)`
- Produces: `VectorDocumentChunk`, `scoreVectorSearch(queryEmbedding, chunks, topK)`

- [ ] **Step 1: Write failing chunk tests**

Create `note-viewer/src/server/services/ai/chunkDocuments.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { chunkDocument } from "./chunkDocuments";

describe("chunkDocument", () => {
  it("keeps markdown heading metadata with chunk content", () => {
    const chunks = chunkDocument(
      {
        path: "学习记录/spring.md",
        title: "spring.md",
        kind: "markdown",
        content: "# Spring\n介绍\n\n## 扩展点\n参数解析器\n\n```ts\nconst ok = true;\n```",
        updatedAt: "2026-07-08T00:00:00.000Z"
      },
      { targetChars: 40, overlapChars: 8, maxFileChars: 200000 }
    );

    expect(chunks[0]).toMatchObject({
      path: "学习记录/spring.md",
      title: "spring.md",
      heading: "Spring"
    });
    expect(chunks.some((chunk) => chunk.heading === "扩展点")).toBe(true);
    expect(chunks.map((chunk) => chunk.content).join("\n")).toContain("const ok = true;");
  });

  it("returns a skipped result for oversized files", () => {
    const chunks = chunkDocument(
      {
        path: "big.md",
        title: "big.md",
        kind: "markdown",
        content: "x".repeat(20),
        updatedAt: "2026-07-08T00:00:00.000Z"
      },
      { targetChars: 10, overlapChars: 2, maxFileChars: 5 }
    );

    expect(chunks).toEqual([]);
  });
});
```

- [ ] **Step 2: Write failing vector tests**

Create `note-viewer/src/server/services/ai/vectorSearch.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { scoreVectorSearch } from "./vectorSearch";

describe("scoreVectorSearch", () => {
  it("returns topK chunks ordered by cosine similarity", () => {
    const results = scoreVectorSearch(
      [1, 0],
      [
        {
          id: "a",
          path: "a.md",
          title: "a.md",
          content: "docker compose",
          contentHash: "hash-a",
          embedding: [0.9, 0.1]
        },
        {
          id: "b",
          path: "b.md",
          title: "b.md",
          content: "spring cloud",
          contentHash: "hash-b",
          embedding: [0, 1]
        }
      ],
      1
    );

    expect(results).toHaveLength(1);
    expect(results[0].chunk.id).toBe("a");
    expect(results[0].score).toBeGreaterThan(0.9);
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run:

```powershell
cd note-viewer
npm test -- src/server/services/ai/chunkDocuments.test.ts src/server/services/ai/vectorSearch.test.ts
```

Expected: FAIL because modules do not exist.

- [ ] **Step 4: Implement chunking**

Create `note-viewer/src/server/services/ai/chunkDocuments.ts`:

```ts
import { createHash } from "node:crypto";

export type SourceDocument = {
  path: string;
  title: string;
  kind: "markdown" | "text";
  content: string;
  updatedAt?: string;
};

export type PendingDocumentChunk = {
  id: string;
  path: string;
  title: string;
  heading?: string;
  content: string;
  contentHash: string;
  updatedAt?: string;
};

export type ChunkOptions = {
  targetChars: number;
  overlapChars: number;
  maxFileChars: number;
};

function hashContent(value: string): string {
  return createHash("sha256").update(value).digest("hex").slice(0, 16);
}

function headingFromLine(line: string): string | undefined {
  const match = /^(#{1,6})\s+(.+)$/.exec(line.trim());
  return match?.[2]?.trim();
}

function splitByTargetChars(lines: string[], targetChars: number): string[][] {
  const groups: string[][] = [];
  let current: string[] = [];
  let length = 0;

  for (const line of lines) {
    if (current.length > 0 && length + line.length > targetChars) {
      groups.push(current);
      current = [];
      length = 0;
    }
    current.push(line);
    length += line.length + 1;
  }

  if (current.length > 0) {
    groups.push(current);
  }

  return groups;
}

export function chunkDocument(document: SourceDocument, options: ChunkOptions): PendingDocumentChunk[] {
  if (document.content.length > options.maxFileChars) {
    return [];
  }

  const lines = document.content.split(/\r?\n/);
  const chunks: PendingDocumentChunk[] = [];
  let heading: string | undefined;

  for (const group of splitByTargetChars(lines, options.targetChars)) {
    const firstHeading = group.map(headingFromLine).find(Boolean);
    if (firstHeading) {
      heading = firstHeading;
    }

    const content = group.join("\n").trim();
    if (!content) {
      continue;
    }

    const contentHash = hashContent(`${document.path}\n${heading || ""}\n${content}`);
    chunks.push({
      id: `${document.path}:${chunks.length}:${contentHash}`,
      path: document.path,
      title: document.title,
      heading,
      content,
      contentHash,
      updatedAt: document.updatedAt
    });
  }

  return chunks;
}
```

- [ ] **Step 5: Implement vector search**

Create `note-viewer/src/server/services/ai/vectorSearch.ts`:

```ts
export type VectorDocumentChunk = {
  id: string;
  path: string;
  title: string;
  heading?: string;
  content: string;
  contentHash: string;
  updatedAt?: string;
  embedding: number[];
};

export type ScoredChunk = {
  chunk: VectorDocumentChunk;
  score: number;
};

function magnitude(vector: number[]): number {
  return Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));
}

export function cosineSimilarity(left: number[], right: number[]): number {
  if (left.length !== right.length || left.length === 0) {
    return 0;
  }

  const leftMagnitude = magnitude(left);
  const rightMagnitude = magnitude(right);
  if (leftMagnitude === 0 || rightMagnitude === 0) {
    return 0;
  }

  const dot = left.reduce((sum, value, index) => sum + value * right[index], 0);
  return dot / (leftMagnitude * rightMagnitude);
}

export function scoreVectorSearch(
  queryEmbedding: number[],
  chunks: VectorDocumentChunk[],
  topK: number
): ScoredChunk[] {
  return chunks
    .map((chunk) => ({ chunk, score: cosineSimilarity(queryEmbedding, chunk.embedding) }))
    .filter((result) => result.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);
}
```

- [ ] **Step 6: Run tests**

Run:

```powershell
cd note-viewer
npm test -- src/server/services/ai/chunkDocuments.test.ts src/server/services/ai/vectorSearch.test.ts
npm run typecheck
```

Expected: all commands pass.

- [ ] **Step 7: Commit**

```powershell
git add -- note-viewer/src/server/services/ai/chunkDocuments.ts note-viewer/src/server/services/ai/chunkDocuments.test.ts note-viewer/src/server/services/ai/vectorSearch.ts note-viewer/src/server/services/ai/vectorSearch.test.ts
git commit -m "feat: add ai document chunking and vector search"
```

---

### Task 4: Persistent AI Index Repository

**Files:**
- Create: `note-viewer/src/server/services/ai/aiIndexStore.ts`
- Create: `note-viewer/src/server/services/ai/aiRepository.ts`
- Test: `note-viewer/src/server/services/ai/aiIndexStore.test.ts`
- Test: `note-viewer/src/server/services/ai/aiRepository.test.ts`

**Interfaces:**
- Consumes: `ViewerConfig`, `TreeNode`, `readTextFile`, `chunkDocument`, `AiProvider.embedding`
- Produces: `AiIndexSnapshot`, `AiRepository`, `createAiRepository(config, getTree, provider)`

- [ ] **Step 1: Write failing index store tests**

Create `note-viewer/src/server/services/ai/aiIndexStore.test.ts`:

```ts
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";
import { createAiIndexStore } from "./aiIndexStore";

const dirs: string[] = [];

describe("aiIndexStore", () => {
  afterEach(async () => {
    await Promise.all(dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
  });

  it("saves and loads index snapshots", async () => {
    const dir = await mkdtemp(join(tmpdir(), "ai-index-"));
    dirs.push(dir);
    const store = createAiIndexStore(dir);

    await store.save({
      chunks: [
        {
          id: "a",
          path: "a.md",
          title: "a.md",
          content: "hello",
          contentHash: "hash",
          embedding: [1, 0]
        }
      ],
      indexedFiles: 1,
      lastIndexedAt: "2026-07-08T00:00:00.000Z",
      stale: false
    });

    await expect(store.load()).resolves.toMatchObject({
      indexedFiles: 1,
      stale: false,
      chunks: [{ id: "a" }]
    });
  });

  it("returns an empty stale snapshot when no index exists", async () => {
    const dir = await mkdtemp(join(tmpdir(), "ai-index-"));
    dirs.push(dir);

    await expect(createAiIndexStore(dir).load()).resolves.toMatchObject({
      chunks: [],
      indexedFiles: 0,
      stale: true
    });
  });
});
```

- [ ] **Step 2: Write failing repository tests**

Create `note-viewer/src/server/services/ai/aiRepository.test.ts`:

```ts
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";
import type { TreeNode, ViewerConfig } from "../../../shared/types";
import type { AiProvider } from "./providers/types";
import { createAiRepository } from "./aiRepository";

const dirs: string[] = [];

async function fixture(): Promise<{ config: ViewerConfig; tree: TreeNode; provider: AiProvider }> {
  const repoRoot = await mkdtemp(join(tmpdir(), "note-viewer-ai-"));
  dirs.push(repoRoot);
  const contentRoot = join(repoRoot, "笔记");
  await mkdir(contentRoot, { recursive: true });
  await writeFile(join(contentRoot, "docker.md"), "# Docker\ncompose 部署");

  const config: ViewerConfig = {
    repoRoot,
    contentRoot,
    port: 8080,
    publicBasePath: "/",
    ai: {
      enabled: true,
      provider: "ollama",
      ollamaBaseUrl: "http://localhost:11434",
      chatModel: "qwen2.5:7b",
      embeddingModel: "bge-m3",
      indexDir: join(repoRoot, "data", "ai-index"),
      topK: 6,
      maxContextChars: 12000,
      maxFileChars: 200000
    }
  };

  const tree: TreeNode = {
    name: "笔记",
    path: "",
    type: "directory",
    children: [{ name: "docker.md", path: "docker.md", type: "file", fileKind: "markdown" }]
  };

  const provider: AiProvider = {
    name: "test",
    embedding: {
      name: "test",
      model: "embedding",
      embedTexts: async (texts) => texts.map((text) => [text.includes("Docker") ? 1 : 0, 0])
    },
    chat: {
      name: "test",
      model: "chat",
      chat: async () => ({ content: "answer", model: "chat" })
    }
  };

  return { config, tree, provider };
}

describe("aiRepository", () => {
  afterEach(async () => {
    await Promise.all(dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
  });

  it("rebuilds an index from readable tree files", async () => {
    const { config, tree, provider } = await fixture();
    const repository = createAiRepository(config, async () => tree, provider);

    await repository.reindex();
    const snapshot = await repository.getSnapshot();

    expect(snapshot.indexedFiles).toBe(1);
    expect(snapshot.stale).toBe(false);
    expect(snapshot.chunks[0]).toMatchObject({
      path: "docker.md",
      title: "docker.md",
      heading: "Docker",
      embedding: [1, 0]
    });
  });

  it("marks the loaded index as stale", async () => {
    const { config, tree, provider } = await fixture();
    const repository = createAiRepository(config, async () => tree, provider);

    await repository.reindex();
    await repository.markStale();

    await expect(repository.getStatus()).resolves.toMatchObject({
      indexedFiles: 1,
      indexedChunks: 1,
      stale: true
    });
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run:

```powershell
cd note-viewer
npm test -- src/server/services/ai/aiIndexStore.test.ts src/server/services/ai/aiRepository.test.ts
```

Expected: FAIL because index store and repository modules do not exist.

- [ ] **Step 4: Implement index store**

Create `note-viewer/src/server/services/ai/aiIndexStore.ts`:

```ts
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { VectorDocumentChunk } from "./vectorSearch";

export type AiIndexSnapshot = {
  chunks: VectorDocumentChunk[];
  indexedFiles: number;
  lastIndexedAt?: string;
  stale: boolean;
};

export type AiIndexStore = {
  load(): Promise<AiIndexSnapshot>;
  save(snapshot: AiIndexSnapshot): Promise<void>;
};

export function createAiIndexStore(indexDir: string): AiIndexStore {
  const indexPath = path.join(indexDir, "index.json");

  return {
    async load() {
      try {
        return JSON.parse(await readFile(indexPath, "utf8")) as AiIndexSnapshot;
      } catch {
        return { chunks: [], indexedFiles: 0, stale: true };
      }
    },
    async save(snapshot) {
      await mkdir(indexDir, { recursive: true });
      await writeFile(indexPath, JSON.stringify(snapshot, null, 2), "utf8");
    }
  };
}
```

- [ ] **Step 5: Implement AI repository**

Create `note-viewer/src/server/services/ai/aiRepository.ts`:

```ts
import path from "node:path";
import type { AiStatus, TreeNode, ViewerConfig } from "../../../shared/types";
import { readTextFile } from "../readContent";
import { chunkDocument } from "./chunkDocuments";
import { createAiIndexStore, type AiIndexSnapshot } from "./aiIndexStore";
import type { AiProvider } from "./providers/types";

export type AiRepository = {
  getSnapshot(): Promise<AiIndexSnapshot>;
  getStatus(): Promise<AiStatus>;
  reindex(): Promise<AiIndexSnapshot>;
  markStale(): Promise<void>;
};

function collectReadableFiles(tree: TreeNode): TreeNode[] {
  const files: TreeNode[] = [];
  function walk(node: TreeNode) {
    if (node.type === "file" && (node.fileKind === "markdown" || node.fileKind === "text")) {
      files.push(node);
    }
    node.children?.forEach(walk);
  }
  walk(tree);
  return files;
}

export function createAiRepository(
  config: ViewerConfig,
  getTree: () => Promise<TreeNode>,
  provider: AiProvider
): AiRepository {
  const store = createAiIndexStore(config.ai.indexDir);
  let snapshotPromise: Promise<AiIndexSnapshot> | undefined;
  let indexing = false;

  async function loadSnapshot(): Promise<AiIndexSnapshot> {
    if (!snapshotPromise) {
      snapshotPromise = store.load();
    }
    return snapshotPromise;
  }

  return {
    async getSnapshot() {
      return loadSnapshot();
    },
    async getStatus() {
      const snapshot = await loadSnapshot();
      return {
        enabled: config.ai.enabled,
        provider: config.ai.provider,
        chatModel: config.ai.chatModel,
        embeddingModel: config.ai.embeddingModel,
        indexedChunks: snapshot.chunks.length,
        indexedFiles: snapshot.indexedFiles,
        lastIndexedAt: snapshot.lastIndexedAt,
        indexing,
        stale: snapshot.stale
      };
    },
    async reindex() {
      indexing = true;
      try {
        const tree = await getTree();
        const files = collectReadableFiles(tree);
        const pendingChunks = [];
        let indexedFiles = 0;

        for (const node of files) {
          const file = await readTextFile(node.path, config);
          const chunks = chunkDocument(
            {
              path: file.path,
              title: path.posix.basename(file.path),
              kind: file.kind,
              content: file.content,
              updatedAt: file.updatedAt
            },
            { targetChars: 1200, overlapChars: 120, maxFileChars: config.ai.maxFileChars }
          );
          if (chunks.length > 0) {
            indexedFiles += 1;
            pendingChunks.push(...chunks);
          }
        }

        const embeddings = await provider.embedding.embedTexts(pendingChunks.map((chunk) => chunk.content));
        const nextSnapshot: AiIndexSnapshot = {
          chunks: pendingChunks.map((chunk, index) => ({ ...chunk, embedding: embeddings[index] })),
          indexedFiles,
          lastIndexedAt: new Date().toISOString(),
          stale: false
        };
        await store.save(nextSnapshot);
        snapshotPromise = Promise.resolve(nextSnapshot);
        return nextSnapshot;
      } finally {
        indexing = false;
      }
    },
    async markStale() {
      const current = await loadSnapshot();
      const nextSnapshot = { ...current, stale: true };
      await store.save(nextSnapshot);
      snapshotPromise = Promise.resolve(nextSnapshot);
    }
  };
}
```

- [ ] **Step 6: Run tests**

Run:

```powershell
cd note-viewer
npm test -- src/server/services/ai/aiIndexStore.test.ts src/server/services/ai/aiRepository.test.ts
npm run typecheck
```

Expected: all commands pass.

- [ ] **Step 7: Commit**

```powershell
git add -- note-viewer/src/server/services/ai/aiIndexStore.ts note-viewer/src/server/services/ai/aiIndexStore.test.ts note-viewer/src/server/services/ai/aiRepository.ts note-viewer/src/server/services/ai/aiRepository.test.ts
git commit -m "feat: add persistent ai index repository"
```

---

### Task 5: RAG Service

**Files:**
- Create: `note-viewer/src/server/services/ai/ragService.ts`
- Test: `note-viewer/src/server/services/ai/ragService.test.ts`

**Interfaces:**
- Consumes: `AiRepository`, `AiProvider`, `scoreVectorSearch`
- Produces: `AiRagService`, `createRagService(config, repository, provider)`

- [ ] **Step 1: Write failing RAG tests**

Create `note-viewer/src/server/services/ai/ragService.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import type { ViewerConfig } from "../../../shared/types";
import type { AiRepository } from "./aiRepository";
import type { AiProvider } from "./providers/types";
import { createRagService } from "./ragService";

const config: ViewerConfig = {
  repoRoot: "/repo",
  contentRoot: "/repo/笔记",
  port: 8080,
  publicBasePath: "/",
  ai: {
    enabled: true,
    provider: "ollama",
    ollamaBaseUrl: "http://localhost:11434",
    chatModel: "chat",
    embeddingModel: "embedding",
    indexDir: "data/ai-index",
    topK: 2,
    maxContextChars: 12000,
    maxFileChars: 200000
  }
};

function repository(): AiRepository {
  return {
    getSnapshot: async () => ({
      indexedFiles: 1,
      lastIndexedAt: "2026-07-08T00:00:00.000Z",
      stale: false,
      chunks: [
        {
          id: "docker",
          path: "docker.md",
          title: "docker.md",
          heading: "Docker",
          content: "Docker compose 使用 docker compose up --build -d 启动。",
          contentHash: "hash",
          embedding: [1, 0]
        }
      ]
    }),
    getStatus: async () => ({
      enabled: true,
      provider: "ollama",
      chatModel: "chat",
      embeddingModel: "embedding",
      indexedChunks: 1,
      indexedFiles: 1,
      indexing: false,
      stale: false
    }),
    reindex: async () => ({ chunks: [], indexedFiles: 0, stale: false }),
    markStale: async () => undefined
  };
}

describe("ragService", () => {
  it("returns semantic search results with snippets", async () => {
    const provider: AiProvider = {
      name: "test",
      embedding: { name: "test", model: "embedding", embedTexts: async () => [[1, 0]] },
      chat: { name: "test", model: "chat", chat: async () => ({ content: "unused", model: "chat" }) }
    };
    const service = createRagService(config, repository(), provider);

    await expect(service.search({ query: "docker 启动" })).resolves.toEqual([
      {
        path: "docker.md",
        title: "docker.md",
        heading: "Docker",
        snippet: "Docker compose 使用 docker compose up --build -d 启动。",
        score: expect.any(Number)
      }
    ]);
  });

  it("answers with citations from retrieved chunks", async () => {
    const provider: AiProvider = {
      name: "test",
      embedding: { name: "test", model: "embedding", embedTexts: async () => [[1, 0]] },
      chat: {
        name: "test",
        model: "chat",
        chat: async (messages) => {
          expect(messages[0].content).toContain("只基于提供的笔记片段回答");
          expect(messages[1].content).toContain("docker compose up");
          return { content: "使用 docker compose up --build -d 启动。", model: "chat" };
        }
      }
    };
    const service = createRagService(config, repository(), provider);

    await expect(service.ask({ question: "Docker 怎么启动？" })).resolves.toEqual({
      answer: "使用 docker compose up --build -d 启动。",
      model: "chat",
      citations: [
        {
          path: "docker.md",
          title: "docker.md",
          heading: "Docker",
          snippet: "Docker compose 使用 docker compose up --build -d 启动。"
        }
      ]
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```powershell
cd note-viewer
npm test -- src/server/services/ai/ragService.test.ts
```

Expected: FAIL because `ragService.ts` does not exist.

- [ ] **Step 3: Implement RAG service**

Create `note-viewer/src/server/services/ai/ragService.ts`:

```ts
import type { AiAskRequest, AiAskResponse, AiSearchRequest, AiSearchResult, ViewerConfig } from "../../../shared/types";
import { AiError } from "./errors";
import type { AiRepository } from "./aiRepository";
import type { AiProvider } from "./providers/types";
import { scoreVectorSearch, type ScoredChunk } from "./vectorSearch";

export type AiRagService = {
  search(request: AiSearchRequest): Promise<AiSearchResult[]>;
  ask(request: AiAskRequest): Promise<AiAskResponse>;
};

function normalizeLimit(value: number | undefined, fallback: number): number {
  return Number.isFinite(value) && value && value > 0 ? Math.min(value, 20) : fallback;
}

function validateQuery(value: string, fieldName: string): string {
  const query = value.trim();
  if (!query) {
    throw new AiError(`${fieldName}不能为空`, 400);
  }
  if (query.length > 2000) {
    throw new AiError(`${fieldName}过长`, 400);
  }
  return query;
}

function snippet(content: string): string {
  return content.replace(/\s+/g, " ").slice(0, 220);
}

function toSearchResult(result: ScoredChunk): AiSearchResult {
  return {
    path: result.chunk.path,
    title: result.chunk.title,
    heading: result.chunk.heading,
    snippet: snippet(result.chunk.content),
    score: result.score
  };
}

function buildContext(results: ScoredChunk[], maxChars: number): string {
  let context = "";
  for (const result of results) {
    const block = `来源：${result.chunk.path}${result.chunk.heading ? `#${result.chunk.heading}` : ""}\n${result.chunk.content}\n\n`;
    if (context.length + block.length > maxChars) {
      break;
    }
    context += block;
  }
  return context.trim();
}

export function createRagService(
  config: ViewerConfig,
  repository: AiRepository,
  provider: AiProvider
): AiRagService {
  async function retrieve(query: string, topK?: number): Promise<ScoredChunk[]> {
    const snapshot = await repository.getSnapshot();
    if (snapshot.chunks.length === 0) {
      return [];
    }
    const [queryEmbedding] = await provider.embedding.embedTexts([query]);
    return scoreVectorSearch(queryEmbedding, snapshot.chunks, normalizeLimit(topK, config.ai.topK));
  }

  return {
    async search(request) {
      const query = validateQuery(request.query, "搜索内容");
      return (await retrieve(query, request.topK)).map(toSearchResult);
    },
    async ask(request) {
      const question = validateQuery(request.question, "问题");
      const results = await retrieve(question, request.topK);
      if (results.length === 0) {
        return {
          answer: "当前笔记中没有找到足够依据。",
          citations: [],
          model: provider.chat.model
        };
      }

      const context = buildContext(results, config.ai.maxContextChars);
      const answer = await provider.chat.chat(
        [
          {
            role: "system",
            content:
              "你是本地笔记知识库助手。只基于提供的笔记片段回答；无法从片段确认时明确说明。回答使用中文，命令、路径、代码标识符保留原文。"
          },
          {
            role: "user",
            content: `笔记片段：\n${context}\n\n问题：${question}`
          }
        ],
        { temperature: 0.2 }
      );

      return {
        answer: answer.content,
        model: answer.model,
        citations: results.map((result) => ({
          path: result.chunk.path,
          title: result.chunk.title,
          heading: result.chunk.heading,
          snippet: snippet(result.chunk.content)
        }))
      };
    }
  };
}
```

- [ ] **Step 4: Run tests**

Run:

```powershell
cd note-viewer
npm test -- src/server/services/ai/ragService.test.ts
npm run typecheck
```

Expected: all commands pass.

- [ ] **Step 5: Commit**

```powershell
git add -- note-viewer/src/server/services/ai/ragService.ts note-viewer/src/server/services/ai/ragService.test.ts
git commit -m "feat: add ai rag service"
```

---

### Task 6: AI API Routes And Server Integration

**Files:**
- Create: `note-viewer/src/server/routes/ai.ts`
- Modify: `note-viewer/src/server/app.ts`
- Modify: `note-viewer/src/server/index.ts`
- Test: `note-viewer/src/server/routes/ai.test.ts`
- Test: `note-viewer/src/server/app.test.ts`

**Interfaces:**
- Consumes: `AiRepository`, `AiRagService`, `AiError`
- Produces: `createAiRouter(config, repository, ragService)`

- [ ] **Step 1: Write failing AI route tests**

Create `note-viewer/src/server/routes/ai.test.ts`:

```ts
import express from "express";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import type { ViewerConfig } from "../../shared/types";
import { createAiRouter } from "./ai";

const config: ViewerConfig = {
  repoRoot: "/repo",
  contentRoot: "/repo/笔记",
  port: 8080,
  publicBasePath: "/",
  ai: {
    enabled: true,
    provider: "ollama",
    ollamaBaseUrl: "http://localhost:11434",
    chatModel: "chat",
    embeddingModel: "embedding",
    indexDir: "data/ai-index",
    topK: 6,
    maxContextChars: 12000,
    maxFileChars: 200000
  }
};

function app() {
  const server = express();
  server.use(express.json());
  server.use(
    "/api/ai",
    createAiRouter(
      config,
      {
        getSnapshot: async () => ({ chunks: [], indexedFiles: 0, stale: true }),
        getStatus: async () => ({
          enabled: true,
          provider: "ollama",
          chatModel: "chat",
          embeddingModel: "embedding",
          indexedChunks: 0,
          indexedFiles: 0,
          indexing: false,
          stale: true
        }),
        reindex: vi.fn(async () => ({ chunks: [], indexedFiles: 0, stale: false })),
        markStale: async () => undefined
      },
      {
        search: vi.fn(async () => [{ path: "a.md", title: "a.md", snippet: "hello", score: 1 }]),
        ask: vi.fn(async () => ({ answer: "answer", citations: [], model: "chat" }))
      }
    )
  );
  return server;
}

describe("ai routes", () => {
  it("returns AI status", async () => {
    const response = await request(app()).get("/api/ai/status");
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ enabled: true, provider: "ollama", stale: true });
  });

  it("runs semantic search", async () => {
    const response = await request(app()).post("/api/ai/search").send({ query: "hello" });
    expect(response.status).toBe(200);
    expect(response.body[0]).toMatchObject({ path: "a.md", score: 1 });
  });

  it("runs grounded ask", async () => {
    const response = await request(app()).post("/api/ai/ask").send({ question: "hello" });
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ answer: "answer", model: "chat" });
  });
});
```

Install `supertest` test dependency if it is not already present:

```powershell
cd note-viewer
npm install -D supertest @types/supertest
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```powershell
cd note-viewer
npm test -- src/server/routes/ai.test.ts
```

Expected: FAIL because `routes/ai.ts` does not exist.

- [ ] **Step 3: Implement AI router**

Create `note-viewer/src/server/routes/ai.ts`:

```ts
import { Router } from "express";
import type { ViewerConfig } from "../../shared/types";
import { AiError } from "../services/ai/errors";
import type { AiRepository } from "../services/ai/aiRepository";
import type { AiRagService } from "../services/ai/ragService";

export function createAiRouter(config: ViewerConfig, repository: AiRepository, ragService: AiRagService) {
  const router = Router();

  router.use((req, _res, next) => {
    if (!config.ai.enabled && req.path !== "/status") {
      next(new AiError("AI 知识库未启用", 503));
      return;
    }
    next();
  });

  router.get("/status", async (_req, res, next) => {
    try {
      res.json(await repository.getStatus());
    } catch (error) {
      next(error);
    }
  });

  router.post("/reindex", async (_req, res, next) => {
    try {
      await repository.reindex();
      res.json(await repository.getStatus());
    } catch (error) {
      next(error);
    }
  });

  router.post("/search", async (req, res, next) => {
    try {
      res.json(await ragService.search(req.body || {}));
    } catch (error) {
      next(error);
    }
  });

  router.post("/ask", async (req, res, next) => {
    try {
      res.json(await ragService.ask(req.body || {}));
    } catch (error) {
      next(error);
    }
  });

  return router;
}
```

- [ ] **Step 4: Integrate router in app**

Modify `note-viewer/src/server/app.ts`:

```ts
import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { ViewerConfig } from "../shared/types";
import { createAssetRouter } from "./routes/asset";
import { createAiRouter } from "./routes/ai";
import { createEventsRouter } from "./routes/events";
import { createFileRouter } from "./routes/file";
import { createPortalRouter } from "./routes/portal";
import { createSearchRouter } from "./routes/search";
import { createTreeRouter } from "./routes/tree";
import { createAiProvider } from "./services/ai/providers/createProvider";
import { createAiRepository, type AiRepository } from "./services/ai/aiRepository";
import { isAiError } from "./services/ai/errors";
import { createRagService, type AiRagService } from "./services/ai/ragService";
import { createRepositoryStore, type RepositoryStore } from "./services/repositoryStore";

export type AiServices = {
  repository: AiRepository;
  rag: AiRagService;
};

export function createAiServices(config: ViewerConfig, store: RepositoryStore): AiServices {
  const provider = createAiProvider(config.ai);
  const repository = createAiRepository(config, () => store.getTree(), provider);
  return { repository, rag: createRagService(config, repository, provider) };
}

export function createApp(
  config: ViewerConfig,
  store: RepositoryStore = createRepositoryStore(config),
  aiServices: AiServices = createAiServices(config, store)
) {
  const app = express();
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const clientDist = path.resolve(__dirname, "../client");

  app.use(express.json({ limit: "1mb" }));

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true, basePath: config.publicBasePath });
  });

  app.use("/api/tree", createTreeRouter(store));
  app.use("/api/portal", createPortalRouter(store));
  app.use("/api/file", createFileRouter(config));
  app.use("/api/asset", createAssetRouter(config));
  app.use("/api/search", createSearchRouter(store));
  app.use("/api/ai", createAiRouter(config, aiServices.repository, aiServices.rag));
  app.use("/api/events", createEventsRouter());

  app.use("/api", (_req, res) => {
    res.status(404).json({ error: "Not Found" });
  });

  app.get(/(^|\/)runtime-config\.js$/, (_req, res) => {
    res.type("application/javascript");
    res.send(
      `window.__NOTE_VIEWER_CONFIG__ = ${JSON.stringify({ publicBasePath: config.publicBasePath })};`
    );
  });

  app.use(express.static(clientDist));
  app.get("*", (_req, res) => {
    res.sendFile(path.join(clientDist, "index.html"));
  });

  app.use((error: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    if (isAiError(error)) {
      res.status(error.statusCode).json({ error: error.message });
      return;
    }
    res.status(400).json({ error: error.message });
  });

  return app;
}
```

- [ ] **Step 5: Wire stale marking in server index**

Modify `note-viewer/src/server/index.ts` so watcher marks the AI index stale after repository refresh. Use the same app-created services instead of creating hidden duplicates:

```ts
import { createApp, createAiServices } from "./app";
import { getConfig } from "./config";
import { createRepositoryStore } from "./services/repositoryStore";
import { startRepositoryWatcher } from "./services/watchRepository";

const config = getConfig();
const store = createRepositoryStore(config);
const aiServices = createAiServices(config, store);
const app = createApp(config, store, aiServices);

startRepositoryWatcher(config, async () => {
  await store.refresh();
  await aiServices.repository.markStale();
});

app.listen(config.port, () => {
  console.log(`note-viewer listening on http://0.0.0.0:${config.port}`);
});
```

- [ ] **Step 6: Run tests**

Run:

```powershell
cd note-viewer
npm test -- src/server/routes/ai.test.ts src/server/app.test.ts
npm run typecheck
```

Expected: all commands pass. If app tests fail because mock `ViewerConfig` lacks `ai`, update their fixtures using the Task 1 helper shape.

- [ ] **Step 7: Commit**

```powershell
git add -- note-viewer/package.json note-viewer/package-lock.json note-viewer/src/server/routes/ai.ts note-viewer/src/server/routes/ai.test.ts note-viewer/src/server/app.ts note-viewer/src/server/app.test.ts note-viewer/src/server/index.ts
git commit -m "feat: expose ai knowledge base api"
```

---

### Task 7: Frontend API Client And AI Panel

**Files:**
- Modify: `note-viewer/src/client/lib/api.ts`
- Create: `note-viewer/src/client/components/AiPanel.tsx`
- Modify: `note-viewer/src/client/components/Workspace.tsx`
- Modify: `note-viewer/src/client/styles/base.css`
- Test: `note-viewer/src/client/components/AiPanel.test.tsx`
- Modify: `note-viewer/src/client/App.test.tsx`

**Interfaces:**
- Consumes: `/api/ai/status`, `/api/ai/reindex`, `/api/ai/search`, `/api/ai/ask`
- Produces: `AiPanel({ onOpenPath }: { onOpenPath(path: string): void })`

- [ ] **Step 1: Write failing AiPanel tests**

Create `note-viewer/src/client/components/AiPanel.test.tsx`:

```tsx
/**
 * @vitest-environment jsdom
 */
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { AiPanel } from "./AiPanel";
import { api } from "../lib/api";

vi.mock("../lib/api", () => ({
  api: {
    aiStatus: vi.fn(),
    aiReindex: vi.fn(),
    aiAsk: vi.fn()
  }
}));

const mockedApi = vi.mocked(api);

describe("AiPanel", () => {
  afterEach(cleanup);

  beforeEach(() => {
    mockedApi.aiStatus.mockResolvedValue({
      enabled: true,
      provider: "ollama",
      chatModel: "qwen2.5:7b",
      embeddingModel: "bge-m3",
      indexedChunks: 2,
      indexedFiles: 1,
      indexing: false,
      stale: false
    });
    mockedApi.aiAsk.mockResolvedValue({
      answer: "使用 docker compose up --build -d 启动。",
      model: "qwen2.5:7b",
      citations: [{ path: "docker.md", title: "docker.md", heading: "Docker", snippet: "docker compose up" }]
    });
    mockedApi.aiReindex.mockResolvedValue({
      enabled: true,
      provider: "ollama",
      chatModel: "qwen2.5:7b",
      embeddingModel: "bge-m3",
      indexedChunks: 2,
      indexedFiles: 1,
      indexing: false,
      stale: false
    });
  });

  test("asks a question and opens a citation", async () => {
    const user = userEvent.setup();
    const onOpenPath = vi.fn();
    render(<AiPanel onOpenPath={onOpenPath} />);

    await screen.findByText(/Ollama|ollama/);
    await user.type(screen.getByLabelText("向 AI 知识库提问"), "Docker 怎么启动？");
    await user.click(screen.getByRole("button", { name: "提问" }));

    await screen.findByText("使用 docker compose up --build -d 启动。");
    await user.click(screen.getByRole("button", { name: /docker.md/ }));

    expect(onOpenPath).toHaveBeenCalledWith("docker.md");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```powershell
cd note-viewer
npm test -- src/client/components/AiPanel.test.tsx
```

Expected: FAIL because `AiPanel.tsx` and AI API client methods do not exist.

- [ ] **Step 3: Add AI API client methods**

Modify `note-viewer/src/client/lib/api.ts`:

```ts
import type {
  AiAskRequest,
  AiAskResponse,
  AiSearchRequest,
  AiSearchResult,
  AiStatus,
  FileContent,
  PortalData,
  SearchResult,
  TreeNode
} from "../../shared/types";

async function postJson<T>(path: string, body?: unknown): Promise<T> {
  const response = await fetch(apiUrl(path), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body || {})
  });
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
  aiStatus: () => getJson<AiStatus>("api/ai/status"),
  aiReindex: () => postJson<AiStatus>("api/ai/reindex"),
  aiSearch: (request: AiSearchRequest) => postJson<AiSearchResult[]>("api/ai/search", request),
  aiAsk: (request: AiAskRequest) => postJson<AiAskResponse>("api/ai/ask", request),
  assetUrl: (path: string) => apiUrl("api/asset", { path }),
  eventsUrl: () => apiUrl("api/events")
};
```

Preserve the existing `runtimeBasePath`, `apiUrl`, and `getJson` functions in the same file.

- [ ] **Step 4: Implement AI panel**

Create `note-viewer/src/client/components/AiPanel.tsx`:

```tsx
import { useEffect, useState } from "react";
import type { AiAskResponse, AiStatus } from "../../shared/types";
import { api } from "../lib/api";

type AiPanelProps = {
  onOpenPath: (path: string) => void;
};

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "AI 请求失败";
}

export function AiPanel({ onOpenPath }: AiPanelProps) {
  const [status, setStatus] = useState<AiStatus>();
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<AiAskResponse>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();

  async function loadStatus() {
    setStatus(await api.aiStatus());
  }

  useEffect(() => {
    void loadStatus().catch((statusError) => setError(errorMessage(statusError)));
  }, []);

  async function ask() {
    const trimmed = question.trim();
    if (!trimmed) {
      return;
    }
    setLoading(true);
    setError(undefined);
    try {
      setAnswer(await api.aiAsk({ question: trimmed }));
    } catch (askError) {
      setError(errorMessage(askError));
    } finally {
      setLoading(false);
    }
  }

  async function reindex() {
    setLoading(true);
    setError(undefined);
    try {
      setStatus(await api.aiReindex());
    } catch (reindexError) {
      setError(errorMessage(reindexError));
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="ai-panel" aria-label="AI 知识库">
      <header className="ai-panel__header">
        <div>
          <p className="ai-panel__eyebrow">AI 知识库</p>
          <h2>本地问答</h2>
        </div>
        <button className="ai-panel__reindex" type="button" onClick={reindex} disabled={loading}>
          重建索引
        </button>
      </header>

      <p className="ai-panel__status">
        {status
          ? `${status.provider} · ${status.indexedFiles} 个文件 · ${status.indexedChunks} 个片段${status.stale ? " · 需要更新" : ""}`
          : "正在读取 AI 状态"}
      </p>

      <label className="ai-panel__label" htmlFor="ai-question">
        向 AI 知识库提问
      </label>
      <textarea
        id="ai-question"
        className="ai-panel__input"
        value={question}
        onChange={(event) => setQuestion(event.target.value)}
        rows={3}
      />
      <button className="ai-panel__ask" type="button" onClick={ask} disabled={loading || !question.trim()}>
        提问
      </button>

      {error ? <p className="ai-panel__error">{error}</p> : null}
      {loading ? <p className="ai-panel__hint">正在处理...</p> : null}

      {answer ? (
        <div className="ai-panel__answer">
          <p>{answer.answer}</p>
          {answer.citations.length > 0 ? (
            <div className="ai-panel__citations">
              <p className="ai-panel__citation-title">引用来源</p>
              {answer.citations.map((citation) => (
                <button
                  key={`${citation.path}:${citation.heading || ""}`}
                  className="ai-panel__citation"
                  type="button"
                  onClick={() => onOpenPath(citation.path)}
                >
                  <span>{citation.title}{citation.heading ? ` · ${citation.heading}` : ""}</span>
                  <small>{citation.snippet}</small>
                </button>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
```

- [ ] **Step 5: Render panel in Workspace**

Modify `note-viewer/src/client/components/Workspace.tsx`:

```tsx
import { AiPanel } from "./AiPanel";
```

Add `<AiPanel onOpenPath={onOpenPath} />` in the workspace secondary/sidebar area where it does not interrupt the existing directory tree and preview. If `Workspace` currently has no clear secondary area, place it below `SearchBox` so the existing search remains the first control.

- [ ] **Step 6: Add CSS**

Modify `note-viewer/src/client/styles/base.css` by adding:

```css
.ai-panel {
  display: grid;
  gap: 0.75rem;
  border-top: 1px solid var(--border-color);
  padding-top: 1rem;
}

.ai-panel__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
}

.ai-panel__header h2 {
  margin: 0;
  font-size: 1rem;
}

.ai-panel__eyebrow,
.ai-panel__status,
.ai-panel__hint,
.ai-panel__citation-title {
  margin: 0;
  color: var(--text-muted);
  font-size: 0.8125rem;
}

.ai-panel__label {
  font-size: 0.875rem;
  font-weight: 600;
}

.ai-panel__input {
  min-height: 5rem;
  resize: vertical;
}

.ai-panel__ask,
.ai-panel__reindex,
.ai-panel__citation {
  cursor: pointer;
}

.ai-panel__error {
  margin: 0;
  color: var(--danger-color, #b42318);
  font-size: 0.875rem;
}

.ai-panel__answer {
  display: grid;
  gap: 0.75rem;
  font-size: 0.9375rem;
}

.ai-panel__answer p {
  margin: 0;
}

.ai-panel__citations {
  display: grid;
  gap: 0.5rem;
}

.ai-panel__citation {
  display: grid;
  gap: 0.25rem;
  width: 100%;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  background: var(--surface-color);
  color: inherit;
  padding: 0.625rem;
  text-align: left;
}

.ai-panel__citation small {
  color: var(--text-muted);
  line-height: 1.4;
}
```

If the CSS variable names differ, use existing local variable names from `base.css` instead of adding a new palette.

- [ ] **Step 7: Run frontend tests**

Run:

```powershell
cd note-viewer
npm test -- src/client/components/AiPanel.test.tsx src/client/App.test.tsx
npm run typecheck
```

Expected: all commands pass. Update `App.test.tsx` mock `api` to include `aiStatus`, `aiReindex`, `aiAsk`, and `aiSearch`.

- [ ] **Step 8: Commit**

```powershell
git add -- note-viewer/src/client/lib/api.ts note-viewer/src/client/components/AiPanel.tsx note-viewer/src/client/components/AiPanel.test.tsx note-viewer/src/client/components/Workspace.tsx note-viewer/src/client/styles/base.css note-viewer/src/client/App.test.tsx
git commit -m "feat: add ai knowledge base panel"
```

---

### Task 8: Docker And Documentation

**Files:**
- Modify: `note-viewer/docker-compose.yml`
- Modify: `note-viewer/.dockerignore`
- Modify: `note-viewer/README.md`

**Interfaces:**
- Produces documented local Ollama setup and provider-switching instructions.

- [ ] **Step 1: Update docker compose**

Modify `note-viewer/docker-compose.yml` to include these environment variables and volume:

```yaml
services:
  note-viewer:
    build: .
    ports:
      - "8088:8080"
    volumes:
      - ..:/workspace:ro
      - ./data:/app/data
    environment:
      - REPO_ROOT=/workspace
      - CONTENT_ROOT=/workspace/笔记
      - PORT=8080
      - PUBLIC_BASE_PATH=/
      - AI_ENABLED=true
      - AI_PROVIDER=ollama
      - OLLAMA_BASE_URL=http://host.docker.internal:11434
      - AI_CHAT_MODEL=qwen2.5:7b
      - AI_EMBEDDING_MODEL=bge-m3
      - AI_INDEX_DIR=/app/data/ai-index
      - AI_TOP_K=6
      - AI_MAX_CONTEXT_CHARS=12000
```

- [ ] **Step 2: Ignore runtime data in image build**

Modify `note-viewer/.dockerignore`:

```text
node_modules
dist
data
```

Preserve any existing ignore entries.

- [ ] **Step 3: Update README**

Add a section to `note-viewer/README.md`:

```md
## AI 知识库

第一版 AI 知识库默认使用本地 Ollama。启动前先在宿主机准备模型：

```bash
ollama pull qwen2.5:7b
ollama pull bge-m3
```

Docker Desktop 下容器通过 `http://host.docker.internal:11434` 访问宿主机 Ollama：

```yaml
environment:
  - AI_ENABLED=true
  - AI_PROVIDER=ollama
  - OLLAMA_BASE_URL=http://host.docker.internal:11434
  - AI_CHAT_MODEL=qwen2.5:7b
  - AI_EMBEDDING_MODEL=bge-m3
  - AI_INDEX_DIR=/app/data/ai-index
volumes:
  - ./data:/app/data
```

首次使用时在页面中点击“重建索引”。索引保存在 `note-viewer/data/ai-index`，容器重启后会复用。

后续切换到在线 OpenAI 兼容接口时，保持前端和业务代码不变，只调整环境变量：

```yaml
environment:
  - AI_ENABLED=true
  - AI_PROVIDER=openai-compatible
  - OPENAI_COMPATIBLE_BASE_URL=https://api.example.com/v1
  - OPENAI_API_KEY=由部署环境提供
  - AI_CHAT_MODEL=provider-chat-model
  - AI_EMBEDDING_MODEL=provider-embedding-model
```
```

- [ ] **Step 4: Run documentation-adjacent verification**

Run:

```powershell
cd note-viewer
npm run typecheck
npm test
npm run build
```

Expected: all commands pass.

- [ ] **Step 5: Commit**

```powershell
git add -- note-viewer/docker-compose.yml note-viewer/.dockerignore note-viewer/README.md
git commit -m "docs: document local ai knowledge base setup"
```

---

### Task 9: End-To-End Local Verification

**Files:**
- Modify only if verification reveals a defect in files touched by earlier tasks.

**Interfaces:**
- Consumes complete feature from Tasks 1-8.
- Produces verified working local AI knowledge base.

- [ ] **Step 1: Run full automated verification**

Run:

```powershell
cd note-viewer
npm run typecheck
npm test
npm run build
```

Expected: all commands pass.

- [ ] **Step 2: Verify Ollama availability manually**

Run:

```powershell
ollama list
```

Expected: output includes `qwen2.5:7b` and `bge-m3`. If not, run:

```powershell
ollama pull qwen2.5:7b
ollama pull bge-m3
```

- [ ] **Step 3: Start the app locally**

Run:

```powershell
cd note-viewer
$env:AI_ENABLED='true'
$env:AI_PROVIDER='ollama'
$env:OLLAMA_BASE_URL='http://localhost:11434'
$env:AI_CHAT_MODEL='qwen2.5:7b'
$env:AI_EMBEDDING_MODEL='bge-m3'
$env:AI_INDEX_DIR=(Resolve-Path '.\data\ai-index').Path
npm run dev
```

Expected: server and Vite client start without errors.

- [ ] **Step 4: Verify API status**

In another terminal:

```powershell
Invoke-RestMethod -Method Get -Uri 'http://localhost:8080/api/ai/status'
```

Expected: JSON includes `enabled: true`, `provider: ollama`, and `stale: true` before first indexing.

- [ ] **Step 5: Rebuild AI index**

Run:

```powershell
Invoke-RestMethod -Method Post -Uri 'http://localhost:8080/api/ai/reindex' -ContentType 'application/json' -Body '{}'
```

Expected: JSON includes `indexedFiles` greater than `0`, `indexedChunks` greater than `0`, and `stale: false`.

- [ ] **Step 6: Verify semantic search**

Run:

```powershell
Invoke-RestMethod -Method Post -Uri 'http://localhost:8080/api/ai/search' -ContentType 'application/json' -Body '{"query":"docker compose 怎么启动"}'
```

Expected: JSON array includes at least one result with `path`, `snippet`, and `score`.

- [ ] **Step 7: Verify grounded ask**

Run:

```powershell
Invoke-RestMethod -Method Post -Uri 'http://localhost:8080/api/ai/ask' -ContentType 'application/json' -Body '{"question":"Docker compose 怎么启动？"}'
```

Expected: JSON includes a Chinese `answer`, `model`, and a `citations` array with note paths.

- [ ] **Step 8: Commit verification fixes if needed**

If any fix was needed:

```powershell
git add -- note-viewer
git commit -m "fix: stabilize ai knowledge base verification"
```

If no fix was needed, do not create an empty commit.

---

## Self-Review

Spec coverage:

- Local Ollama default is covered in Tasks 1, 2, 8, and 9.
- Provider switching is covered in Tasks 1 and 2, with README coverage in Task 8.
- Semantic search is covered in Tasks 3, 5, 6, and 7.
- Grounded Q&A with citations is covered in Tasks 5, 6, and 7.
- Persistent AI index is covered in Task 4 and Docker volume docs in Task 8.
- Manual reindex and stale state are covered in Tasks 4, 6, and 7.
- Error handling is covered by `AiError` in Task 2 and server integration in Task 6.
- Automated and manual verification are covered in Tasks 1-9.

Placeholder scan:

- This plan contains no unresolved placeholder markers or undefined future placeholders.
- Every task has exact files, commands, expected outcomes, and commit commands.

Type consistency:

- `AiConfig`, `AiStatus`, `AiSearchRequest`, `AiSearchResult`, `AiAskRequest`, `AiAskResponse`, and `AiCitation` are defined in Task 1 and reused consistently.
- Provider interfaces are defined in Task 2 and consumed by Tasks 4 and 5.
- `AiRepository` is defined in Task 4 and consumed by Tasks 5 and 6.
- `AiRagService` is defined in Task 5 and consumed by Task 6.
