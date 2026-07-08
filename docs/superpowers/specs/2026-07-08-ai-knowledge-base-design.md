# AI 知识库设计

日期：2026-07-08

## 背景

当前仓库已经有 `note-viewer`，可以从 `笔记/` 读取真实目录结构，提供门户首页、目录树、Markdown/文本预览、图片资源、搜索和文件变化监听。

现有搜索索引只覆盖文件名、目录名、Markdown 一级标题和 README 一级标题。它适合快速定位入口，但还不能回答“我之前记录过某个问题怎么处理”这类知识库问题。

当前内容规模适合先做轻量 RAG：

- Markdown 文件约 172 个。
- Markdown 总量约 353 KB。
- 图片占主要体积，第一版不做图片理解。
- 文件变化由现有 watcher 感知，可以复用刷新机制。

## 目标

在 `note-viewer` 内新增 AI 知识库能力，第一版以本地模型为主：

- 使用 Ollama 作为默认本地模型服务。
- 支持语义搜索。
- 支持基于笔记内容的问答。
- 回答必须返回引用来源，引用可以跳转回原笔记。
- Provider 接口提前设计好，后续可以切换到在线 OpenAI 兼容接口。
- AI 索引持久化到应用数据目录，避免每次重启都重新生成。

## 非目标

- 第一版不做在线编辑、自动写回笔记或知识库改写。
- 第一版不做多用户权限、账号系统或审计。
- 第一版不做图片 OCR、图片理解或多模态问答。
- 第一版不做复杂 Agent、工具调用、联网搜索或自动执行命令。
- 第一版不引入 Dify、FastGPT、AnythingLLM 等外部知识库平台。
- 第一版不要求完美增量索引；可以先全量重建，后续再优化。

## 总体架构

AI 知识库作为 `note-viewer` 后端的一个独立子模块实现。

```text
note-viewer/src/server/services/ai/
├─ providers/
│  ├─ types.ts
│  ├─ createProvider.ts
│  ├─ ollamaProvider.ts
│  └─ openAiCompatibleProvider.ts
├─ chunkDocuments.ts
├─ aiIndexStore.ts
├─ vectorSearch.ts
├─ ragService.ts
└─ aiRepository.ts
```

前端只通过后端 AI API 访问，不直接调用 Ollama 或在线模型服务。

```text
Browser
-> /api/ai/search 或 /api/ai/ask
-> RagService
-> VectorStore 检索相关 chunk
-> ChatProvider 生成答案
-> 返回答案 + citations
```

## Provider 抽象

模型调用必须通过统一接口，业务代码不能直接依赖 Ollama 或在线供应商。

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

`createAiProvider(config)` 根据配置创建 provider：

- `AI_PROVIDER=ollama`：使用 Ollama 本地接口。
- `AI_PROVIDER=openai-compatible`：使用 OpenAI 兼容在线接口。

后续切换在线模型时，只改环境变量和 provider 实现，不改索引、检索、问答和前端代码。

## 默认本地模型配置

第一版默认使用 Ollama：

```env
AI_ENABLED=true
AI_PROVIDER=ollama

OLLAMA_BASE_URL=http://localhost:11434
AI_CHAT_MODEL=qwen2.5:7b
AI_EMBEDDING_MODEL=bge-m3

AI_INDEX_DIR=/app/data/ai-index
AI_TOP_K=6
AI_MAX_CONTEXT_CHARS=12000
```

Docker 场景下，如果 Ollama 在宿主机运行，容器需要能访问宿主机地址。Windows Docker Desktop 可优先配置：

```env
OLLAMA_BASE_URL=http://host.docker.internal:11434
```

后续切在线模型时使用：

```env
AI_PROVIDER=openai-compatible
OPENAI_COMPATIBLE_BASE_URL=https://api.example.com/v1
OPENAI_API_KEY=由部署环境提供
AI_CHAT_MODEL=provider-chat-model
AI_EMBEDDING_MODEL=provider-embedding-model
```

## 索引数据

AI 索引以 chunk 为单位。

```ts
export type AiDocumentChunk = {
  id: string;
  path: string;
  title: string;
  heading?: string;
  content: string;
  contentHash: string;
  updatedAt?: string;
  embedding: number[];
};
```

`id` 可以由 `path + chunkIndex + contentHash` 生成。`contentHash` 用于判断内容是否变化。

第一版索引内容：

- Markdown 文件。
- 当前已支持预览的文本/配置文件。

第一版跳过内容：

- 图片。
- zip 等二进制文件。
- 被 `safePath` 忽略的路径。
- 过大的单文件，超过阈值时只索引前若干字符并记录状态。

## 文档切片规则

切片逻辑应保持简单可解释：

- Markdown 优先按标题层级切分。
- 标题段落过长时按段落继续拆分。
- 代码块保留在所属片段中，不打散到无上下文状态。
- 每个 chunk 目标长度约 800 到 1200 中文字符。
- 相邻 chunk 可以保留少量重叠，避免上下文断裂。
- chunk metadata 保留 `path`、文件名、最近标题和更新时间。

这样生成的引用更容易回到原笔记，也方便后续高亮定位。

## 向量存储

推荐第一版使用本地持久化文件 + 内存向量检索：

- 启动时从 `AI_INDEX_DIR` 加载索引 JSON。
- 搜索时在内存中做 cosine similarity。
- 重建索引后写回磁盘。

理由：

