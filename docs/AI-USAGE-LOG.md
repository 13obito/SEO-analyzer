# AI 使用日志

> 目的：说明人机协作方式、主要工具、AI 参与较多的模块，以及人工决策与修改原因。  
> 日期以仓库提交与对话为准；具体命令与时间线可按需补充。

---

## 1. 使用过的工具与协作方式

| 类型 | 工具 / 方式 |
|------|-------------|
| 编辑器内 AI | Cursor Agent（对话式改代码、检索仓库、运行终端命令） |
| 版本管理 | Git；提交说明可使用英文（便于记录与 CI） |
| 依赖与构建 | `npm`、Prisma CLI、`tsc`、本地 `next build`（需 DB 时可能失败，以 `tsc` 为辅） |

**协作模式简述**

- 由人提出目标（功能、汉化、文档、排错等），AI 在仓库内定位文件、提议补丁并执行可自动完成的校验命令。
- 敏感操作（如写入生产密钥、强制 `git push --force`）由人确认；本仓库约定 **不自动 push**，仅在明确指令下执行。

---

## 2. 哪些模块以 AI 辅助为主

下列模块在实现或迭代时 **大量依赖 AI 生成/改写 diff**，再由人工核对行为与边界：

- **分析与队列**：`src/lib/analysis-queue.ts`、`src/workers/analysis-worker.ts`、`POST /api/analysis` 与 Vercel `waitUntil` / 内联 vs 队列分支。
- **爬虫与关键词**：`src/services/crawler.ts`（URL 规范化、正文剥离代码块）、`src/services/keyword-analyzer.ts`（token 过滤）。
- **实验室性能**：`src/services/lighthouse-audit.ts`（本地 Lighthouse、PageSpeed Insights fallback、与 `analyzer` 串联）、`next.config.ts` 中与 Lighthouse 相关的 **output file tracing**。
- **问题合并展示**：`src/lib/aggregate-seo-issues.ts`、仪表盘与 `src/lib/analysis-report-pdf.tsx`。
- **数据库客户端**：`src/lib/prisma.ts`（PostgreSQL URL 中 `sslmode` 规范化）。
- **国际化（中文界面）**：`src/app/**` 页面文案、`src/lib/zh-ui.ts`、SEO 规则中文 `src/services/seo-scorer.ts`、API 错误信息、`src/lib/analysis-report-pdf.tsx` 与中文字体注册。
- **历史数据兼容**：英文 issue 库表字段的展示映射（`zh-ui.ts` 中 `LEGACY_*`），避免旧分析记录仍显示英文。
- **安全相关工具函数**：`src/lib/security.ts`（URL 安全检查、内存限流响应体等），与调用方 API 路由对齐。
- **项目文档**：本文件与 `README.md`、`SECURITY-SELF-CHECK.md` 的结构化撰写（基于当前代码事实核对）。

**以人工为主的部分**

- 运行环境（Postgres / Redis / Vercel 控制台）的实际账号与启停。
- 业务取舍（例如是否关闭本机 Lighthouse、是否配置 PageSpeed API、队列部署拓扑）。
- 代码审阅与合并策略。

---

## 3. 主要改动与原因（摘要）

| 方向 | 原因 |
|------|------|
| Postgres + Prisma 7 adapter | 部署到 Serverless，弃用本地 SQLite 路径在云上不可用的问题。 |
| 内联分析 + `waitUntil` | Hobby 等场景无常驻 Worker 时仍能完成部分分析；与队列模式解耦。 |
| BullMQ Worker | 可选的生产形态：长任务、可横向扩 Worker、与 API 进程分离。 |
| `isUrlSafe` / Zod | 降低 SSRF 与无效输入风险；具体缺口见安全自查报告。 |
| 中文 UI + PDF Noto 字体 | 产品面向中文用户；PDF 需嵌入字体避免缺字。 |
| Legacy issue 映射 | 库里已存英文 issue 文本时，展示层仍为中文，无需强制重跑历史任务。 |
| 爬取与报告体验 | URL 去 hash 去重、正文排除代码块、关键词过滤 hex、同类 SEO 问题合并（PDF/仪表盘）、仪表盘区分 Lighthouse 与 PageSpeed Insights 标签。 |
| Vercel 可运行性 | Lighthouse 静态资源打入 Serverless trace；无 Chrome 时用 PSI；Prisma 连接串 `sslmode` 规范化减少 `pg` 告警。 |

---

## 4. 使用 AI 的风险控制（本项目中已做的）

- 对 AI 给出的大型 diff 用 **TypeScript 检查** 与局部代码阅读交叉验证。
- 文档中的行为描述与 **`src/` 实际实现** 对照，避免「文档超前于代码」。
- 不把 `.env`、密钥写进仓库或粘贴进对话正文（使用占位符与 `.env.example`）。

---