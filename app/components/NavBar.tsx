"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { clearAdminSession, isLoggedIn } from "@/lib/auth";
import { useEffect, useState } from "react";

export default function NavBar() {
  const pathname = usePathname();
  const router = useRouter();
  const [loggedIn, setLoggedIn] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    setLoggedIn(isLoggedIn());
    setMobileOpen(false);
  }, [pathname]);

  if (pathname === "/login" || !loggedIn) return null;

  function handleLogout() {
    clearAdminSession();
    router.push("/login");
  }

  const links = [
    { href: "/admin", label: "Dashboard" },
    { href: "/teams", label: "Teams" },
    { href: "/quiz", label: "Quiz" },
  ];

  return (
    <nav className="bg-white border-b border-slate-200 sticky top-0 z-40">
      <div className="max-w-5xl mx-auto px-4 sm:px-6">
        <div className="flex justify-between items-center h-14 gap-2">
          {/* Desktop links */}
          <div className="hidden sm:flex items-center gap-1">
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className={`text-sm font-medium px-3 py-2 rounded-lg transition whitespace-nowrap ${
                  pathname === l.href
                    ? "bg-slate-900 text-white"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                }`}
              >
                {l.label}
              </Link>
            ))}
          </div>

          {/* Mobile brand/spacer */}
          <span className="sm:hidden text-sm font-semibold text-slate-900">
            {links.find((l) => l.href === pathname)?.label ?? "Menu"}
          </span>

          {/* Desktop logout */}
          <button
            onClick={handleLogout}
            className="hidden sm:block text-sm font-medium text-red-600 hover:text-red-700 px-3 py-2 rounded-lg hover:bg-red-50 transition shrink-0"
          >
            Logout
          </button>

          {/* Mobile menu toggle */}
          <button
            onClick={() => setMobileOpen((v) => !v)}
            className="sm:hidden p-2 -mr-2 text-slate-600 hover:text-slate-900"
            aria-label="Toggle menu"
            aria-expanded={mobileOpen}
          >
            {mobileOpen ? (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            ) : (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </svg>
            )}
          </button>
        </div>

        {/* Mobile dropdown panel */}
        {mobileOpen && (
          <div className="sm:hidden pb-4 pt-1 space-y-1 border-t border-slate-100">
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className={`block text-sm font-medium px-3 py-2.5 rounded-lg transition ${
                  pathname === l.href
                    ? "bg-slate-900 text-white"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                }`}
              >
                {l.label}
              </Link>
            ))}
            <button
              onClick={handleLogout}
              className="w-full text-left text-sm font-medium text-red-600 hover:text-red-700 px-3 py-2.5 rounded-lg hover:bg-red-50 transition"
            >
              Logout
            </button>
          </div>
        )}
      </div>
    </nav>
  );
}