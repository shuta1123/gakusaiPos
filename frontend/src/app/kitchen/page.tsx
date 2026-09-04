"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import Link from "next/link";
import AuthGuard from "@/components/AuthGuard";
import { useOrders } from "@/hooks/useOrders";
import { orderApi, type Order } from "@/lib/api";

const HISTORY_LIMIT = 30; // 履歴に表示する直近件数

function itemSummary(order: Order): string {
  return (
    order.items
      ?.filter((i) => i.quantity > 0)
      .map((i) => `${i.product?.name ?? `#${i.product_id}`}×${i.quantity}`)
      .join("・") ?? ""
  );
}

function KitchenInner() {
  // 準備完了（＝受け渡し待ち）を受け渡し完了へ。受け渡し済みは履歴として表示。
  const ready = useOrders({ status: "準備完了" });
  const done = useOrders({ status: "受け渡し完了" });
  // 参照が安定した refresh を取り出しておく（useCallback 依存の安定化）。
  const readyRefresh = ready.refresh;
  const doneRefresh = done.refresh;

  const [handedIds, setHandedIds] = useState<Set<number>>(new Set());
  const handedRef = useRef<Set<number>>(new Set());
  const inFlightRef = useRef<Set<number>>(new Set());
  const [pending, setPending] = useState<Set<number>>(new Set());
  const [actionError, setActionError] = useState<string | null>(null);

  // 受け渡し済み（反映待ち）を楽観的に除外。
  const waiting = useMemo(
    () => ready.orders.filter((o) => !handedIds.has(o.id)),
    [ready.orders, handedIds],
  );

  const history = useMemo(
    () => [...done.orders].slice(-HISTORY_LIMIT).reverse(),
    [done.orders],
  );

  const handoff = useCallback(
    async (order: Order) => {
      if (inFlightRef.current.has(order.id) || handedRef.current.has(order.id)) {
        return;
      }
      inFlightRef.current.add(order.id);
      setPending(new Set(inFlightRef.current));
      try {
        setActionError(null);
        await orderApi.updateStatus(order.id, "受け渡し完了");
        handedRef.current.add(order.id);
        setHandedIds(new Set(handedRef.current));
        readyRefresh();
        doneRefresh();
      } catch (err) {
        setActionError(
          `注文${order.number}の受け渡しに失敗しました: ${
            err instanceof Error ? err.message : "不明なエラー"
          }`,
        );
      } finally {
        inFlightRef.current.delete(order.id);
        setPending(new Set(inFlightRef.current));
      }
    },
    [readyRefresh, doneRefresh],
  );

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-4 p-4">
      <header className="flex items-center justify-between">
        <h1 className="text-xl font-bold">受け渡し（管理）</h1>
        <Link href="/select" className="text-sm underline opacity-70">
          画面選択へ
        </Link>
      </header>

      {(ready.error || done.error || actionError) && (
        <p
          role="alert"
          aria-live="polite"
          className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40"
        >
          {actionError ?? ready.error ?? done.error}
        </p>
      )}

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold opacity-70">
          受け渡し待ち（{waiting.length}）
        </h2>
        {ready.loading && waiting.length === 0 ? (
          <p className="p-8 text-center text-sm opacity-60">読み込み中…</p>
        ) : waiting.length === 0 ? (
          <p className="p-8 text-center text-sm opacity-60">
            受け渡し待ちの注文はありません
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {waiting.map((order) => (
              <button
                key={order.id}
                type="button"
                onClick={() => handoff(order)}
                disabled={pending.has(order.id)}
                aria-label={`注文 ${order.number} を受け渡し完了`}
                className="flex flex-col items-start gap-1 rounded-xl border border-black/15 p-3 text-left transition hover:bg-black/5 disabled:opacity-40 dark:border-white/20 dark:hover:bg-white/10"
              >
                <span className="text-[40px] font-bold leading-none tabular-nums">
                  {order.number}
                </span>
                <span className="text-xs opacity-70">{itemSummary(order)}</span>
                <span className="mt-1 text-xs font-medium opacity-90">
                  タップで受け渡し完了
                </span>
              </button>
            ))}
          </div>
        )}
      </section>

      <section className="mt-2 flex flex-col gap-2">
        <h2 className="text-sm font-semibold opacity-70">
          受け渡し済み（直近{history.length}件）
        </h2>
        {history.length === 0 ? (
          <p className="text-sm opacity-50">まだありません</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {history.map((order) => (
              <span
                key={order.id}
                className="rounded-full border border-black/10 px-3 py-1 text-sm tabular-nums opacity-60 dark:border-white/15"
              >
                {order.number}
              </span>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

export default function KitchenPage() {
  return (
    <AuthGuard>
      <KitchenInner />
    </AuthGuard>
  );
}
