"use client";

import { Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import AuthGuard from "@/components/AuthGuard";
import { useProducts } from "@/hooks/useProducts";
import { orderApi, ApiError, type OrderSource, type Product } from "@/lib/api";
import { formatYen } from "@/lib/format";

const REGISTERS: OrderSource[] = ["会計1", "会計2"];
const QUICK_CASH = [500, 1000, 5000];

type Cart = Record<number, number>; // productId -> quantity

function CashierInner() {
  const searchParams = useSearchParams();
  const register = searchParams.get("register") as OrderSource | null;
  const { products, loading, error, refresh } = useProducts();

  const [cart, setCart] = useState<Cart>({});
  const [received, setReceived] = useState(0);
  const [phase, setPhase] = useState<"cart" | "submitting" | "done">("cart");
  const [issuedNumber, setIssuedNumber] = useState<number | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const total = useMemo(
    () =>
      products.reduce((sum, p) => sum + p.price * (cart[p.id] ?? 0), 0),
    [products, cart],
  );
  const itemCount = useMemo(
    () => Object.values(cart).reduce((a, b) => a + b, 0),
    [cart],
  );
  const change = received - total;

  if (!register || !REGISTERS.includes(register)) {
    return (
      <main className="mx-auto flex max-w-md flex-1 flex-col justify-center gap-4 p-8 text-center">
        <h1 className="text-xl font-bold">レジが指定されていません</h1>
        <p className="text-sm opacity-70">画面選択から会計1／会計2を選んでください。</p>
        <Link href="/select" className="text-sm underline opacity-80">
          ← 画面選択へ
        </Link>
      </main>
    );
  }

  function addItem(p: Product) {
    if (p.is_sold_out) return;
    setCart((c) => ({ ...c, [p.id]: (c[p.id] ?? 0) + 1 }));
  }
  function decItem(id: number) {
    setCart((c) => {
      const next = { ...c };
      const q = (next[id] ?? 0) - 1;
      if (q <= 0) delete next[id];
      else next[id] = q;
      return next;
    });
  }

  function resetSale() {
    setCart({});
    setReceived(0);
    setIssuedNumber(null);
    setSubmitError(null);
    setPhase("cart");
  }

  async function handleCheckout() {
    if (itemCount === 0 || change < 0 || phase === "submitting") return;
    setPhase("submitting");
    setSubmitError(null);

    const items = Object.entries(cart)
      .filter(([, q]) => q > 0)
      .map(([product_id, quantity]) => ({
        product_id: Number(product_id),
        quantity,
      }));

    try {
      const order = await orderApi.create({ source: register!, items });
      await orderApi.updateStatus(order.id, "会計完了");
      setIssuedNumber(order.number);
      setPhase("done");
    } catch (e) {
      if (e instanceof ApiError && e.status === 422) {
        setSubmitError(e.message + "。商品状態を更新しました。");
        refresh();
      } else {
        setSubmitError(
          e instanceof Error ? e.message : "会計処理に失敗しました",
        );
      }
      setPhase("cart");
    }
  }

  // 会計完了後の番号表示
  if (phase === "done" && issuedNumber !== null) {
    return (
      <main className="mx-auto flex max-w-md flex-1 flex-col items-center justify-center gap-8 p-8 text-center">
        <div>
          <p className="text-sm opacity-70">お渡し番号</p>
          <p className="text-8xl font-bold tabular-nums">{issuedNumber}</p>
        </div>
        <div className="text-sm opacity-70">
          <p>合計 {formatYen(total)}／お預かり {formatYen(received)}</p>
          <p className="text-lg font-semibold opacity-100">
            お釣り {formatYen(change)}
          </p>
        </div>
        <button
          type="button"
          onClick={resetSale}
          className="w-full rounded-xl bg-black px-6 py-4 text-lg font-bold text-white dark:bg-white dark:text-black"
        >
          次の会計へ
        </button>
      </main>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-4 p-4 sm:p-6">
      <header className="flex items-center justify-between">
        <h1 className="text-xl font-bold">
          会計 <span className="rounded bg-black/10 px-2 py-0.5 text-sm dark:bg-white/15">{register}</span>
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

      <div className="grid flex-1 gap-4 lg:grid-cols-[1fr_360px]">
        {/* 商品グリッド */}
        <section>
          {loading ? (
            <p className="p-8 text-center text-sm opacity-60">読み込み中…</p>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {products.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  disabled={p.is_sold_out}
                  onClick={() => addItem(p)}
                  className="relative flex aspect-square flex-col items-center justify-center gap-1 rounded-xl border border-black/15 p-3 text-center transition hover:bg-black/5 disabled:cursor-not-allowed disabled:opacity-40 dark:border-white/20 dark:hover:bg-white/10"
                >
                  <span className="font-medium">{p.name}</span>
                  <span className="text-sm opacity-70">{formatYen(p.price)}</span>
                  {(cart[p.id] ?? 0) > 0 && (
                    <span className="absolute right-2 top-2 flex h-6 min-w-6 items-center justify-center rounded-full bg-black px-1 text-xs font-bold text-white dark:bg-white dark:text-black">
                      {cart[p.id]}
                    </span>
                  )}
                  {p.is_sold_out && (
                    <span className="absolute inset-x-0 bottom-2 text-xs font-bold text-red-600">
                      売り切れ
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
        </section>

        {/* カート・会計 */}
        <section className="flex flex-col gap-3 rounded-xl border border-black/15 p-4 dark:border-white/20">
          <h2 className="font-semibold">注文内容</h2>
          <ul className="flex flex-col gap-2">
            {itemCount === 0 && (
              <li className="py-4 text-center text-sm opacity-50">
                商品をタップして追加
              </li>
            )}
            {products
              .filter((p) => (cart[p.id] ?? 0) > 0)
              .map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-2">
                  <span className="flex-1 truncate text-sm">{p.name}</span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => decItem(p.id)}
                      className="h-7 w-7 rounded-full border border-black/20 dark:border-white/25"
                      aria-label="減らす"
                    >
                      −
                    </button>
                    <span className="w-6 text-center tabular-nums">{cart[p.id]}</span>
                    <button
                      type="button"
                      onClick={() => addItem(p)}
                      className="h-7 w-7 rounded-full border border-black/20 dark:border-white/25"
                      aria-label="増やす"
                    >
                      ＋
                    </button>
                    <span className="w-16 text-right text-sm tabular-nums">
                      {formatYen(p.price * (cart[p.id] ?? 0))}
                    </span>
                  </div>
                </li>
              ))}
          </ul>

          <div className="mt-auto flex flex-col gap-3 border-t border-black/10 pt-3 dark:border-white/15">
            <div className="flex items-baseline justify-between">
              <span className="text-sm opacity-70">合計</span>
              <span className="text-2xl font-bold tabular-nums">{formatYen(total)}</span>
            </div>

            {/* お預かり */}
            <div className="flex flex-col gap-2">
              <label className="text-sm opacity-70">お預かり</label>
              <input
                type="number"
                inputMode="numeric"
                min={0}
                value={received === 0 ? "" : received}
                onChange={(e) => setReceived(Math.max(0, Number(e.target.value) || 0))}
                placeholder="0"
                className="rounded-lg border border-black/15 px-3 py-2 text-right text-lg tabular-nums dark:border-white/20"
              />
              <div className="flex flex-wrap gap-2">
                {QUICK_CASH.map((amount) => (
                  <button
                    key={amount}
                    type="button"
                    onClick={() => setReceived((r) => r + amount)}
                    className="flex-1 rounded-lg border border-black/15 px-2 py-1.5 text-sm dark:border-white/20"
                  >
                    +{formatYen(amount)}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setReceived(total)}
                  className="flex-1 rounded-lg border border-black/15 px-2 py-1.5 text-sm dark:border-white/20"
                >
                  ちょうど
                </button>
                <button
                  type="button"
                  onClick={() => setReceived(0)}
                  className="rounded-lg border border-black/15 px-2 py-1.5 text-sm dark:border-white/20"
                >
                  クリア
                </button>
              </div>
            </div>

            {/* お釣り */}
            <div className="flex items-baseline justify-between">
              <span className="text-sm opacity-70">お釣り</span>
              <span
                className={`text-xl font-bold tabular-nums ${
                  received > 0 && change < 0 ? "text-red-600" : ""
                }`}
              >
                {received > 0 ? formatYen(Math.max(0, change)) : "—"}
              </span>
            </div>
            {received > 0 && change < 0 && (
              <p className="text-right text-xs text-red-600">
                {formatYen(-change)} 不足しています
              </p>
            )}

            {submitError && (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40">
                {submitError}
              </p>
            )}

            <button
              type="button"
              disabled={itemCount === 0 || change < 0 || phase === "submitting"}
              onClick={handleCheckout}
              className="rounded-xl bg-black px-6 py-4 text-lg font-bold text-white disabled:opacity-40 dark:bg-white dark:text-black"
            >
              {phase === "submitting" ? "処理中…" : "会計完了"}
            </button>
          </div>
        </section>
      </div>
    </main>
  );
}

export default function CashierPage() {
  return (
    <AuthGuard>
      <Suspense
        fallback={
          <main className="flex flex-1 items-center justify-center p-8">
            <p className="text-sm opacity-60">読み込み中…</p>
          </main>
        }
      >
        <CashierInner />
      </Suspense>
    </AuthGuard>
  );
}
