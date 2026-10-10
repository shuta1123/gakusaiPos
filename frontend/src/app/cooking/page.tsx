"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import AuthGuard from "@/components/AuthGuard";
import { useOrders } from "@/hooks/useOrders";
import { useProducts } from "@/hooks/useProducts";
import { orderApi, type Order } from "@/lib/api";

const CHUNK_SIZE = 10; // 10件超で次の段（テーブル）へ折り返す

function qtyOf(order: Order, productId: number): number {
  const item = order.items?.find((i) => i.product_id === productId);
  return item?.quantity ?? 0;
}

function CookingInner() {
  // 会計完了（調理中）＋準備完了（調理済）を表示。呼び出し中になると自動で消える。
  const paid = useOrders({ status: "会計完了" });
  const ready = useOrders({ status: "準備完了" });
  const { products } = useProducts();
  const paidRefresh = paid.refresh;
  const readyRefresh = ready.refresh;

  const [completing, setCompleting] = useState<Set<number>>(new Set());
  const [actionError, setActionError] = useState<string | null>(null);

  // 二重送信防止（同期チェック用 ref ＋ 再描画用 state）。
  const inFlightRef = useRef<Set<number>>(new Set());
  const completedRef = useRef<Set<number>>(new Set()); // 調理済にした（反映待ち含む）
  const [completedIds, setCompletedIds] = useState<Set<number>>(new Set());

  // 会計完了＋準備完了を番号順に統合。
  const displayedOrders = useMemo(() => {
    const map = new Map<number, Order>();
    [...paid.orders, ...ready.orders].forEach((o) => map.set(o.id, o));
    return [...map.values()].sort((a, b) => a.id - b.id);
  }, [paid.orders, ready.orders]);

  const isCooked = useCallback(
    (o: Order) => o.status === "準備完了" || completedIds.has(o.id),
    [completedIds],
  );

  // 品目行は常に全表示する（0の行も隠さない）。
  const visibleProducts = products;

  // 調理済にする（会計完了 → 準備完了）。調理済の注文には何もしない。
  const complete = useCallback(
    async (order: Order | undefined) => {
      if (
        !order ||
        order.status === "準備完了" ||
        inFlightRef.current.has(order.id) ||
        completedRef.current.has(order.id)
      )
        return;
      inFlightRef.current.add(order.id);
      setCompleting(new Set(inFlightRef.current));
      try {
        setActionError(null);
        await orderApi.updateStatus(order.id, "準備完了");
        completedRef.current.add(order.id);
        setCompletedIds(new Set(completedRef.current));
        paidRefresh();
        readyRefresh();
      } catch (err) {
        setActionError(
          `注文${order.number}の処理に失敗しました: ${
            err instanceof Error ? err.message : "不明なエラー"
          }`,
        );
      } finally {
        inFlightRef.current.delete(order.id);
        setCompleting(new Set(inFlightRef.current));
      }
    },
    [paidRefresh, readyRefresh],
  );

  // 調理中（未調理）の先頭。スペースキーの対象。
  const firstUncooked = useMemo(
    () => displayedOrders.find((o) => !isCooked(o)),
    [displayedOrders, isCooked],
  );

  const firstRef = useRef(firstUncooked);
  useEffect(() => {
    firstRef.current = firstUncooked;
  }, [firstUncooked]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== "Space" && e.key !== " ") return;
      const active = document.activeElement;
      if (active && active !== document.body) return;
      e.preventDefault();
      complete(firstRef.current);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [complete]);

  const chunks = useMemo(() => {
    const result: Order[][] = [];
    for (let i = 0; i < displayedOrders.length; i += CHUNK_SIZE) {
      result.push(displayedOrders.slice(i, i + CHUNK_SIZE));
    }
    return result;
  }, [displayedOrders]);

  const error = paid.error || ready.error;
  const loading = paid.loading || ready.loading;

  return (
    <main className="flex flex-1 flex-col gap-4 p-4">
      <header className="flex items-center justify-between">
        <h1 className="text-xl font-bold">
          調理担当{" "}
          <span className="text-sm font-normal opacity-60">
            スペース／番号タップで調理済に（呼び出されると消えます）
          </span>
        </h1>
        <Link href="/select" className="text-sm underline opacity-70">
          画面選択へ
        </Link>
      </header>

      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40">
          {error}
        </p>
      )}
      {actionError && (
        <p
          role="alert"
          aria-live="polite"
          className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40"
        >
          {actionError}
        </p>
      )}

      {loading && displayedOrders.length === 0 ? (
        <p className="p-8 text-center text-sm opacity-60">読み込み中…</p>
      ) : displayedOrders.length === 0 ? (
        <p className="p-8 text-center text-sm opacity-60">
          調理待ちの注文はありません
        </p>
      ) : (
        <div className="flex flex-col gap-6">
          {chunks.map((chunk) => (
            <table key={chunk[0].id} className="border-collapse">
              <thead>
                <tr>
                  <th className="bg-transparent" />
                  {chunk.map((order) => {
                    const cooked = isCooked(order);
                    const isHead = order.id === firstUncooked?.id;
                    return (
                      <th
                        key={order.id}
                        className={`w-[72px] border border-black/15 p-0 align-top dark:border-white/20 ${
                          isHead ? "bg-black/10 dark:bg-white/15" : ""
                        } ${cooked ? "bg-blue-50/50 dark:bg-blue-950/25" : ""}`}
                      >
                        <button
                          type="button"
                          onClick={() => complete(order)}
                          disabled={cooked || completing.has(order.id)}
                          aria-label={`注文 ${order.number} を調理済にする`}
                          className={`block w-full p-1 text-left leading-none disabled:cursor-default ${
                            completing.has(order.id) ? "opacity-40" : ""
                          }`}
                          title={cooked ? "調理済" : "タップで調理済に"}
                        >
                          <span
                            className={`text-[32px] font-bold tabular-nums ${
                              cooked ? "text-blue-600 opacity-70 dark:text-blue-400" : ""
                            }`}
                          >
                            {order.number}
                          </span>
                          {cooked && (
                            <span className="block text-[10px] font-medium text-blue-600 dark:text-blue-400">
                              ✓調理済
                            </span>
                          )}
                        </button>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {visibleProducts.map((p) => (
                  <tr key={p.id}>
                    <td className="whitespace-nowrap border border-black/15 p-1 pr-3 text-left text-sm dark:border-white/20">
                      {p.name}
                    </td>
                    {chunk.map((order) => {
                      const q = qtyOf(order, p.id);
                      const cooked = isCooked(order);
                      return (
                        <td
                          key={order.id}
                          className={`w-[72px] border border-black/15 p-1 text-left text-[32px] leading-none tabular-nums dark:border-white/20 ${
                            q === 0 ? "opacity-30" : cooked ? "opacity-40" : ""
                          }`}
                        >
                          {q}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          ))}
        </div>
      )}
    </main>
  );
}

export default function CookingPage() {
  return (
    <AuthGuard>
      <CookingInner />
    </AuthGuard>
  );
}
