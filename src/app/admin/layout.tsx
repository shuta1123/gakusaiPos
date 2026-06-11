"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  const tabs = [
    { label: "商品マスタ", href: "/admin/products" },
    { label: "売上", href: "/admin/sales" },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-0 flex items-center gap-8">
        <h1 className="text-base font-bold text-gray-700 py-4 shrink-0">管理画面</h1>
        <nav className="flex gap-1">
          {tabs.map((tab) => (
            <Link
              key={tab.href}
              href={tab.href}
              className={
                "px-5 py-4 text-sm font-medium border-b-2 transition-colors " +
                (pathname.startsWith(tab.href)
                  ? "border-orange-500 text-orange-600"
                  : "border-transparent text-gray-500 hover:text-gray-800")
              }
            >
              {tab.label}
            </Link>
          ))}
        </nav>
      </header>
      <main className="p-6">{children}</main>
    </div>
  );
}
