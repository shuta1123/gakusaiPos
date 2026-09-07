"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import AuthGuard from "@/components/AuthGuard";
import { useProducts } from "@/hooks/useProducts";
import {
  orderApi,
  productApi,
  ApiError,
  type OrderSource,
  type Product,
} from "@/lib/api";
import { formatYen } from "@/lib/format";

const REGISTERS: OrderSource[] = ["会計1", "会計2"];
const MAX_CASH = 999999;

type Cart = Record<number, number>; // productId -> quantity

function CashierInner() {
  const searchParams = useSearchParams();
  const register = searchParams.get("register") as OrderSource | null;
  const { products, loading, error, refresh } = useProducts();

  const [cart, setCart] = useState<Cart>({});
  const [received, setReceived] = useState(0);
  const [discount, setDiscount] = useState(0);
  const [adminMode, setAdminMode] = useState(false);
  const [phase, setPhase] = useState<"cart" | "submitting" | "done">("cart");
  const [issuedNumber, setIssuedNumber] = useState<number | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const subtotal = useMemo(
    () => products.reduce((sum, p) => sum + p.price * (cart[p.id] ?? 0), 0),
    [products, cart],
  );
  const itemCount = useMemo(
    () => Object.values(cart).reduce((a, b) => a + b, 0),
    [cart],
  );
  const effectiveDiscount = Math.min(discount, subtotal);
  const payable = Math.max(0, subtotal - effectiveDiscount);
  const change = received - payable;

  const clampCash = (v: number) =>
    !Number.isFinite(v) || v <= 0 ? 0 : Math.min(MAX_CASH, Math.floor(v));

  const canCheckout =
    itemCount > 0 && change >= 0 && phase !== "submitting" && !adminMode;

  const addItem = useCallback((p: Product) => {
    if (p.is_sold_out) return;
    setCart((c) => ({ ...c, [p.id]: (c[p.id] ?? 0) + 1 }));
  }, []);

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
    setDiscount(0);
    setIssuedNumber(null);
    setSubmitError(null);
    setPhase("cart");
  }

  const handleCheckout = useCallback(async () => {
    if (itemCount === 0 || change < 0 || phase === "submitting" || adminMode) {
      return;
    }
    setPhase("submitting");
    setSubmitError(null);

    const items = Object.entries(cart)
      .filter(([, q]) => q > 0)
      .map(([product_id, quantity]) => ({
        product_id: Number(product_id),
        quantity,
      }));

    try {
      const order = await orderApi.create({
        source: register!,
        items,
        status: "会計完了",
        discount: effectiveDiscount,
      });
      setIssuedNumber(order.number);
      setPhase("done");
    } catch (e) {
      if (e instanceof ApiError && e.status === 422) {
        try {
          const fresh = await productApi.list();
          const soldOut = new Set(
            fresh.filter((p) => p.is_sold_out).map((p) => p.id),
          );
          setCart((c) => {
            const next = { ...c };
            soldOut.forEach((id) => delete next[id]);
            return next;
          });
        } catch {
          /* noop */
        }
        setSubmitError(e.message + "。売り切れ商品をカートから削除しました。");
        refresh();
      } else {
        setSubmitError(e instanceof Error ? e.message : "会計処理に失敗しました");
      }
      setPhase("cart");
    }
  }, [
    itemCount,
    change,
    phase,
    adminMode,
    cart,
    register,
    effectiveDiscount,
    refresh,
  ]);

  // テンキー／物理キーボードでお預かりに数字入力、Enterで会計完了。
  useEffect(() => {
    if (phase !== "cart" || adminMode) return;
    const onKey = (e: KeyboardEvent) => {
      const active = document.activeElement;
      // 入力欄（割引・価格編集）にフォーカス中はネイティブ動作に任せる。
      if (active && active.tagName === "INPUT") return;
      if (e.key >= "0" && e.key <= "9") {
        e.preventDefault();
        setReceived((r) => clampCash(r * 10 + Number(e.key)));
      } else if (e.key === "Backspace") {
        e.preventDefault();
        setReceived((r) => Math.floor(r / 10));
      } else if (e.key === "Enter") {
        e.preventDefault();
        handleCheckout();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase, adminMode, handleCheckout]);

  async function toggleSoldOut(p: Product) {
    try {
      await productApi.update(p.id, { is_sold_out: !p.is_sold_out });
      refresh();
    } catch {
      /* noop */
    }
  }

  async function savePrice(p: Product, value: string) {
    const price = Math.floor(Number(value));
    if (!Number.isFinite(price) || price < 0 || price === p.price) return;
    try {
      await productApi.update(p.id, { price });
      refresh();
    } catch {
      /* noop */
    }
  }

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

  // 会計完了後の番号表示
  if (phase === "done" && issuedNumber !== null) {
    return (
      <main className="mx-auto flex max-w-md flex-1 flex-col items-center justify-center gap-8 p-8 text-center">
        <div>
          <p className="text-sm opacity-70">お渡し番号</p>
          <p className="text-[120px] font-bold leading-none tabular-nums">
            {issuedNumber}
          </p>
        </div>
        <div className="w-full max-w-xs space-y-1 text-sm">
          <div className="flex justify-between opacity-70">
            <span>合計</span>
            <span className="tabular-nums">{formatYen(subtotal)}</span>
          </div>
          {effectiveDiscount > 0 && (
            <div className="flex justify-between opacity-70">
              <span>割引</span>
              <span className="tabular-nums">
                −{formatYen(effectiveDiscount)}
              </span>
            </div>
          )}
          <div className="flex justify-between opacity-70">
            <span>お預かり</span>
            <span className="tabular-nums">{formatYen(received)}</span>
          </div>
          <div className="flex justify-between border-t border-black/10 pt-1 text-lg font-bold dark:border-white/15">
            <span>お釣り</span>
            <span className="tabular-nums">{formatYen(change)}</span>
          </div>
        </div>
        <button
          type="button"
          onClick={resetSale}
          className="w-full rounded-2xl bg-black px-6 py-5 text-xl font-bold text-white dark:bg-white dark:text-black"
        >
          次の会計へ
        </button>
      </main>
    );
  }

  const keypad = ["7", "8", "9", "4", "5", "6", "1", "2", "3"];
  const cartLines = products.filter((p) => (cart[p.id] ?? 0) > 0);

  return (
    <main className="flex h-dvh w-full flex-col gap-2 overflow-hidden p-2 sm:p-3">
      <header className="flex items-center justify-between gap-2 px-1">
        <h1 className="flex items-center gap-2 text-lg font-bold">
          会計
          <span className="rounded-md bg-black px-2 py-0.5 text-sm text-white dark:bg-white dark:text-black">
            {register}
          </span>
        </h1>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setAdminMode((v) => !v)}
            className={`rounded-lg border px-3 py-1.5 text-sm font-medium ${
              adminMode
                ? "border-amber-500 bg-amber-500 text-white"
                : "border-black/20 dark:border-white/25"
            }`}
          >
            {adminMode ? "🔧 管理者モード ON" : "🔧 管理者モード"}
          </button>
          <Link href="/select" className="text-sm underline opacity-60">
            画面選択へ
          </Link>
        </div>
      </header>

      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40">
          {error}
        </p>
      )}
      {adminMode && (
        <p className="rounded-lg bg-amber-100 px-3 py-1.5 text-center text-sm font-medium text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
          管理者モード中：価格・売り切れを変更できます（会計はできません）
        </p>
      )}

      <div className="grid min-h-0 flex-1 gap-2 lg:grid-cols-[minmax(0,1fr)_260px_320px]">
        {/* --- 商品 --- */}
        <section className="flex min-h-0 flex-col gap-2">
          <h2 className="px-1 text-sm font-semibold opacity-60">商品</h2>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {loading ? (
              <p className="p-8 text-center text-sm opacity-60">読み込み中…</p>
            ) : (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {products.map((p) =>
                  adminMode ? (
                    <div
                      key={p.id}
                      className="flex flex-col gap-2 rounded-xl border-2 border-amber-400/60 p-3"
                    >
                      <span className="font-medium">{p.name}</span>
                      <label className="flex items-center gap-1 text-sm">
                        ¥
                        <input
                          type="number"
                          min={0}
                          defaultValue={p.price}
                          onBlur={(e) => savePrice(p, e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              savePrice(p, e.currentTarget.value);
                              e.currentTarget.blur();
                            }
                          }}
                          className="w-full rounded border border-black/15 px-2 py-1.5 text-right text-lg tabular-nums dark:border-white/20"
                        />
                      </label>
                      <button
                        type="button"
                        onClick={() => toggleSoldOut(p)}
                        className={`rounded-lg px-2 py-2 text-sm font-medium ${
                          p.is_sold_out
                            ? "bg-red-600 text-white"
                            : "border border-black/15 dark:border-white/20"
                        }`}
                      >
                        {p.is_sold_out ? "売り切れ中（復活）" : "売り切れにする"}
                      </button>
                    </div>
                  ) : (
                    <button
                      key={p.id}
                      type="button"
                      disabled={p.is_sold_out}
                      onClick={() => addItem(p)}
                      className="relative flex aspect-[4/3] flex-col items-center justify-center gap-1 rounded-xl border border-black/15 p-2 text-center transition active:scale-95 hover:bg-black/5 disabled:cursor-not-allowed disabled:opacity-40 dark:border-white/20 dark:hover:bg-white/10"
                    >
                      <span className="text-base font-semibold">{p.name}</span>
                      <span className="text-sm opacity-70">
                        {formatYen(p.price)}
                      </span>
                      {(cart[p.id] ?? 0) > 0 && (
                        <span className="absolute right-2 top-2 flex h-7 min-w-7 items-center justify-center rounded-full bg-black px-1 text-sm font-bold text-white dark:bg-white dark:text-black">
                          {cart[p.id]}
                        </span>
                      )}
                      {p.is_sold_out && (
                        <span className="absolute inset-x-0 bottom-2 text-xs font-bold text-red-600">
                          売り切れ
                        </span>
                      )}
                    </button>
                  ),
                )}
              </div>
            )}
          </div>
        </section>

        {/* --- 注文内容 --- */}
        <section className="flex min-h-0 flex-col rounded-2xl border border-black/15 dark:border-white/20">
          <h2 className="border-b border-black/10 px-4 py-2.5 text-sm font-semibold dark:border-white/15">
            注文内容{itemCount > 0 && `（${itemCount}点）`}
          </h2>
          <ul className="min-h-0 flex-1 space-y-1 overflow-y-auto p-2">
            {itemCount === 0 && (
              <li className="py-8 text-center text-sm opacity-40">
                商品をタップして追加
              </li>
            )}
            {cartLines.map((p) => (
              <li
                key={p.id}
                className="flex items-center gap-2 rounded-lg px-2 py-1.5"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{p.name}</p>
                  <p className="text-xs tabular-nums opacity-60">
                    {formatYen(p.price)} × {cart[p.id]} ={" "}
                    {formatYen(p.price * (cart[p.id] ?? 0))}
                  </p>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => decItem(p.id)}
                    className="h-9 w-9 rounded-full border border-black/20 text-lg dark:border-white/25"
                    aria-label={`${p.name}を減らす`}
                  >
                    −
                  </button>
                  <span className="w-6 text-center text-lg tabular-nums">
                    {cart[p.id]}
                  </span>
                  <button
                    type="button"
                    onClick={() => addItem(p)}
                    className="h-9 w-9 rounded-full border border-black/20 text-lg dark:border-white/25"
                    aria-label={`${p.name}を増やす`}
                  >
                    ＋
                  </button>
                </div>
              </li>
            ))}
          </ul>
          <div className="flex items-baseline justify-between border-t border-black/10 px-4 py-2.5 dark:border-white/15">
            <span className="text-sm opacity-70">小計</span>
            <span className="text-xl font-bold tabular-nums">
              {formatYen(subtotal)}
            </span>
          </div>
        </section>

        {/* --- お会計（金額入力） --- */}
        <section className="flex min-h-0 flex-col gap-2 overflow-y-auto rounded-2xl border-2 border-black/20 p-3 dark:border-white/25">
          {/* 割引 */}
          <div className="flex items-center justify-between gap-2">
            <label className="text-sm opacity-70">割引（¥）</label>
            <input
              type="number"
              inputMode="numeric"
              min={0}
              value={discount === 0 ? "" : discount}
              onChange={(e) => setDiscount(clampCash(Number(e.target.value)))}
              placeholder="0"
              className="w-28 rounded-lg border border-black/15 px-3 py-2 text-right text-lg tabular-nums dark:border-white/20"
            />
          </div>

          {/* お会計 */}
          <div className="flex items-baseline justify-between rounded-xl bg-black/5 px-3 py-2 dark:bg-white/10">
            <span className="text-sm font-medium opacity-70">お会計</span>
            <span className="text-3xl font-bold tabular-nums">
              {formatYen(payable)}
            </span>
          </div>

          {/* お預かり表示 */}
          <div className="flex items-baseline justify-between px-1">
            <span className="text-sm opacity-70">お預かり</span>
            <span className="text-2xl tabular-nums">{formatYen(received)}</span>
          </div>

          {/* テンキー */}
          <div className="grid grid-cols-3 gap-1.5">
            {keypad.map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setReceived((r) => clampCash(r * 10 + Number(n)))}
                className="rounded-xl border border-black/15 py-4 text-2xl font-medium tabular-nums active:scale-95 active:bg-black/5 dark:border-white/20 dark:active:bg-white/10"
              >
                {n}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setReceived((r) => clampCash(r * 100))}
              className="rounded-xl border border-black/15 py-4 text-2xl font-medium tabular-nums active:scale-95 dark:border-white/20"
            >
              00
            </button>
            <button
              type="button"
              onClick={() => setReceived((r) => clampCash(r * 10))}
              className="rounded-xl border border-black/15 py-4 text-2xl font-medium tabular-nums active:scale-95 dark:border-white/20"
            >
              0
            </button>
            <button
              type="button"
              onClick={() => setReceived((r) => Math.floor(r / 10))}
              className="rounded-xl border border-black/15 py-4 text-2xl active:scale-95 dark:border-white/20"
              aria-label="1桁消す"
            >
              ⌫
            </button>
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            <button
              type="button"
              onClick={() => setReceived(payable)}
              className="rounded-xl border border-black/15 py-2.5 text-sm font-medium dark:border-white/20"
            >
              ちょうど
            </button>
            <button
              type="button"
              onClick={() => setReceived(0)}
              className="rounded-xl border border-black/15 py-2.5 text-sm dark:border-white/20"
            >
              クリア
            </button>
          </div>

          {/* お釣り */}
          <div
            className={`flex items-baseline justify-between rounded-xl px-3 py-2 ${
              received > 0 && change < 0
                ? "bg-red-50 dark:bg-red-950/40"
                : "bg-green-50 dark:bg-green-950/20"
            }`}
          >
            <span className="text-sm font-medium opacity-70">お釣り</span>
            <span
              className={`text-3xl font-bold tabular-nums ${
                received > 0 && change < 0
                  ? "text-red-600"
                  : "text-green-700 dark:text-green-400"
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
            disabled={!canCheckout}
            onClick={handleCheckout}
            className="mt-auto rounded-2xl bg-black py-5 text-xl font-bold text-white disabled:opacity-40 dark:bg-white dark:text-black"
          >
            {phase === "submitting"
              ? "処理中…"
              : adminMode
                ? "管理者モード中"
                : "会計完了（Enter）"}
          </button>
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
