import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-[calc(100vh-4rem)]">
      <section className="bg-slate-900 text-white py-20 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-4xl md:text-6xl font-bold mb-6">
            Analyze &amp; Optimize Your
            <span className="text-emerald-400"> SEO Performance</span>
          </h1>
          <p className="text-lg md:text-xl text-slate-300 mb-10 max-w-2xl mx-auto">
            Crawl your website, identify SEO issues, track keyword density,
            monitor score trends, and get actionable recommendations — all in one platform.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/auth/register"
              className="bg-emerald-500 hover:bg-emerald-600 text-white px-8 py-3 rounded-xl text-lg font-semibold transition-colors"
            >
              Start Free Analysis
            </Link>
            <Link
              href="/auth/login"
              className="border border-slate-500 hover:border-emerald-400 text-white px-8 py-3 rounded-xl text-lg font-semibold transition-colors"
            >
              Sign In
            </Link>
          </div>
        </div>
      </section>

      <section className="py-20 px-4">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-12">
            Comprehensive SEO Analysis
          </h2>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                title: "Site Crawling",
                desc: "Automatically crawl pages with configurable depth. Extract titles, meta tags, headings, images, and links.",
                icon: "🔍",
              },
              {
                title: "SEO Scoring",
                desc: "Get a 0-100 score with prioritized issues. Identify critical problems like missing titles, broken links, and slow pages.",
                icon: "📊",
              },
              {
                title: "Keyword Analysis",
                desc: "Extract core keywords, calculate density, and detect keyword stuffing risks across your pages.",
                icon: "🔑",
              },
              {
                title: "Link Checker",
                desc: "Find broken links, analyze internal/external link distribution, and check response codes.",
                icon: "🔗",
              },
              {
                title: "Trend Monitoring",
                desc: "Track your SEO score over time with visual charts. Compare multiple analyses side by side.",
                icon: "📈",
              },
              {
                title: "PDF Reports",
                desc: "Export comprehensive analysis results as professional PDF reports for your team or clients.",
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
        <p>SEO Analyzer Platform &copy; {new Date().getFullYear()}</p>
      </footer>
    </div>
  );
}
