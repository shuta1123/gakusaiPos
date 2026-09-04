"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import Link from "next/link";
import AuthGuard from "@/components/AuthGuard";
import { useOrders } from "@/hooks/useOrders";
import { orderApi, type Order, type OrderStatus } from "@/lib/api";

function itemSummary(order: Order): string {
  return (
    order.items
      ?.filter((i) => i.quantity > 0)
      .map((i) => `${i.product?.name ?? `#${i.product_id}`}×${i.quantity}`)
      .join("・") ?? ""
  );
}

function KitchenInner() {
  // 受け渡し待ち(準備完了) → 呼び出し中 → 受け渡し完了(非表示)
  const waiting = useOrders({ status: "準備完了" });
  const calling = useOrders({ status: "呼び出し中" });
  const waitingRefresh = waiting.refresh;
  const callingRefresh = calling.refresh;

  // 楽観的除外（反映待ちを即座に隠す）。セクションごとに分ける。
  const calledRef = useRef<Set<number>>(new Set());
  const handedRef = useRef<Set<number>>(new Set());
  const inFlightRef = useRef<Set<number>>(new Set());
  const [calledIds, setCalledIds] = useState<Set<number>>(new Set());
  const [handedIds, setHandedIds] = useState<Set<number>>(new Set());
  const [pending, setPending] = useState<Set<number>>(new Set());
  const [actionError, setActionError] = useState<string | null>(null);

  const displayedWaiting = useMemo(
    () => waiting.orders.filter((o) => !calledIds.has(o.id)),
    [waiting.orders, calledIds],
  );
  const displayedCalling = useMemo(
    () => calling.orders.filter((o) => !handedIds.has(o.id)),
    [calling.orders, handedIds],
  );

  // 指定注文を to ステータスへ進める汎用処理。hidden 判定/記録は関数で受け取り
  // ref を引数に渡さない（render 中の ref アクセスを避ける）。
  const mutate = useCallback(
    async (
      order: Order,
      to: OrderStatus,
      isHidden: (id: number) => boolean,
      markHidden: (id: number) => void,
    ) => {
      if (inFlightRef.current.has(order.id) || isHidden(order.id)) return;
      inFlightRef.current.add(order.id);
      setPending(new Set(inFlightRef.current));
      try {
        setActionError(null);
        await orderApi.updateStatus(order.id, to);
        markHidden(order.id);
        waitingRefresh();
        callingRefresh();
      } catch (err) {
        setActionError(
          `注文${order.number}の処理に失敗しました: ${
            err instanceof Error ? err.message : "不明なエラー"
          }`,
        );
      } finally {
        inFlightRef.current.delete(order.id);
        setPending(new Set(inFlightRef.current));
      }
    },
    [waitingRefresh, callingRefresh],
  );

  const callOrder = useCallback(
    (order: Order) =>
      mutate(
        order,
        "呼び出し中",
        (id) => calledRef.current.has(id),
        (id) => {
          calledRef.current.add(id);
          setCalledIds(new Set(calledRef.current));
        },
      ),
    [mutate],
  );

  const handoffOrder = useCallback(
    (order: Order) =>
      mutate(
        order,
        "受け渡し完了",
        (id) => handedRef.current.has(id),
        (id) => {
          handedRef.current.add(id);
          setHandedIds(new Set(handedRef.current));
        },
      ),
    [mutate],
  );

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-4 p-4">
      <header className="flex items-center justify-between">
        <h1 className="text-xl font-bold">受け渡し（管理）</h1>
        <Link href="/select" className="text-sm underline opacity-70">
          画面選択へ
        </Link>
      </header>

      {(waiting.error || calling.error || actionError) && (
        <p
          role="alert"
          aria-live="polite"
          className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40"
        >
          {actionError ?? waiting.error ?? calling.error}
        </p>
      )}

      {/* 受け渡し待ち → タップで呼び出し */}
      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold opacity-70">
          受け渡し待ち（{displayedWaiting.length}）
        </h2>
        {displayedWaiting.length === 0 ? (
          <p className="p-6 text-center text-sm opacity-50">ありません</p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {displayedWaiting.map((order) => (
              <button
                key={order.id}
                type="button"
                onClick={() => callOrder(order)}
                disabled={pending.has(order.id)}
                aria-label={`注文 ${order.number} を呼び出す`}
                className="flex flex-col items-start gap-1 rounded-xl border border-black/15 p-3 text-left transition hover:bg-black/5 disabled:opacity-40 dark:border-white/20 dark:hover:bg-white/10"
              >
                <span className="text-[40px] font-bold leading-none tabular-nums">
                  {order.number}
                </span>
                <span className="text-xs opacity-70">{itemSummary(order)}</span>
                <span className="mt-1 text-xs font-medium opacity-90">呼び出す</span>
              </button>
            ))}
          </div>
        )}
      </section>

      {/* 呼び出し中 → タップで受け渡し完了 */}
      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-green-700 dark:text-green-400">
          呼び出し中（{displayedCalling.length}）
        </h2>
        {displayedCalling.length === 0 ? (
          <p className="p-6 text-center text-sm opacity-50">ありません</p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {displayedCalling.map((order) => (
              <button
                key={order.id}
                type="button"
                onClick={() => handoffOrder(order)}
                disabled={pending.has(order.id)}
                aria-label={`注文 ${order.number} を受け渡し完了`}
                className="flex flex-col items-start gap-1 rounded-xl border border-green-600/60 bg-green-50/40 p-3 text-left transition hover:bg-green-100/50 disabled:opacity-40 dark:bg-green-950/20"
              >
                <span className="text-[40px] font-bold leading-none tabular-nums">
                  {order.number}
                </span>
                <span className="text-xs opacity-70">{itemSummary(order)}</span>
                <span className="mt-1 text-xs font-medium opacity-90">受け渡し完了</span>
              </button>
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
