# SEO 分析器 — 代码库全貌说明（供 AI / 答辩问答使用）

> 本文面向 **豆包等对话模型** 与人类评审：概括仓库 `seo-analyzer` 的架构、数据流、关键文件与安全边界，便于后续针对性问答。  
> 技术栈：**Next.js 16 App Router**、**React 19**、**PostgreSQL + Prisma 7**、**NextAuth**、可选 **BullMQ + Redis**。

---

## 1. 产品是做什么的

面向站长的 **SEO 站点分析平台**：用户注册登录 → 创建「项目」→ 提交 **起始 URL** 与 **抓取深度（1–3）** → 系统抓取站内页面（有上限）→ 写入 **页面明细、SEO 问题、关键词** → 展示 **综合得分、趋势图** → 可导出 **PDF**。  
实验室性能：优先 **本机 Lighthouse**（Chrome）；失败或无 Chrome 时用 **Google PageSpeed Insights API**（环境变量密钥）；其余页面用 **首包耗时启发式** 估算性能分。

---

## 2. 源码目录一览（`src/`）

| 路径 | 职责 |
|------|------|
| `src/app/` | Next.js 页面与 Route Handlers（`/api/*`） |
| `src/app/page.tsx` | 营销首页 |
| `src/app/auth/login`、`register` | 登录、注册页 |
| `src/app/dashboard/page.tsx` | 仪表盘入口（项目列表） |
| `src/app/dashboard/project/[id]/page.tsx` | 单个项目：发起分析、历史列表 |
| `src/app/dashboard/analysis/[id]/page.tsx` | 单次分析详情：概览/页面/问题/关键词/趋势；合并展示问题；Lighthouse/PageSpeed 标签 |
| `src/app/api/auth/[...nextauth]/route.ts` | NextAuth |
| `src/app/api/auth/register/route.ts` | 注册（密码 bcrypt） |
| `src/app/api/projects/route.ts`、`projects/[id]/route.ts` | 项目的 CRUD（带 userId 校验） |
| `src/app/api/analysis/route.ts` | **POST** 创建分析任务（限流、队列/内联分支、`waitUntil`） |
| `src/app/api/analysis/[id]/route.ts` | **GET** 分析详情（含 pages/issues/keywords/project） |
| `src/app/api/analysis/[id]/pdf/route.ts` | PDF 流响应 |
| `src/app/api/analysis/[id]/trend/route.ts` | 同一项目多次分析的得分序列（图表用） |
| `src/services/analyzer.ts` | **分析流水线**：爬取 → 实验室性能 → 打分 → 写库 |
| `src/services/crawler.ts` | 递归站内抓取、解析 HTML、`normalizeCrawlUrl` |
| `src/services/seo-scorer.ts` | 规则扣分 → **overallScore** + **issues**（与实验室性能分分离） |
| `src/services/keyword-analyzer.ts` | 全站点正文分词、密度、堆砌阈值 |
| `src/services/lighthouse-audit.ts` | 本地 Lighthouse、PSI、`resolvePerformanceScore` |
| `src/lib/prisma.ts` | PrismaClient + **PostgreSQL URL sslmode 规范化** |
| `src/lib/security.ts` | **SSRF `isUrlSafe`**、Zod 输入、`sanitizeHtml`、内存限流、统一 JSON 错误响应 |
| `src/lib/session.ts` | `getCurrentUserId()`（NextAuth session） |
| `src/lib/auth-options.ts` | NextAuth Credentials + JWT、`authorize` 里查库比对密码 |
| `src/lib/analysis-queue.ts` | BullMQ 入队、队列 backlog |
| `src/lib/analysis-job.ts` | 队列名与 Job 类型 |
| `src/lib/redis-connection.ts` | ioredis 连接工厂 |
| `src/lib/aggregate-seo-issues.ts` | 按 severity+category+message+suggestion **合并问题**，附影响页数与示例 URL |
| `src/lib/analysis-report-pdf.tsx` | `@react-pdf/renderer` 报告组件 |
| `src/lib/zh-ui.ts` | 中文展示映射（严重级别、分类、**遗留英文 issue 文案映射**） |
| `src/workers/analysis-worker.ts` | 独立进程消费队列调用 `runAnalysis` |
| `src/generated/prisma/` | Prisma Client 生成输出（勿手改） |

