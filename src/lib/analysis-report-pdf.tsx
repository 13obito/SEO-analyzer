import path from "node:path";
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Font,
} from "@react-pdf/renderer";
import { severityLabel } from "@/lib/zh-ui";

const notoSansRegular = path.join(
  process.cwd(),
  "node_modules/@fontsource/noto-sans-sc/files/noto-sans-sc-chinese-simplified-400-normal.woff2"
);
const notoSansBold = path.join(
  process.cwd(),
  "node_modules/@fontsource/noto-sans-sc/files/noto-sans-sc-chinese-simplified-700-normal.woff2"
);

let cjkPdfFontRegistered = false;
function registerCjkPdfFont() {
  if (cjkPdfFontRegistered) return;
  try {
    Font.register({
      family: "NotoSansSC",
      fonts: [
        { src: notoSansRegular, fontWeight: 400 },
        { src: notoSansBold, fontWeight: 700 },
      ],
    });
  } catch {
    /* HMR 等场景可能重复注册 */
  }
  cjkPdfFontRegistered = true;
}

registerCjkPdfFont();

const styles = StyleSheet.create({
  page: {
    padding: 36,
    fontSize: 9,
    fontFamily: "NotoSansSC",
    color: "#1e293b",
  },
  h1: {
    fontSize: 20,
    fontWeight: 700,
    marginBottom: 8,
    color: "#0f172a",
    borderBottomWidth: 2,
    borderBottomColor: "#10b981",
    paddingBottom: 6,
  },
  h2: {
    fontSize: 12,
    fontWeight: 700,
    marginTop: 14,
    marginBottom: 6,
    color: "#424f5f",
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
    paddingBottom: 4,
  },
  meta: { fontSize: 8, color: "#64748b", marginBottom: 10 },
  scoreBox: {
    textAlign: "center",
    padding: 16,
    borderRadius: 8,
    marginVertical: 12,
  },
  scoreGood: { backgroundColor: "#ecfdf5", color: "#059669" },
  scoreMedium: { backgroundColor: "#fffbeb", color: "#d97706" },
  scoreBad: { backgroundColor: "#fef2f2", color: "#dc2626" },
  scoreNum: { fontSize: 32, fontWeight: "bold" },
  row: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#e8edf3", paddingVertical: 4 },
  th: { fontWeight: "bold", fontSize: 8, color: "#334155", backgroundColor: "#f1f5f9", padding: 5 },
  td: { fontSize: 8, padding: 4, flex: 1 },
  tdNarrow: { fontSize: 8, padding: 4, width: 44 },
  tdWide: { fontSize: 8, padding: 4, flex: 2 },
  critical: { color: "#dc2626" },
  warning: { color: "#d97706" },
  stuffing: { color: "#dc2626", fontWeight: "bold" },
  footer: { marginTop: 20, fontSize: 8, color: "#94a3af", borderTopWidth: 1, borderTopColor: "#e2e8f0", paddingTop: 8 },
});

export type AnalysisPdfInput = {
  analysisId: string;
  url: string;
  createdAt: Date;
  crawlDepth: number;
  overallScore: number | null;
  projectName: string;
  pages: Array<{
    url: string;
    statusCode: number | null;
    title: string | null;
    loadTimeMs: number | null;
    wordCount: number;
    isMobileFriendly: boolean;
    performanceScore: number | null;
  }>;
  seoIssues: Array<{
    severity: string;
    category: string;
    message: string;
    suggestion: string | null;
  }>;
  keywords: Array<{
    keyword: string;
    count: number;
    density: number;
    isStuffing: boolean;
  }>;
};

