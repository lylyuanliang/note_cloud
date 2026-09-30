# DSH Crew

这里记录把 **DSH（DeepSeek Harness）** 接到 **Codex** 上、由 Codex 派发任务给 DSH 执行的完整方案：安装插件、配置路由（**不需要另外申请 API key**）、在 Codex 侧注册 MCP、加固 hook、验证派发，以及排障和本地看板。

### 1. [DSH Crew 接入 Codex 全流程教程](./1.DSH%20Crew%20接入%20Codex%20全流程教程.md)

> 从安装插件到第一次成功派发的完整步骤，每一步都有验证点和失败处理，第一次配置按这篇走。

### 2. [DSH Crew 派发链路与排障手册](./2.DSH%20Crew%20派发链路与排障手册.md)

> 症状导向：Codex 自己开子代理、缺 API key、推理档位不支持、MCP 没注册、cwd 锁冲突等，并给出证据读取命令。

### 3. [DSH Crew 本地看板使用说明](./3.DSH%20Crew%20本地看板使用说明.md)

> 自建 worker 任务看板（Node 单文件服务 + 单页 + bat 入口），含部署、启停、接口、资源占用和二次改造点。

### 4. [DSH Crew 配置项地图（界面 vs 文件）](./4.DSH%20Crew%20配置项地图.md)

> 哪些配置有界面、哪些**只能改文件**，以及可直接粘贴的完整内容：`config.json`、`config.toml` MCP 段、`hooks.json`、两个 hook 脚本、全局 `AGENTS.md` 规则。

## 阅读顺序建议

1. 第一次配置 → 第 1 篇（遇到报错再翻第 2 篇）
2. 想让"派给 dsh"这类自然说法稳定生效 → 第 4 篇的 hook 与 AGENTS 规则
3. 想随时看 worker 列表 → 第 3 篇