---

## 3. 数据模型（`prisma/schema.prisma`）

- **User**：email 唯一、`hashedPassword`。  
- **Project**：归属 `userId`，含 `name`、`url`（项目元数据，分析时可另填起始 URL）。  
- **Analysis**：归属 `projectId`；`url`（本次分析入口）、`crawlDepth`、`status`（`pending | crawling | analyzing | completed | failed`）、`overallScore`、`errorMessage`。  
- **PageResult**：每抓取一页一行：`title`、`metaDescription`、`h1–h6` 计数、`headingStructure` JSON、`img*`、`link*`、`linkDetails` JSON、`loadTimeMs`、`wordCount`、`isMobileFriendly`（viewport）、`performanceScore`、`mobileFriendlyDetails` JSON（实验室指标时含 `lighthouse`、`labSource`、`metrics`）。  
- **SeoIssue**：`pageUrl`、`severity`、`category`、`message`、`suggestion`。  
- **KeywordResult**：`keyword`、`count`、`density`、`isStuffing`、`locations` JSON。

级联删除：删 Project / Analysis 会删子记录。

---

## 4. 核心运行时路径

### 4.1 创建分析 `POST /api/analysis`

文件：`src/app/api/analysis/route.ts`。

1. `getCurrentUserId()`，未登录 → **401**。  
2. **速率限制**：`checkRateLimit(rateLimitKey(userId,"analysis"), 5, 60000)` —— **进程内 Map**，多实例不共享。  
3. Body：`analysisInputSchema` —— `url`（Zod url max 2048）、`crawlDepth` 1–3、`projectId` UUID。  
4. 加载 Project，`project.userId !== userId` → **403**。  
5. **`isUrlSafe(url)`** 不通过 → **400**（SSRF 第一道闸）。  
6. 统计用户 `pending/crawling/analyzing` 分析数 ≥ `ANALYSIS_MAX_PER_USER`（默认 2，上限钳制 20）→ **429**。  
7. **执行模式**：  
   - `ANALYSIS_USE_QUEUE=1` → **队列模式**：检查 Redis backlog ≤ `ANALYSIS_QUEUE_MAX_BACKLOG`，入队；失败删 Analysis。  
   - 否则若 `VERCEL=1` 或 `ANALYSIS_USE_INLINE=1` → **内联**：`runAnalysis(id)`，`VERCEL=1` 时用 `@vercel/functions` 的 **`waitUntil(task)`** 延长 Serverless 生命周期。  
8. `maxDuration = 60`（秒），仍受套餐限制。

### 4.2 分析流水线 `runAnalysis`（`src/services/analyzer.ts`）

1. `status → crawling`。  
2. `crawlSite(analysis.url, analysis.crawlDepth)` → `PageSeoData[]`；空则 `failed`。  
3. `status → analyzing`。  
4. **实验室性能**（仅用于「入口匹配」的那一行 PageResult，见下）：  
   - 若 `LIGHTHOUSE_DISABLED !== "1"`：尝试 `runLighthouseSummary(analysis.url)`（需 Chrome）。  
   - 若无结果：`runPageSpeedInsightsSummary(analysis.url)`（需 `GOOGLE_PSI_API_KEY`，请求 Google PageSpeed v5）。  
