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

  // 0の品目行は非表示（表示中の注文で合計0の品目を除く）
  const visibleProducts = useMemo(
    () =>
      products.filter((p) =>
        orders.some((o) => qtyOf(o, p.id) > 0),
      ),
    [products, orders],
  );

  const complete = useCallback(
    async (order: Order | undefined) => {
      if (!order) return;
      let already = false;
      setCompleting((s) => {
        if (s.has(order.id)) {
          already = true;
          return s;
        }
        return new Set(s).add(order.id);
      });
      if (already) return;
      try {
        await orderApi.updateStatus(order.id, "準備完了");
        refresh();
      } catch {
        /* 失敗時は次のポーリング/イベントで整合 */
      } finally {
        setCompleting((s) => {
          const n = new Set(s);
          n.delete(order.id);
          return n;
        });
      }
    },
    [refresh],
  );

  // スペースキーで先頭（最古）の注文を完了。
  const ordersRef = useRef(orders);
  useEffect(() => {
    ordersRef.current = orders;
  }, [orders]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Space" || e.key === " ") {
        e.preventDefault();
        complete(ordersRef.current[0]);
      }
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

      {loading && orders.length === 0 ? (
        <p className="p-8 text-center text-sm opacity-60">読み込み中…</p>
      ) : orders.length === 0 ? (
        <p className="p-8 text-center text-sm opacity-60">
          調理待ちの注文はありません
        </p>
      ) : (
        <div className="flex flex-col gap-6">
          {chunks.map((chunk, ci) => (
            <table key={ci} className="border-collapse">
              <thead>
                <tr>
                  {/* 品目名の見出し列 */}
                  <th className="sticky left-0 bg-transparent" />
                  {chunk.map((order, oi) => {
                    const isHead = ci === 0 && oi === 0; // 全体の先頭
                    return (
                      <th
                        key={order.id}
                        onClick={() => complete(order)}
                        className={`w-[72px] cursor-pointer select-none border border-black/15 p-1 text-left align-top text-[32px] font-bold leading-none tabular-nums dark:border-white/20 ${
                          isHead ? "bg-black/10 dark:bg-white/15" : ""
                        } ${completing.has(order.id) ? "opacity-40" : ""}`}
                        title="タップで完了（準備完了へ）"
                      >
                        {order.number}
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