- 当前 Markdown 总量很小，不需要先引入向量数据库。
- 实现简单，Docker 部署少一个服务。
- 后续如果内容规模增长，可以把 `AiIndexStore` 替换成 SQLite/LanceDB/Chroma，RAG 层不需要改。

索引目录通过 Docker volume 持久化：

```yaml
volumes:
  - ./data:/app/data
```

## API 设计

新增 `src/server/routes/ai.ts`，统一挂载在 `/api/ai`。

### `GET /api/ai/status`

返回 AI 开关、provider、模型、索引状态和最后更新时间。

```ts
type AiStatus = {
  enabled: boolean;
  provider: string;
  chatModel?: string;
  embeddingModel?: string;
  indexedChunks: number;
  indexedFiles: number;
  lastIndexedAt?: string;
  indexing: boolean;
};
```

### `POST /api/ai/reindex`

触发重建索引。

第一版可以同步返回最终结果；如果耗时变长，再改成后台任务和轮询状态。

### `POST /api/ai/search`

请求：

```ts
type AiSearchRequest = {
  query: string;
  topK?: number;
};
```

响应：

```ts
type AiSearchResult = {
  path: string;
  title: string;
  heading?: string;
  snippet: string;
  score: number;
};
```

### `POST /api/ai/ask`

请求：

```ts
type AiAskRequest = {
  question: string;
  topK?: number;
};
```

响应：

```ts
type AiCitation = {
  path: string;
  title: string;
  heading?: string;
  snippet: string;
};

type AiAskResponse = {
  answer: string;
  citations: AiCitation[];
  model: string;
};
```

如果没有足够相关内容，回答应明确说明“当前笔记中没有找到足够依据”，不要编造。

## 问答 Prompt 规则

系统提示应强调：

- 只基于提供的笔记片段回答。
- 不确定时说明无法从当前笔记确认。
- 回答使用中文。
- 涉及命令、路径、代码标识符时保留原文。
- 结论后附简短引用说明，由 API 的 `citations` 字段承载结构化来源。

RAG 上下文由检索结果拼接，控制在 `AI_MAX_CONTEXT_CHARS` 内。

## 前端设计

在现有工具型界面中新增 AI 入口，不替代原搜索：

- 保留现有 `SearchBox` 的快速目录/标题搜索。
- 新增 `AiPanel` 或 `AiAssistant` 组件。
- 用户可以输入问题，看到回答和引用列表。
- 引用项点击后复用现有打开文件逻辑跳转到对应笔记。
- 显示 AI 状态：未启用、索引为空、正在索引、模型连接失败。

第一版不需要复杂聊天历史。可以只保留当前问题和回答，降低实现风险。

## 文件变化处理

现有 watcher 已经会在文件变化后刷新目录树和搜索索引。

第一版 AI 索引策略：

- 文件变化后标记 AI 索引为 stale。
- 前端状态提示“知识库索引需要更新”。
- 可以提供手动“重建索引”按钮。

不建议第一版每次文件变化都自动调用 embedding，因为本地模型可能较慢，且频繁保存 Markdown 时会造成重复计算。

后续优化：

- debounce 后后台增量索引。
- 根据 `path + mtime + hash` 只更新变化文件。
- 删除不存在文件对应的 chunks。

## 错误处理

需要明确区分这些错误：

- AI 未启用：返回 503 和清晰提示。
- Ollama 不可达：返回 502，提示检查 `OLLAMA_BASE_URL`。
- 模型不存在：返回 502，提示检查 `AI_CHAT_MODEL` 或 `AI_EMBEDDING_MODEL`。
- 索引为空：允许状态页展示，并提示先重建索引。
- 请求为空或过长：返回 400。

后端错误信息面向用户使用中文，日志保留 provider 返回的技术细节。

## 测试要求

后端测试：

- `createAiProvider` 能根据 `AI_PROVIDER` 创建 Ollama 或 OpenAI 兼容实现。
- chunk 逻辑能按 Markdown 标题生成带 metadata 的片段。
- 向量检索能按 cosine similarity 返回 topK。
- `/api/ai/search` 在索引为空、AI 未启用、正常检索时行为正确。
- `/api/ai/ask` 能使用 mock provider 返回答案和 citations。
- provider 错误能转成稳定的 HTTP 错误。

前端测试：

- AI 未启用时显示状态提示。
- 用户提问后调用 `api.aiAsk` 并展示回答。
- 引用点击会调用现有 `onOpenPath`。
- 失败时显示错误，不覆盖已有文件预览。

验证命令：

```powershell
cd note-viewer
npm run typecheck
npm test
npm run build
```

## 实施顺序

1. 增加 shared AI 类型和配置读取。
2. 增加 provider 抽象和 Ollama/OpenAI 兼容 provider 骨架。
3. 增加文档切片和索引存储。
4. 增加向量检索和 RAG 服务。
5. 增加 `/api/ai/*` 路由。
6. 增加前端 AI 面板。
7. 更新 Docker、README 和运行说明。
8. 使用 mock provider 完成自动化测试，再用本地 Ollama 手动验证。

## 风险与取舍

- 本地模型效果取决于用户实际安装的模型。设计上通过配置暴露模型名，不在代码中绑定固定模型。
- JSON + 内存向量检索不是长期最强方案，但对当前内容规模足够，并且容易替换。
- 手动重建索引比自动 embedding 更保守，能避免频繁保存文件时拖慢应用。
- OpenAI 兼容 provider 第一版可以先实现接口和测试骨架，真实在线模型验证留到后续启用在线服务时做。