function safe(s: string | null | undefined, max = 2000): string {
  if (s == null) return "";
  const t = String(s).replace(/\s+/g, " ").trim();
  return t.length > max ? `${t.slice(0, max)}…` : t;
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

export function AnalysisReportPdf({ data }: { data: AnalysisPdfInput }) {
  const score = data.overallScore ?? 0;
  const critical = data.seoIssues.filter((i) => i.severity === "critical");
  const warnings = data.seoIssues.filter((i) => i.severity === "warning");
  const issueRows = [...critical, ...warnings];
  const issueParts = chunk(issueRows, 22);
  const pageParts = chunk(data.pages, 14);
  const kwParts = chunk(data.keywords, 30);

  const scoreStyle =
    score >= 80 ? styles.scoreGood : score >= 50 ? styles.scoreMedium : styles.scoreBad;

  return (
    <Document
      title={`SEO 报告 — ${safe(data.projectName, 120)}`}
      author="SEO 分析器"
      subject="SEO 分析报告导出"
    >
      <Page size="A4" style={styles.page}>
        <Text style={styles.h1}>SEO 分析报告</Text>
        <Text style={styles.meta}>
          项目：{safe(data.projectName, 200)} | 分析 URL：{safe(data.url, 500)} | 深度：{" "}
          {data.crawlDepth} | {new Date(data.createdAt).toLocaleString("zh-CN")}
        </Text>
        <View style={[styles.scoreBox, scoreStyle]}>
          <Text style={styles.scoreNum}>{Math.round(score)} / 100</Text>
          <Text style={{ fontSize: 10, marginTop: 4 }}>综合 SEO 得分</Text>
        </View>
        <Text style={{ marginBottom: 8 }}>
          已抓取页面：{data.pages.length} | 严重：{critical.length} | 警告：{warnings.length}
        </Text>
        <Text style={styles.h2}>问题（首段）</Text>
        {issueParts[0]?.length ? (
          <View>
            <View style={[styles.row, { borderBottomWidth: 0 }]}>
              <Text style={[styles.th, { flex: 0.9 }]}>级别</Text>
              <Text style={[styles.th, { flex: 0.9 }]}>类别</Text>
              <Text style={[styles.th, { flex: 2 }]}>问题</Text>
              <Text style={[styles.th, { flex: 1.8 }]}>建议</Text>
            </View>
            {issueParts[0].map((i, idx) => (
              <View key={idx} style={styles.row} wrap>
                <Text style={[styles.td, { flex: 0.9 }]}>{severityLabel(i.severity)}</Text>
                <Text style={[styles.td, { flex: 0.9 }]}>{safe(i.category, 80)}</Text>
                <Text
                  style={[
                    styles.td,
                    { flex: 2 },
                    i.severity === "critical" ? styles.critical : styles.warning,
                  ]}
                >
                  {safe(i.message, 500)}
                </Text>
                <Text style={[styles.td, { flex: 1.8 }]}>{safe(i.suggestion, 400)}</Text>
              </View>
            ))}
          </View>
        ) : (
          <Text>本次未发现严重或警告级别问题。</Text>
        )}
        <Text style={styles.footer} fixed>
          由 SEO 分析器生成 · 报告 ID {data.analysisId}
        </Text>
      </Page>

      {issueParts.slice(1).map((rows, pIdx) => (
        <Page key={`issues-${pIdx}`} size="A4" style={styles.page}>
          <Text style={styles.h2}>问题（续）</Text>
          <View>
            <View style={[styles.row, { borderBottomWidth: 0 }]}>
              <Text style={[styles.th, { flex: 0.9 }]}>级别</Text>
              <Text style={[styles.th, { flex: 0.9 }]}>类别</Text>
              <Text style={[styles.th, { flex: 2 }]}>问题</Text>
              <Text style={[styles.th, { flex: 1.8 }]}>建议</Text>
            </View>
            {rows.map((i, idx) => (
              <View key={idx} style={styles.row} wrap>
                <Text style={[styles.td, { flex: 0.9 }]}>{severityLabel(i.severity)}</Text>
                <Text style={[styles.td, { flex: 0.9 }]}>{safe(i.category, 80)}</Text>
                <Text
                  style={[
                    styles.td,
                    { flex: 2 },
                    i.severity === "critical" ? styles.critical : styles.warning,
                  ]}
                >
                  {safe(i.message, 500)}
                </Text>
                <Text style={[styles.td, { flex: 1.8 }]}>{safe(i.suggestion, 400)}</Text>
              </View>
            ))}
          </View>
          <Text style={styles.footer} fixed>
            由 SEO 分析器生成 · 报告 ID {data.analysisId}
          </Text>
        </Page>
      ))}

      {pageParts.map((rows, pIdx) => (
        <Page key={`pages-${pIdx}`} size="A4" style={styles.page}>
          <Text style={styles.h2}>
            页面明细 {pageParts.length > 1 ? `（${pIdx + 1}/${pageParts.length}）` : ""}
          </Text>
          <View>
            <View style={[styles.row, { borderBottomWidth: 0 }]}>
              <Text style={[styles.th, { flex: 2.4 }]}>URL</Text>
              <Text style={[styles.th, styles.tdNarrow]}>状态</Text>
              <Text style={[styles.th, { flex: 1.2 }]}>标题</Text>
              <Text style={[styles.th, styles.tdNarrow]}>毫秒</Text>
              <Text style={[styles.th, styles.tdNarrow]}>字数</Text>
              <Text style={[styles.th, styles.tdNarrow]}>移动</Text>
              <Text style={[styles.th, styles.tdNarrow]}>性能</Text>
            </View>
            {rows.map((pg, idx) => (
              <View key={idx} style={styles.row} wrap>
                <Text style={[styles.td, { flex: 2.4 }]}>{safe(pg.url, 280)}</Text>
                <Text style={[styles.td, styles.tdNarrow]}>{pg.statusCode ?? "—"}</Text>
                <Text style={[styles.td, { flex: 1.2 }]}>{safe(pg.title, 120) || "—"}</Text>
                <Text style={[styles.td, styles.tdNarrow]}>{pg.loadTimeMs ?? "—"}</Text>
                <Text style={[styles.td, styles.tdNarrow]}>{pg.wordCount}</Text>
                <Text style={[styles.td, styles.tdNarrow]}>{pg.isMobileFriendly ? "是" : "否"}</Text>
                <Text style={[styles.td, styles.tdNarrow]}>
                  {pg.performanceScore != null ? String(Math.round(pg.performanceScore)) : "—"}
                </Text>
              </View>
            ))}
          </View>
          <Text style={styles.footer} fixed>
            由 SEO 分析器生成 · 报告 ID {data.analysisId}
          </Text>
        </Page>
      ))}

      {kwParts.map((rows, pIdx) => (
        <Page key={`kw-${pIdx}`} size="A4" style={styles.page}>
          <Text style={styles.h2}>
            关键词 {kwParts.length > 1 ? `（${pIdx + 1}/${kwParts.length}）` : ""}
          </Text>
          <View>
            <View style={[styles.row, { borderBottomWidth: 0 }]}>
              <Text style={[styles.th, { flex: 2 }]}>关键词</Text>
              <Text style={[styles.th, styles.tdNarrow]}>次数</Text>
              <Text style={[styles.th, styles.tdNarrow]}>%</Text>
              <Text style={[styles.th, { flex: 1 }]}>风险</Text>
            </View>
            {rows.map((k, idx) => (
              <View key={idx} style={styles.row} wrap>
                <Text style={[styles.td, { flex: 2 }]}>{safe(k.keyword, 200)}</Text>
                <Text style={[styles.td, styles.tdNarrow]}>{k.count}</Text>
                <Text style={[styles.td, styles.tdNarrow]}>{k.density.toFixed(2)}</Text>
                <Text style={[styles.td, { flex: 1 }, k.isStuffing ? styles.stuffing : {}]}>
                  {k.isStuffing ? "堆砌风险" : "正常"}
                </Text>
              </View>
            ))}
          </View>
          <Text style={styles.footer} fixed>
            由 SEO 分析器生成 · 报告 ID {data.analysisId}
          </Text>
        </Page>
      ))}
    </Document>
  );
}