5. `scorePages(pages)` → `overallScore` + `issues`（**不含** Lighthouse 分数）。  
6. `analyzeKeywords(pages)` → 全局聚合 Top 30 关键词。  
7. 对每个 `page` 写 **PageResult**：  
   - **实验室数据**仅当 `urlsMatch(page.url, analysis.url)` 或（无匹配时）`page === pages[0]` 时挂载 `mobileFriendlyDetails` 与 `resolvePerformanceScore(loadTimeMs, lab)`；否则 `performanceScore` 仅用 **`loadTimeMs` 启发式**。  
8. 批量写 SeoIssue、KeywordResult。  
9. `status → completed`，写入 `overallScore`。

### 4.3 爬虫 `crawlSite`（`src/services/crawler.ts`）

- **起点**：`crawl(startUrl, depth)`，初始 **`depth = 1`**。  
- **终止条件**：`depth > maxDepth`（用户选的 crawlDepth）或 **`visited.size >= maxPages`（20）**。  
- **URL 规范化**：`normalizeCrawlUrl` —— **去掉 hash**，减少同一文档多锚点重复。  
- 每次请求前 **`isUrlSafe`**；`fetch` 带 UA、`AbortSignal` 超时、`redirect: "follow"`（**重定向后不复验** —— 已知 SSRF 缺口）。  
- **解析**：Cheerio；正文统计前移除 **`script, style, noscript, pre, code, textarea, kbd, samp`** 再算 `bodyText`/`wordCount`。  
- **Follow**：仅 **同 hostname** 且 **非外链**、**非死链**（先做 HEAD 检查，`linkDetails` 最多检查前 50）；每层 **`slice(0, 10)`** 个内部链接再递归。  
- **DFS**：先深挖第一条链接子树，再下一个兄弟（顺序影响「谁先占满 20 页」）。

### 4.4 综合得分 `scorePages`（`src/services/seo-scorer.ts`）

- 对 **每一页** 套用多条规则（缺 title、meta、多 H1、缺 alt、死链、内链为 0、`loadTimeMs > 3000/>5000`、缺 viewport、字数过少、HTML 体积过大等），命中则 **累计扣分**并生成 issue。  
- **overallScore** = `100 - (totalDeductions / maxDeduction) * 100` 再钳制，与 **`performanceScore`（实验室/启发式）无关**。  
- 深度变大可能抓到更多页 → 扣分更多 → **总分可能下降**。

### 4.5 关键词 `analyzeKeywords`（`src/services/keyword-analyzer.ts`）

- 对所有页的 **`bodyText`** 做 `tokenize`：小写、按 Unicode 字母数字切词、长度≥2、去掉英文/中文 **停用词**、去掉 **`/^[0-9a-f]{6,}$/i` 长 hex**。  
- **全局词频累加**，取 Top **30**；`density = count / totalWords * 100`；超 **3.5%** 标记堆砌。  
- **次数是「本次任务所有抓取页合计」**，不是单页浏览器 Ctrl+F。

### 4.6 实验室性能 `lighthouse-audit.ts`

- **`urlsMatch`**：origin + pathname（去尾 `/`）+ search，去 hash。  
- **`resolvePerformanceScore`**：有实验室 summary 用其 performance；否则 `<1s→100`、`<3s→70` 等阶梯。  
- **PSI**：`fetch` Google API，`strategy=mobile`，`category=performance`，超时约 55s；日志前缀 **`[pagespeed]`**。  
- **本地 Lighthouse**：`chrome-launcher` + `lighthouse` LR mobile；日志 **`[lighthouse]`**。

### 4.7 前端展示要点（`dashboard/analysis/[id]/page.tsx`）

- 解析 `mobileFriendlyDetails` JSON：有 `lighthouse` + `metrics` 则展示 **FCP/LCP/TBT/CLS/SpeedIndex**；`labSource === "pagespeed"` 显示 **PageSpeed Insights**，否则 **Lighthouse**。  
- **问题 Tab**：`aggregateSeoIssues` 合并同类项，显示 **页数**、示例 URL。  
- 外部文本经 **`sanitizeHtml`** 转义防 XSS。

