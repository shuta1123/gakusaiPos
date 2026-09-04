"use client";

import { useMemo } from "react";
import Link from "next/link";
import AuthGuard from "@/components/AuthGuard";
import { useOrders } from "@/hooks/useOrders";

function sortedNumbers(orders: { id: number; number: number }[]): number[] {
  return [...orders].sort((a, b) => a.id - b.id).map((o) => o.number);
}

function DisplayInner() {
  // 準備中＝会計完了（調理中）、受け取り可能＝準備完了。
  const preparing = useOrders({ status: "会計完了" });
  const ready = useOrders({ status: "準備完了" });

  const preparingNumbers = useMemo(
    () => sortedNumbers(preparing.orders),
    [preparing.orders],
  );
  const readyNumbers = useMemo(
    () => sortedNumbers(ready.orders),
    [ready.orders],
  );

  return (
    <main className="relative flex flex-1 flex-col gap-6 p-6 lg:flex-row">
      {/* スタッフ用の控えめな戻りリンク */}
      <Link
        href="/select"
        className="absolute right-2 top-2 text-xs underline opacity-30 hover:opacity-70"
      >
        画面選択
      </Link>
      {/* 受け取り可能（大きく強調） */}
      <section className="flex flex-1 flex-col gap-4 rounded-2xl border-2 border-green-600/60 bg-green-50/40 p-6 dark:bg-green-950/20">
        <h2 className="text-center text-2xl font-bold text-green-700 dark:text-green-400">
          受け取りをお待ちの番号
        </h2>
        {readyNumbers.length === 0 ? (
          <p className="flex flex-1 items-center justify-center text-lg opacity-50">
            現在ありません
          </p>
        ) : (
          <div className="flex flex-wrap content-start justify-center gap-4">
            {readyNumbers.map((n) => (
              <span
                key={n}
                className="min-w-[120px] rounded-xl bg-green-600 px-4 py-3 text-center text-[64px] font-bold leading-none tabular-nums text-white"
              >
                {n}
              </span>
            ))}
          </div>
        )}
      </section>

      {/* 準備中（控えめ） */}
      <section className="flex flex-col gap-4 rounded-2xl border border-black/15 p-6 dark:border-white/20 lg:w-[38%]">
        <h2 className="text-center text-xl font-semibold opacity-70">
          準備中
        </h2>
        {preparingNumbers.length === 0 ? (
          <p className="flex flex-1 items-center justify-center text-lg opacity-40">
            現在ありません
          </p>
        ) : (
          <div className="flex flex-wrap content-start justify-center gap-3">
            {preparingNumbers.map((n) => (
              <span
                key={n}
                className="min-w-[88px] rounded-lg border border-black/15 px-3 py-2 text-center text-[40px] font-bold leading-none tabular-nums opacity-70 dark:border-white/20"
              >
                {n}
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
