"use client";

import { useMemo } from "react";
import Link from "next/link";
import AuthGuard from "@/components/AuthGuard";
import { useOrders } from "@/hooks/useOrders";
import type { Order } from "@/lib/api";

function sortByIssued(orders: Order[]): Order[] {
  return [...orders].sort((a, b) => a.id - b.id);
}

function DisplayInner() {
  // お呼び出し = 呼び出し中。準備中 = 会計完了(調理前/中) + 準備完了(調理済み・未呼び出し)。
  const paid = useOrders({ status: "会計完了" });
  const ready = useOrders({ status: "準備完了" });
  const calling = useOrders({ status: "呼び出し中" });

  const callingOrders = useMemo(
    () => sortByIssued(calling.orders),
    [calling.orders],
  );
  const preparingOrders = useMemo(
    () => sortByIssued([...paid.orders, ...ready.orders]),
    [paid.orders, ready.orders],
  );

  const hasError = Boolean(paid.error || ready.error || calling.error);
  const anyLoading = paid.loading || ready.loading || calling.loading;

  return (
    <main className="relative flex flex-1 flex-col gap-6 p-6 lg:flex-row">
      <Link
        href="/select"
        className="absolute right-2 top-2 text-xs underline opacity-30 hover:opacity-70"
      >
        画面選択
      </Link>

      {hasError && (
        <p
          role="status"
          aria-live="polite"
          className="absolute inset-x-0 top-0 mx-auto w-fit rounded-b-lg bg-red-600 px-4 py-1.5 text-sm text-white"
        >
          ⚠ 情報の取得に失敗しています。スタッフにお知らせください。
        </p>
      )}

      {/* お呼び出し（大きく強調） */}
      <section className="flex flex-1 flex-col gap-4 rounded-2xl border-2 border-green-600/60 bg-green-50/40 p-6 dark:bg-green-950/20">
        <h2 className="text-center text-2xl font-bold text-green-700 dark:text-green-400">
          お呼び出し中の番号（お受け取りください）
        </h2>
        {callingOrders.length === 0 && anyLoading ? (
          <p className="flex flex-1 items-center justify-center text-lg opacity-50">
            読み込み中…
          </p>
        ) : callingOrders.length === 0 && !hasError ? (
          <p className="flex flex-1 items-center justify-center text-lg opacity-50">
            現在ありません
          </p>
        ) : callingOrders.length === 0 ? null : (
          <div className="flex flex-wrap content-start justify-center gap-4">
            {callingOrders.map((o) => (
              <span
                key={o.id}
                className="min-w-[120px] animate-pulse rounded-xl bg-green-600 px-4 py-3 text-center text-[64px] font-bold leading-none tabular-nums text-white"
              >
                {o.number}
              </span>
            ))}
          </div>
        )}
      </section>

      {/* 準備中（控えめ） */}
      <section className="flex flex-col gap-4 rounded-2xl border border-black/15 p-6 dark:border-white/20 lg:w-[38%]">
        <h2 className="text-center text-xl font-semibold opacity-70">準備中</h2>
        {preparingOrders.length === 0 && anyLoading ? (
          <p className="flex flex-1 items-center justify-center text-lg opacity-40">
            読み込み中…
          </p>
        ) : preparingOrders.length === 0 && !hasError ? (
          <p className="flex flex-1 items-center justify-center text-lg opacity-40">
            現在ありません
          </p>
        ) : preparingOrders.length === 0 ? null : (
          <div className="flex flex-wrap content-start justify-center gap-3">
            {preparingOrders.map((o) => (
              <span
                key={o.id}
                className="min-w-[88px] rounded-lg border border-black/15 px-3 py-2 text-center text-[40px] font-bold leading-none tabular-nums opacity-70 dark:border-white/20"
              >
                {o.number}
              </span>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

export default function DisplayPage() {
  return (
    <AuthGuard>
      <DisplayInner />
    </AuthGuard>
  );
}
