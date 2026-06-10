"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import type { Product, OrderItem } from "@/types";
import { cn } from "@/lib/utils";

export default function PosPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [discount, setDiscount] = useState(0);
  const [stoppedWarning, setStoppedWarning] = useState<Product | null>(null);
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [lastOrderNumber, setLastOrderNumber] = useState<number | null>(null);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

  useEffect(() => {
    const loadProducts = (data: Product[]) => {
      setProducts(data);
      const cats = [...new Set(data.map((p) => p.category))];
      setCategories(cats);
      setSelectedCategory((prev) => (cats.includes(prev) ? prev : cats[0] || ""));
      setOrderItems((prev) =>
        prev.map((item) => {
          const product = data.find((p) => p.id === item.product_id);
          return product ? { ...item, price: product.price } : item;
        })
      );
    };

    supabase
      .from("products")
      .select("*")
      .order("category")
      .then(({ data }) => {
        if (data) loadProducts(data as Product[]);
      });

    // 商品マスタの変更をリアルタイムで反映（価格変更・販売停止など）
    const channel = supabase
      .channel("pos-products")
      .on("postgres_changes", { event: "*", schema: "public", table: "products" }, () => {
        supabase
          .from("products")
          .select("*")
          .order("category")
          .then(({ data }) => {
            if (data) loadProducts(data as Product[]);
          });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const addItem = useCallback((product: Product) => {
    if (isCheckingOut) return;
    if (product.is_stopped) {
      setStoppedWarning(product);
      return;
    }
    setOrderItems((prev) => {
      const existing = prev.find((i) => i.product_id === product.id);
      if (existing) {
        // 価格変更に追従して最新価格で上書き
        return prev.map((i) =>
          i.product_id === product.id
            ? { ...i, quantity: i.quantity + 1, price: product.price }
            : i
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
  }, [isCheckingOut]);

  const removeItem = useCallback((productId: string) => {
    if (isCheckingOut) return;
    setOrderItems((prev) =>
      prev
        .map((i) =>
          i.product_id === productId ? { ...i, quantity: i.quantity - 1 } : i
        )
        .filter((i) => i.quantity > 0)
    );
  }, [isCheckingOut]);

  const subtotal = orderItems.reduce(
    (sum, i) => sum + i.price * i.quantity,
    0
  );
  const effectiveDiscount = Math.min(discount, subtotal);
  const total = subtotal - effectiveDiscount;

  const checkout = async () => {
    if (orderItems.length === 0) return;
    setIsCheckingOut(true);
    setCheckoutError(null);
    try {
      const { data: orderNumber, error } = await supabase.rpc("create_order", {
        p_source: "pos",
        p_items: orderItems,
        p_discount: effectiveDiscount,
        p_payment_method: "cash",
      });
      if (error) throw error;

      setLastOrderNumber(orderNumber);
      setOrderItems([]);
      setDiscount(0);
    } catch (err) {
      setCheckoutError(
        err instanceof Error ? err.message : "会計処理に失敗しました。もう一度お試しください。"
      );
    } finally {
      setIsCheckingOut(false);
    }
  };

  const visibleProducts = products.filter(
    (p) => p.category === selectedCategory
  );

  return (
    <div className="flex h-screen bg-gray-100 overflow-hidden">
      {/* 左エリア: カテゴリ + 商品 */}
      <div className="flex flex-col flex-1 min-w-0">
        {/* カテゴリタブ */}
        <div className="flex gap-1 p-3 bg-white border-b overflow-x-auto shrink-0">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={cn(
                "px-5 py-3 rounded-lg font-bold text-base whitespace-nowrap transition-colors",
                selectedCategory === cat
                  ? "bg-orange-500 text-white"
                  : "bg-gray-200 text-gray-700 hover:bg-gray-300"
              )}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* 商品グリッド */}
        <div className="flex-1 overflow-y-auto p-3 grid grid-cols-3 gap-3 content-start">
          {visibleProducts.map((product) => (
            <button
              key={product.id}
              onClick={() => addItem(product)}
              className={cn(
                "rounded-xl p-4 text-left transition-all active:scale-95",
                product.is_stopped
                  ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                  : "bg-white hover:shadow-md hover:bg-orange-50 border border-gray-200"
              )}
            >
              <div className="font-bold text-lg leading-tight">{product.name}</div>
              <div className="text-orange-600 font-semibold mt-1">
                ¥{product.price.toLocaleString()}
              </div>
              {product.is_stopped && (
                <div className="text-xs text-red-500 mt-1">販売停止</div>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* 右エリア: 注文・会計 */}
      <div className="w-80 bg-white border-l flex flex-col">
        <div className="p-4 border-b">
          <h2 className="font-bold text-lg">注文内容</h2>
        </div>

        {/* 注文リスト */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {orderItems.length === 0 ? (
            <p className="text-gray-400 text-center mt-8">商品を選択してください</p>
          ) : (
            orderItems.map((item) => (
              <div
                key={item.product_id}
                className="flex items-center justify-between bg-gray-50 rounded-lg p-3"
              >
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm truncate">{item.product_name}</div>
                  <div className="text-gray-500 text-xs">
                    ¥{item.price.toLocaleString()} × {item.quantity}
                  </div>
                </div>
                <div className="flex items-center gap-2 ml-2">
                  <button
                    onClick={() => removeItem(item.product_id)}
                    className="w-7 h-7 rounded-full bg-gray-200 hover:bg-gray-300 font-bold text-lg leading-none flex items-center justify-center"
                  >
                    −
                  </button>
                  <span className="w-5 text-center font-bold">{item.quantity}</span>
                  <button
                    onClick={() => {
                      const product = products.find((p) => p.id === item.product_id);
                      if (product) addItem(product);
                    }}
                    disabled={!products.find((p) => p.id === item.product_id)}
                    className="w-7 h-7 rounded-full bg-orange-500 hover:bg-orange-600 disabled:bg-gray-300 text-white font-bold text-lg leading-none flex items-center justify-center"
                  >
                    ＋
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* 割引・合計・会計ボタン */}
        <div className="p-4 border-t space-y-3">
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-600 whitespace-nowrap">割引</label>
            <input
              type="number"
              min={0}
              value={discount || ""}
              onChange={(e) => setDiscount(Math.max(0, Math.floor(Number(e.target.value) || 0)))}
              placeholder="0"
              className="flex-1 border rounded-lg px-3 py-2 text-right text-base"
            />
            <span className="text-sm text-gray-600">円</span>
          </div>

          <div className="flex justify-between text-sm text-gray-500">
            <span>小計</span>
            <span>¥{subtotal.toLocaleString()}</span>
          </div>
          {effectiveDiscount > 0 && (
            <div className="flex justify-between text-sm text-red-500">
              <span>割引</span>
              <span>−¥{effectiveDiscount.toLocaleString()}</span>
            </div>
          )}
          <div className="flex justify-between font-bold text-xl">
            <span>合計</span>
            <span>¥{total.toLocaleString()}</span>
          </div>

          <button
            onClick={checkout}
            disabled={orderItems.length === 0 || isCheckingOut}
            className="w-full py-4 bg-orange-500 hover:bg-orange-600 disabled:bg-gray-300 text-white font-bold text-xl rounded-xl transition-colors"
          >
            {isCheckingOut ? "処理中..." : "会計"}
          </button>
        </div>
      </div>

      {/* 会計エラーモーダル */}
      {checkoutError && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-8 max-w-sm w-full mx-4 text-center">
            <div className="text-4xl mb-4">❌</div>
            <h3 className="text-xl font-bold mb-2 text-red-600">会計エラー</h3>
            <p className="text-gray-600 mb-6 text-sm">{checkoutError}</p>
            <button
              onClick={() => setCheckoutError(null)}
              className="w-full py-3 bg-red-500 text-white font-bold rounded-xl"
            >
              閉じる
            </button>
          </div>
        </div>
      )}

      {/* 販売停止警告モーダル */}
      {stoppedWarning && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-8 max-w-sm w-full mx-4 text-center">
            <div className="text-4xl mb-4">⚠️</div>
            <h3 className="text-xl font-bold mb-2">販売停止中</h3>
            <p className="text-gray-600 mb-6">
              「{stoppedWarning.name}」は現在販売停止中です。
            </p>
            <button
              onClick={() => setStoppedWarning(null)}
              className="w-full py-3 bg-orange-500 text-white font-bold rounded-xl"
            >
              閉じる
            </button>
          </div>
        </div>
      )}

      {/* 会計完了モーダル */}
      {lastOrderNumber && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-10 max-w-sm w-full mx-4 text-center">
            <div className="text-gray-500 mb-2">注文番号</div>
            <div className="text-8xl font-black text-orange-500 my-4">
              {lastOrderNumber}
            </div>
            <p className="text-gray-600 mb-6">会計が完了しました</p>
            <button
              onClick={() => setLastOrderNumber(null)}
              className="w-full py-3 bg-orange-500 text-white font-bold rounded-xl"
            >
              次の注文へ
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
