"use client";

import Link from "next/link";
import { useSession, signOut } from "next-auth/react";
import { useState } from "react";

export function Navbar() {
  const { data: session } = useSession();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <nav className="bg-slate-900 text-white shadow-lg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 items-center">
          <Link href="/" className="flex items-center gap-2 font-bold text-xl">
            <span className="text-emerald-400 text-2xl">&#9776;</span>
            <span>SEO 分析器</span>
          </Link>

          {session ? (
            <>
              <div className="hidden md:flex items-center gap-6">
                <Link
                  href="/dashboard"
                  className="hover:text-emerald-400 transition-colors"
                >
                  控制台
                </Link>
                <span className="text-slate-400 text-sm">
                  {session.user?.email}
                </span>
                <button
                  onClick={() => signOut({ callbackUrl: "/" })}
                  className="bg-slate-700 hover:bg-slate-600 px-4 py-2 rounded-lg text-sm transition-colors"
                >
                  退出登录
                </button>
              </div>
              <button
                type="button"
                className="md:hidden"
                aria-label={menuOpen ? "关闭菜单" : "打开菜单"}
                onClick={() => setMenuOpen(!menuOpen)}
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={menuOpen ? "M6 18L18 6M6 6l12 12" : "M4 6h16M4 12h16M4 18h16"} />
                </svg>
              </button>
            </>
          ) : (
            <div className="flex items-center gap-4">
              <Link
                href="/auth/login"
                className="hover:text-emerald-400 transition-colors"
              >
                登录
              </Link>
              <Link
                href="/auth/register"
                className="bg-emerald-500 hover:bg-emerald-600 px-4 py-2 rounded-lg text-sm transition-colors"
              >
                注册
              </Link>
            </div>
          )}
        </div>

        {menuOpen && session && (
          <div className="md:hidden pb-4 space-y-2">
            <Link
              href="/dashboard"
              className="block hover:text-emerald-400 transition-colors py-1"
              onClick={() => setMenuOpen(false)}
            >
              控制台
            </Link>
            <button
              type="button"
              onClick={() => signOut({ callbackUrl: "/" })}
              className="block text-slate-400 hover:text-white transition-colors py-1"
            >
              退出登录
            </button>
          </div>
        )}
      </div>
    </nav>
  );
}
