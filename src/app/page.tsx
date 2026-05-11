import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-[calc(100vh-4rem)]">
      <section className="bg-slate-900 text-white py-20 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-4xl md:text-6xl font-bold mb-6">
            分析并优化你的
            <span className="text-emerald-400"> 网站 SEO</span>
          </h1>
          <p className="text-lg md:text-xl text-slate-300 mb-10 max-w-2xl mx-auto">
            自动抓取页面、发现 SEO 问题、统计关键词密度、查看得分趋势，并导出 PDF
            报告——功能集中在一个控制台。
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/auth/register"
              className="bg-emerald-500 hover:bg-emerald-600 text-white px-8 py-3 rounded-xl text-lg font-semibold transition-colors"
            >
              免费开始分析
            </Link>
            <Link
              href="/auth/login"
              className="border border-slate-500 hover:border-emerald-400 text-white px-8 py-3 rounded-xl text-lg font-semibold transition-colors"
            >
              登录
            </Link>
          </div>
        </div>
      </section>

      <section className="py-20 px-4">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-12">
            全面的 SEO 分析报告
          </h2>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                title: "站点抓取",
                desc: "可配置抓取深度，自动提取标题、meta、各级标题、图片与链接。",
                icon: "🔍",
              },
              {
                title: "SEO 打分",
                desc: "0–100 分综合得分，并按优先级列出缺失标题、死链、加载过慢等问题。",
                icon: "📊",
              },
              {
                title: "关键词分析",
                desc: "提取核心词、计算词频密度，并提示疑似关键词堆砌风险。",
                icon: "🔑",
              },
              {
                title: "链接检测",
                desc: "发现失效链接，统计内链/外链分布与响应状态码。",
                icon: "🔗",
              },
              {
                title: "趋势监控",
                desc: "用图表跟踪多次分析的得分变化，便于对比优化效果。",
                icon: "📈",
              },
              {
                title: "PDF 报告",
                desc: "一键导出专业版 PDF，方便团队协作或向客户交付。",
                icon: "📄",
              },
            ].map((feature) => (
              <div
                key={feature.title}
                className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 hover:shadow-md transition-shadow"
              >
                <div className="text-3xl mb-4">{feature.icon}</div>
                <h3 className="text-xl font-semibold mb-2">{feature.title}</h3>
                <p className="text-slate-600">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <footer className="bg-slate-900 text-slate-400 py-8 px-4 text-center text-sm">
        <p>SEO 分析平台 &copy; {new Date().getFullYear()}</p>
      </footer>
    </div>
  );
}
