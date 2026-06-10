"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { Product, OrderItem } from "@/types";
import { cn } from "@/lib/utils";

type Step = "notice" | "menu" | "confirm" | "done";

export default function OrderPage() {
  const [step, setStep] = useState<Step>("notice");
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState("");
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [orderNumber, setOrderNumber] = useState<number | null>(null);

  useEffect(() => {
    supabase
      .from("products")
      .select("*")
      .order("category")
      .then(({ data }) => {
        if (!data) return;
        const prods = data as Product[];
        setProducts(prods);
        const cats = [...new Set(prods.map((p) => p.category))];
        setCategories(cats);
        setSelectedCategory(cats[0] || "");
      });
  }, []);

  const addItem = useCallback((product: Product) => {
    if (product.is_stopped) return;
    setOrderItems((prev) => {
      const existing = prev.find((i) => i.product_id === product.id);
      if (existing) {
        return prev.map((i) =>
          i.product_id === product.id ? { ...i, quantity: i.quantity + 1 } : i
        );
      }
      return [
        ...prev,
        {
          product_id: product.id,
          product_name: product.name,
          price: product.price,
          quantity: 1,
          toppings: [],
        },
      ];
    });
  }, []);

  const removeItem = useCallback((productId: string) => {
    setOrderItems((prev) =>
      prev.map((i) => (i.product_id === productId ? { ...i, quantity: i.quantity - 1 } : i)).filter((i) => i.quantity > 0)
    );
  }, []);

  const subtotal = orderItems.reduce((sum, i) => sum + i.price * i.quantity, 0);

  const submit = async () => {
    if (orderItems.length === 0) return;
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      const { data, error } = await supabase.rpc("create_order", {
        p_source: "smartphone",
        p_items: orderItems,
        p_discount: 0,
        p_payment_method: "cash",
      });
      if (error) throw error;
      setOrderNumber(data as number);
      setStep("done");
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "注文に失敗しました。もう一度お試しください。");
    } finally {
      setIsSubmitting(false);
    }
  };

  const reset = () => {
    setOrderItems([]);
    setOrderNumber(null);
    setSubmitError(null);
    setStep("notice");
  };

  // 注意事項画面
  if (step === "notice") {
    return (
      <div className="min-h-screen bg-orange-50 flex flex-col p-6">
        <div className="flex-1 flex flex-col items-center justify-center gap-8">
          <h1 className="text-3xl font-black text-orange-600 text-center">ご注文の前に</h1>
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm space-y-4 text-gray-700">
            <p className="text-base leading-relaxed">
              このページからご注文いただけます。
            </p>
            <p className="text-base leading-relaxed">
              会計は<span className="font-bold text-orange-600">店頭スタッフ</span>にお声がけください。
            </p>
            <p className="text-base leading-relaxed">
              呼び出し番号は<span className="font-bold text-orange-600">店頭モニター</span>でご確認ください。
            </p>
          </div>
          <button
            onClick={() => setStep("menu")}
            className="w-full max-w-sm py-5 bg-orange-500 hover:bg-orange-600 text-white font-black text-2xl rounded-2xl active:scale-95 transition-all"
          >
            注文する
          </button>
        </div>
      </div>
    );
  }

  // 完了画面
  if (step === "done" && orderNumber !== null) {
    return (
      <div className="min-h-screen bg-gray-900 flex flex-col items-center justify-center text-white p-6">
        <div className="text-gray-400 text-lg mb-2">注文番号</div>
        <div className="text-[8rem] font-black text-orange-400 leading-none mb-4">{orderNumber}</div>
        <p className="text-gray-400 text-center mb-2">
          店頭モニターで番号が呼ばれたら
          <br />
          カウンターへお越しください
        </p>
        <div className="bg-gray-800 rounded-2xl p-4 w-full max-w-xs space-y-1 mb-8 mt-4">
          {orderItems.map((item, i) => (
            <div key={i} className="flex justify-between text-sm">
              <span>
                {item.product_name}
                {item.quantity > 1 ? ` ×${item.quantity}` : ""}
              </span>
              <span className="text-gray-400">¥{(item.price * item.quantity).toLocaleString()}</span>
            </div>
          ))}
          <div className="flex justify-between font-bold border-t border-gray-700 pt-2 text-base">
            <span>合計</span>
            <span className="text-orange-400">¥{subtotal.toLocaleString()}</span>
          </div>
        </div>
        <button
          onClick={reset}
          className="w-full max-w-xs py-4 bg-gray-700 hover:bg-gray-600 text-white font-bold rounded-2xl"
        >
          最初に戻る
        </button>
      </div>
    );
  }

  // 確認画面
  if (step === "confirm") {
    return (
      <div className="min-h-screen bg-white flex flex-col">
        <div className="p-4 border-b flex items-center gap-3">
          <button
            onClick={() => setStep("menu")}
            className="text-orange-500 font-bold text-lg"
          >
            ← 戻る
          </button>
          <h1 className="text-xl font-bold">注文確認</h1>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {orderItems.map((item) => (
            <div key={item.product_id} className="flex items-center justify-between bg-gray-50 rounded-xl p-3">
              <div>
                <div className="font-medium">{item.product_name}</div>
                <div className="text-sm text-gray-500">¥{item.price.toLocaleString()} × {item.quantity}</div>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => removeItem(item.product_id)}
                  className="w-8 h-8 rounded-full bg-gray-200 font-bold text-lg flex items-center justify-center"
                >
                  −
                </button>
                <span className="w-6 text-center font-bold">{item.quantity}</span>
                <button
                  onClick={() => {
                    const product = products.find((p) => p.id === item.product_id);
                    if (product) addItem(product);
                  }}
                  className="w-8 h-8 rounded-full bg-orange-500 text-white font-bold text-lg flex items-center justify-center"
                >
                  ＋
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="p-4 border-t space-y-3">
          <div className="flex justify-between text-xl font-bold">
            <span>合計</span>
            <span className="text-orange-500">¥{subtotal.toLocaleString()}</span>
          </div>
          {submitError && (
            <p className="text-red-500 text-sm text-center">{submitError}</p>
          )}
          <button
            onClick={submit}
            disabled={isSubmitting || orderItems.length === 0}
            className="w-full py-5 bg-orange-500 hover:bg-orange-600 disabled:bg-gray-300 text-white font-black text-xl rounded-2xl active:scale-95 transition-all"
          >
            {isSubmitting ? "送信中..." : "注文する"}
          </button>
        </div>
      </div>
    );
  }

  // メニュー選択画面
  const visibleProducts = products.filter((p) => p.category === selectedCategory);

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* カテゴリタブ */}
      <div className="flex gap-1 p-3 bg-white border-b overflow-x-auto shrink-0 sticky top-0 z-10">
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            className={cn(
              "px-4 py-2 rounded-lg font-bold text-sm whitespace-nowrap transition-colors",
              selectedCategory === cat
                ? "bg-orange-500 text-white"
                : "bg-gray-100 text-gray-700"
            )}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* 商品グリッド */}
      <div className="flex-1 overflow-y-auto p-3 grid grid-cols-2 gap-3 content-start">
        {visibleProducts.map((product) => (
          <button
            key={product.id}
            onClick={() => addItem(product)}
            disabled={product.is_stopped}
            className={cn(
              "rounded-xl p-4 text-left transition-all active:scale-95",
              product.is_stopped
                ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                : "bg-white border border-gray-200 hover:border-orange-300 hover:bg-orange-50 shadow-sm"
            )}
          >
            <div className="font-bold text-base leading-tight">{product.name}</div>
            <div className="text-orange-500 font-semibold mt-1 text-sm">
              ¥{product.price.toLocaleString()}
            </div>
            {product.is_stopped && <div className="text-xs text-red-400 mt-1">販売停止</div>}
          </button>
        ))}
      </div>

      {/* カート */}
      {orderItems.length > 0 && (
        <div className="p-3 border-t bg-white">
          <button
            onClick={() => setStep("confirm")}
            className="w-full py-4 bg-orange-500 hover:bg-orange-600 text-white font-black text-lg rounded-2xl active:scale-95 transition-all flex items-center justify-between px-6"
          >
            <span className="bg-white text-orange-500 rounded-full w-8 h-8 flex items-center justify-center font-black text-base">
              {orderItems.reduce((s, i) => s + i.quantity, 0)}
            </span>
            <span>注文を確認する</span>
            <span>¥{subtotal.toLocaleString()}</span>
          </button>
        </div>
      )}
    </div>
  );
}
