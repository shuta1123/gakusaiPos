"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import AuthGuard from "@/components/AuthGuard";
import { statsApi, type Stats } from "@/lib/api";
import { formatYen } from "@/lib/format";

const REFRESH_MS = 10000;

function StatsInner() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [loading, setLoading] = useState(true);

  const aliveRef = useRef(true);
  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
    };
  }, []);

  const fetchStats = useCallback(async () => {
    try {
      const data = await statsApi.summary();
      if (!aliveRef.current) return;
      setStats(data);
      setUpdatedAt(new Date());
      setError(null);
    } catch (e) {
      if (!aliveRef.current) return;
      setError(e instanceof Error ? e.message : "取得に失敗しました");
    } finally {
      if (aliveRef.current) setLoading(false);
    }
  }, []);

  // 最新の fetchStats を ref 経由で参照し、effect の再実行を避ける。
  const fetchRef = useRef(fetchStats);
  useEffect(() => {
    fetchRef.current = fetchStats;
  }, [fetchStats]);
  useEffect(() => {
    fetchRef.current();
    const t = setInterval(() => fetchRef.current(), REFRESH_MS);
    return () => clearInterval(t);
  }, []);

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-5 p-4 sm:p-6">
      <header className="flex items-center justify-between gap-2">
        <h1 className="text-xl font-bold">集計</h1>
        <div className="flex items-center gap-3 text-sm">
          {updatedAt && (
            <span className="opacity-50">
              {updatedAt.toLocaleTimeString("ja-JP")} 時点
            </span>
          )}
          <button
            type="button"
            onClick={fetchStats}
            className="rounded-lg border border-black/20 px-3 py-1.5 dark:border-white/25"
          >
            更新
          </button>
          <Link href="/select" className="underline opacity-70">
            画面選択へ
          </Link>
        </div>
      </header>

      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40">
          {error}
        </p>
      )}

      {loading && !stats ? (
        <p className="p-8 text-center text-sm opacity-60">読み込み中…</p>
      ) : stats ? (
        <>
          {/* サマリカード */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-black/15 p-5 dark:border-white/20">
              <p className="text-sm opacity-60">売上合計</p>
              <p className="mt-1 text-4xl font-bold tabular-nums">
                {formatYen(stats.total_sales)}
              </p>
            </div>
            <div className="rounded-2xl border border-black/15 p-5 dark:border-white/20">
              <p className="text-sm opacity-60">注文数</p>
              <p className="mt-1 text-4xl font-bold tabular-nums">
                {stats.order_count}
                <span className="ml-1 text-lg opacity-60">件</span>
              </p>
            </div>
            <div className="rounded-2xl border border-black/15 p-5 dark:border-white/20">
              <p className="text-sm opacity-60">割引合計</p>
              <p className="mt-1 text-4xl font-bold tabular-nums">
                {formatYen(stats.total_discount)}
              </p>
            </div>
          </div>

          {/* レジ別 */}
          <section className="flex flex-col gap-2">
            <h2 className="text-sm font-semibold opacity-70">レジ別</h2>
            <div className="overflow-hidden rounded-2xl border border-black/15 dark:border-white/20">
              <table className="w-full text-sm">
                <thead className="bg-black/5 dark:bg-white/10">
                  <tr>
                    <th className="p-3 text-left font-medium">レジ</th>
                    <th className="p-3 text-right font-medium">件数</th>
                    <th className="p-3 text-right font-medium">売上</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(stats.by_source).map(([source, v]) => (
                    <tr
                      key={source}
                      className="border-t border-black/10 dark:border-white/15"
                    >
                      <td className="p-3">{source}</td>
                      <td className="p-3 text-right tabular-nums">{v.count}</td>
                      <td className="p-3 text-right tabular-nums">
                        {formatYen(v.sales)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* 商品別 */}
          <section className="flex flex-col gap-2">
            <h2 className="text-sm font-semibold opacity-70">商品別（販売数順）</h2>
            <div className="overflow-hidden rounded-2xl border border-black/15 dark:border-white/20">
              <table className="w-full text-sm">
                <thead className="bg-black/5 dark:bg-white/10">
                  <tr>
                    <th className="p-3 text-left font-medium">商品</th>
                    <th className="p-3 text-right font-medium">販売数</th>
                    <th className="p-3 text-right font-medium">売上</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.by_product.length === 0 ? (
                    <tr>
                      <td className="p-6 text-center opacity-50" colSpan={3}>
                        まだ売上がありません
                      </td>
                    </tr>
                  ) : (
                    stats.by_product.map((p) => (
                      <tr
                        key={p.name}
                        className="border-t border-black/10 dark:border-white/15"
                      >
                        <td className="p-3">{p.name}</td>
                        <td className="p-3 text-right tabular-nums">{p.units}</td>
                        <td className="p-3 text-right tabular-nums">
                          {formatYen(p.sales)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <p className="text-xs opacity-40">
            ※ キャンセルした注文は集計に含みません。売上合計は割引反映後、商品別の売上は割引前です。
          </p>
        </>
      ) : null}
    </main>
  );
}

export default function StatsPage() {
  return (
    <AuthGuard>
      <StatsInner />
    </AuthGuard>
  );
}
