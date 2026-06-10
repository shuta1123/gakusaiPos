"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { Order, OrderItem } from "@/types";

export default function CustomerPage() {
  const [lastOrder, setLastOrder] = useState<Order | null>(null);
  const [showOrder, setShowOrder] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const channel = supabase
      .channel("customer-display")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "orders" },
        (payload) => {
          const order = payload.new as Order;
          setLastOrder(order);
          setShowOrder(true);
          if (timerRef.current) clearTimeout(timerRef.current);
          // 30秒後に待機画面へ戻す
          timerRef.current = setTimeout(() => setShowOrder(false), 30000);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  if (!showOrder || !lastOrder) {
    return (
      <div className="min-h-screen bg-gray-900 flex flex-col items-center justify-center text-white">
        <div className="text-6xl font-black text-orange-400 mb-6">いらっしゃいませ</div>
        <div className="text-2xl text-gray-400">会計をお待ちしております</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 flex flex-col items-center justify-center text-white p-8">
      <div className="text-gray-400 text-xl mb-2">注文番号</div>
      <div className="text-[10rem] font-black text-orange-400 leading-none mb-8">
        {lastOrder.order_number}
      </div>

      <div className="bg-gray-800 rounded-2xl p-6 w-full max-w-sm space-y-2 mb-6">
        {(lastOrder.items as OrderItem[]).map((item, i) => (
          <div key={i} className="flex justify-between text-lg">
            <span>
              {item.product_name}
              {item.quantity > 1 ? ` ×${item.quantity}` : ""}
            </span>
            <span className="text-gray-400">¥{(item.price * item.quantity).toLocaleString()}</span>
          </div>
        ))}
        {lastOrder.discount > 0 && (
          <div className="flex justify-between text-red-400 border-t border-gray-700 pt-2">
            <span>割引</span>
            <span>−¥{lastOrder.discount.toLocaleString()}</span>
          </div>
        )}
        <div className="flex justify-between text-2xl font-bold border-t border-gray-700 pt-2">
          <span>合計</span>
          <span className="text-orange-400">¥{lastOrder.total_price.toLocaleString()}</span>
        </div>
      </div>

      <div className="text-gray-500 text-sm">調理中の番号はモニターをご確認ください</div>
    </div>
  );
}
