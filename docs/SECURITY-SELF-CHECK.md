# 安全自查报告

> 范围：当前仓库实现（Next.js App Router + Prisma + 可选 Redis/BullMQ）。  
> 态度：**如实记录已做防护与已知缺口**，不将「未完成」写成「已安全」。

---

## 1. SSRF（服务端请求伪造）与 URL 使用

### 1.1 已实现

- **`isUrlSafe`（`src/lib/security.ts`）** 在 **用户可控 URL 写入分析任务前**（`POST /api/analysis`）解析 URL，限制：
  - 仅 `http:` / `https:`
  - 拦截常见内网/metadata 主机名与 **字面量** 主机名为私网 IP 的情形（正则覆盖 127/10/172.16-31/192.168 等）
- **爬虫 `fetchPage`（`src/services/crawler.ts`）** 在发起请求前再次 `isUrlSafe`，失败则不抓取。
- **Lighthouse / PageSpeed** 入口在 `runLighthouseSummary` / `runPageSpeedInsightsSummary`（`src/services/lighthouse-audit.ts`）均对 URL 使用 **`isUrlSafe`**；不安全或不合规 URL **不发起**本机 Lighthouse、也 **不调用** Google PageSpeed API。

### 1.2 未覆盖 / 诚实缺口（含重定向链）

| 风险 | 说明 |
|------|------|
| **重定向后未复验** | `fetch` 使用 `redirect: "follow"`。若首跳 URL 对公网合法，**302/301 到内网或 metadata IP** 等场景，当前实现 **未在每一跳重新执行 `isUrlSafe`**，存在经典 **开放重定向 + SSRF** 组合的理论空间。 |
| **DNS 重绑定** | 未做「解析后再校验目标 IP」或短缓存 TTL 下的二次校验；高级攻击面未建模。 |
| **解析差异** | 依赖 `URL` 与 Node `fetch` 行为；国际化域名、非常规主机名字符等边界未单独审计。 |
| **PageSpeed / 出站至 Google** | 在配置 `GOOGLE_PSI_API_KEY` 时，仅对 **通过 `isUrlSafe` 的入口 URL** 调用 PageSpeed API；仍引入 **对 Google 的 URL 披露** 与 **API 密钥管理** 责任（密钥须仅服务端、限制 API 范围、定期轮换）。 |

**缓解建议（未实现）**：限制重定向次数；每次 Location 解析后 `isUrlSafe`；或对允许访问的 URL 使用固定解析与 IP 白名单策略。

---

## 2. 鉴权与访问控制

### 2.1 已实现

- **NextAuth Credentials + JWT**；API 通过 `getCurrentUserId()`（`src/lib/session.ts`）取当前用户。
- **项目 / 分析**：`GET`/`DELETE` 项目、创建分析、读分析详情与 PDF 等路径上，对 **资源所属 `userId`** 做校验，跨用户返回 **403** 或 **404**（依路由实现）。

### 2.2 注意项

- **会话固定 / 密码策略**：依赖应用层最小长度（注册 Zod）；无 MFA、无账户锁定策略等。
- **JWT 泄露**：`NEXTAUTH_SECRET` 强度与 HTTPS 部署由运维保证。

---

## 3. XSS（跨站脚本）

### 3.1 已实现

- 展示用户/抓取内容（标题、URL、issue 文案等）处使用 **`sanitizeHtml`（HTML 转义）**，降低浏览器把字符串当 HTML 解析的风险。
- **PDF**：通过 `@react-pdf/renderer` 的 `Text` 输出，非浏览器 DOM，但仍需防范异常字符；当前以截断与字符串处理为主。

### 3.2 缺口

- **`sanitizeHtml` 为简单转义**，若未来引入「允许部分标签」的富文本，需换成成熟策略（CSP、DOMPurify 服务端方案等）。
- **未全局设置 Content-Security-Policy 头**（仅应用层转义）。

---

## 4. 限流与滥用

### 4.1 已实现

- **`POST /api/analysis`**：每用户 **5 次 / 60s**（`checkRateLimit` + `Retry-After`）。
- **并发中的分析数**：`ANALYSIS_MAX_PER_USER`（默认 2）限制同一用户 `pending/crawling/analyzing` 数量。

### 4.2 缺口（多实例 / 内存）

| 问题 | 说明 |
|------|------|
| **内存 Map 限流** | `rateLimitStore` 为 **进程内 `Map`**。多实例（多容器、Vercel 多函数实例）下 **不共享**， effective 上限随实例数放大。 |
| **无全局用户配额** | 未按日/月总量计费式限流；未对 IP 单独限流（登录后全走 userId）。 |
| **重置与驱逐** | Map 无 TTL 清理逻辑（仅窗口过期替换），长期运行进程理论上缓慢增长（键数量受用户数 × 动作类型限制）。 |

**缓解建议**：Redis / Upstash + 滑动窗口；或网关层 WAF 限流。

---

## 5. 队列背压与拒绝服务（对自有系统）

### 5.1 已实现

- 入队前 **`getAnalysisQueueBacklog`**（waiting + active + delayed）与 **`ANALYSIS_QUEUE_MAX_BACKLOG`** 比较，超限返回 **503**。
- Worker **全局限速**（`ANALYSIS_GLOBAL_JOBS_PER_MINUTE`）与并发上限。

### 5.2 缺口

- **背压为近似**：计数与真实 Worker 处理能力仍存在瞬时差；极端情况下仍可短时间堆积。
- **失败重试**：BullMQ job `attempts: 2` 可能放大对 **外部站点** 的请求（对第三方 DoS 边界需合规使用）。

---

## 6. Secrets 与配置

### 6.1 要求

- **`NEXTAUTH_SECRET`**、**`DATABASE_URL`**、**`REDIS_URL`**、**`GOOGLE_PSI_API_KEY`**（若启用 PageSpeed）仅通过环境注入，**.env 不入库**（`.gitignore`）。
- 生产 **数据库**应强密码、TLS（`sslmode=require` 等）；应用启动时会对常见 `sslmode` 别名规范为 `verify-full`，以减少驱动弃用告警（见 `src/lib/prisma.ts`）。

### 6.2 缺口

- 未见 **密钥轮换流程**、**日志脱敏** 的系统性实现（开发环境注册 API 可能返回 `devDetail`，仅 `NODE_ENV===development`）。

---

## 7. 其他

- **依赖漏洞**：需定期 `npm audit`；本报告不绑定具体 CVE。
- **抓取合规**：产品不替你承担对第三方站点的 ToS/法律风险；需在业务上限制可分析 URL（当前仅技术层 `isUrlSafe`）。

---

## 8. 结论（自查）

- **当前适合**：笔试演示与 PoC、内网或低暴露自有站自检、在明确告知限制下的公网试用。  
- **生产级硬ening** 建议优先：**重定向后 URL 复验**、**Redis 限流**、**CSP**、按需关闭或隔离本机 Lighthouse；使用 PageSpeed 时 **锁紧 GCP API Key** 与配额监控。

---
