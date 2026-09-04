"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import AuthGuard from "@/components/AuthGuard";
import { authApi } from "@/lib/api";
import { clearToken } from "@/lib/auth";

const screens: { href: string; label: string }[] = [
  { href: "/cashier?register=会計1", label: "会計1" },
  { href: "/cashier?register=会計2", label: "会計2" },
  { href: "/cooking", label: "調理担当" },
  { href: "/kitchen", label: "受け渡し（管理）" },
  { href: "/display", label: "受け渡し（客向け）" },
];

export default function SelectPage() {
  const router = useRouter();

  async function handleLogout() {
    try {
      await authApi.logout();
    } catch {
      /* サーバー側はステートレスなので失敗しても続行 */
    }
    clearToken();
    router.replace("/login");
  }

  return (
    <AuthGuard>
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center gap-6 p-8">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">画面選択</h1>
          <button
            type="button"
            onClick={handleLogout}
            className="rounded-lg border border-black/15 px-3 py-1.5 text-sm hover:bg-black/5 dark:border-white/20 dark:hover:bg-white/10"
          >
            ログアウト
          </button>
        </div>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          {screens.map((s) => (
            <Link
              key={s.label}
              href={s.href}
              className="flex aspect-square items-center justify-center rounded-xl border border-black/15 p-4 text-center font-medium hover:bg-black/5 dark:border-white/20 dark:hover:bg-white/10"
            >
              {s.label}
            </Link>
          ))}
        </div>
      </main>
    </AuthGuard>
  );
}
