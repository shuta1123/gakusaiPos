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
  // 会計完了（＝調理待ち）の注文を古い順に。完了で 準備完了 に進める。
  const { orders, loading, error, refresh } = useOrders({ status: "会計完了" });
  const { products } = useProducts();
  const [completing, setCompleting] = useState<Set<number>>(new Set());
  const [actionError, setActionError] = useState<string | null>(null);

  // 完了処理中の注文IDを同期的に管理（連打/長押しでの二重送信を確実に防ぐ）。
  const inFlightRef = useRef<Set<number>>(new Set());

  // 0の品目行は非表示（表示中の注文で合計0の品目を除く）
  const visibleProducts = useMemo(
    () => products.filter((p) => orders.some((o) => qtyOf(o, p.id) > 0)),
    [products, orders],
  );

  const complete = useCallback(
    async (order: Order | undefined) => {
      if (!order || inFlightRef.current.has(order.id)) return;
      inFlightRef.current.add(order.id);
      setCompleting(new Set(inFlightRef.current));
      try {
        setActionError(null);
        await orderApi.updateStatus(order.id, "準備完了");
        // 一覧から当該注文が消えるまでロックを保持し、反映前の再送信を防ぐ。
        await refresh();
      } catch (err) {
        setActionError(
          `注文${order.number}の完了に失敗しました: ${
            err instanceof Error ? err.message : "不明なエラー"
          }`,
        );
      } finally {
        inFlightRef.current.delete(order.id);
        setCompleting(new Set(inFlightRef.current));
      }
    },
    [refresh],
  );

  // スペースキーで先頭（最古）の注文を完了。
  // フォーカスが操作要素にある場合はネイティブ動作（ボタン活性化）に任せる。
  const ordersRef = useRef(orders);
  useEffect(() => {
    ordersRef.current = orders;
  }, [orders]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== "Space" && e.key !== " ") return;
      const active = document.activeElement;
      if (active && active !== document.body) return;
      e.preventDefault();
      const first = ordersRef.current[0];
      if (first && !inFlightRef.current.has(first.id)) complete(first);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [complete]);

  const chunks = useMemo(() => {
    const result: Order[][] = [];
    for (let i = 0; i < orders.length; i += CHUNK_SIZE) {
      result.push(orders.slice(i, i + CHUNK_SIZE));
    }
    return result;
  }, [orders]);

  return (
    <main className="flex flex-1 flex-col gap-4 p-4">
      <header className="flex items-center justify-between">
        <h1 className="text-xl font-bold">
          調理担当{" "}
          <span className="text-sm font-normal opacity-60">
            スペースキー／番号タップで先頭を完了
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

      {loading && orders.length === 0 ? (
        <p className="p-8 text-center text-sm opacity-60">読み込み中…</p>
      ) : orders.length === 0 ? (
        <p className="p-8 text-center text-sm opacity-60">
          調理待ちの注文はありません
        </p>
      ) : (
        <div className="flex flex-col gap-6">
          {chunks.map((chunk) => (
            <table key={chunk[0].id} className="border-collapse">
              <thead>
                <tr>
                  {/* 品目名の見出し列 */}
                  <th className="bg-transparent" />
                  {chunk.map((order) => {
                    const isHead = order.id === orders[0]?.id; // 全体の先頭
                    return (
                      <th
                        key={order.id}
                        className={`w-[72px] border border-black/15 p-0 align-top dark:border-white/20 ${
                          isHead ? "bg-black/10 dark:bg-white/15" : ""
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => complete(order)}
                          disabled={completing.has(order.id)}
                          aria-label={`注文 ${order.number} を完了`}
                          className={`block w-full p-1 text-left text-[32px] font-bold leading-none tabular-nums disabled:opacity-40 ${
                            completing.has(order.id) ? "opacity-40" : ""
                          }`}
                          title="タップで完了（準備完了へ）"
                        >
                          {order.number}
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
                      return (
                        <td
                          key={order.id}
                          className="w-[72px] border border-black/15 p-1 text-left text-[32px] leading-none tabular-nums dark:border-white/20"
                        >
                          {q > 0 ? q : ""}
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