### 4.8 PDF（`api/analysis/[id]/pdf/route.ts` + `analysis-report-pdf.tsx`）

- 校验用户与 project 归属；组装数据；仅 **critical + warning** 合并进 PDF 问题表（与仪表盘「含 info」可不同）；嵌入 Noto Sans SC 字体。

### 4.9 趋势 `GET .../trend`

- 同一 `projectId` 下已完成分析按时间排序，返回 `createdAt` + `overallScore` 序列供 Recharts。

---

## 5. 安全与合规（实现 vs 文档）

| 主题 | 实现要点 |
|------|-----------|
| SSRF | `isUrlSafe`：仅 http/https；黑名单 hostname；私网 IPv4/IPv6 字面 hostname。**未**对 redirect 每一跳复验。 |
| 鉴权 | API 普遍 `getCurrentUserId()`；资源对比 **`project.userId`**。 |
| XSS | `sanitizeHtml` HTML 实体转义；非 CSP。 |
| 密钥 | `DATABASE_URL`、`NEXTAUTH_SECRET`、`GOOGLE_PSI_API_KEY` 等仅服务端环境变量。 |
| PSI | 仅对已 `isUrlSafe` 的 URL 请求 Google；涉及出站隐私需在自述中说明。 |

详细缺口见 **`docs/SECURITY-SELF-CHECK.md`**。

---

## 6. 部署与配置要点

- **Vercel**：默认 **内联** `runAnalysis` + `waitUntil`；无 Chrome → 依赖 **PSI** 或启发式。  
- **`next.config.ts`**：`serverExternalPackages` 含 lighthouse/pg；**`outputFileTracingIncludes`** 打包 lighthouse 静态文件防 ENOENT。  
- **`src/lib/prisma.ts`**：将连接串中 `sslmode=require/prefer/verify-ca` 规范为 **`verify-full`**，减轻 pg 驱动告警。  
- **队列生产**：`ANALYSIS_USE_QUEUE=1` + Redis + 单独运行 **`npm run worker:analysis`**（Vercel Serverless 内无法常驻 Worker）。

环境变量完整表见 **`README.md`** 与 **`.env.example`**。

---

## 7. 已知「容易误解」的行为（问答高频）

1. **深度 2 vs 3 页数相同**：去重 + 每层最多 10 链 + 全局 20 页 + 站点互相链接 → 深层可能没有「新 URL」。  
2. **关键词次数 ≫ 浏览器单页查找**：关键词为 **多页 body 合计**。  
3. **综合分不变但实验室性能分变了**：总分来自 **seo-scorer**，不含 PSI/Lighthouse 分。  
4. **仅一行带「完整实验室」**：设计上只对 **入口 URL 匹配行**（或第一条）写 PSI/LH；其余为启发式。

---

## 8. 依赖中与领域相关的包

- `cheerio`：HTML 解析  
- `lighthouse`、`chrome-launcher`：本地实验室  
- `@react-pdf/renderer`、`@fontsource/noto-sans-sc`：PDF  
- `bullmq`、`ioredis`：队列  
- `next-auth`、`bcryptjs`：认证  
- `@prisma/adapter-pg`、`pg`：Postgres  
- `recharts`：趋势图  
- `zod`：校验  
- `@vercel/functions`：`waitUntil`

---

## 9. 文档交付物（笔试）

- **`README.md`**：技术栈、架构图、本地启动、已知限制  
- **`docs/AI-USAGE-LOG.md`**：AI 工具使用与人工修改说明  
- **`docs/SECURITY-SELF-CHECK.md`**：攻击面与自查  

本文 **`PROJECT-CODEBASE-GUIDE.md`** 作为 **代码级索引**，可与上述三者一并提供给评审或对话模型。

---

*文档生成依据仓库当前结构；若代码变更，请以 `src/` 与 `prisma/schema.prisma` 为准。*
