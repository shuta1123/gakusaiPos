"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { Order, OrderItem } from "@/types";
import { cn } from "@/lib/utils";

export default function ManagePage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [updating, setUpdating] = useState<Set<string>>(new Set());
  const removedOrderIds = useRef<Set<string>>(new Set());

  useEffect(() => {
    const fetchOrders = async () => {
      const { data } = await supabase
        .from("orders")
        .select("*")
        .in("status", ["cooking", "ready"])
        .order("created_at", { ascending: true });
      if (data) {
        const snapshot = data as Order[];
        setOrders((prev) => {
          const merged = [...prev];
          for (const o of snapshot) {
            if (!removedOrderIds.current.has(o.id) && !merged.some((p) => p.id === o.id)) merged.push(o);
          }
          return merged.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
        });
      }
    };

    const channel = supabase
      .channel("manage-orders")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, (payload) => {
        if (payload.eventType === "INSERT") {
          const order = payload.new as Order;
          if (order.status === "cooking" || order.status === "ready") {
            setOrders((prev) => {
              if (prev.some((o) => o.id === order.id)) return prev;
              return [...prev, order].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
            });
          }
        } else if (payload.eventType === "UPDATE") {
          const order = payload.new as Order;
          if (order.status === "done") {
            removedOrderIds.current.add(order.id);
            setOrders((prev) => prev.filter((o) => o.id !== order.id));
          } else {
            setOrders((prev) => prev.map((o) => (o.id === order.id ? order : o)));
          }
        } else if (payload.eventType === "DELETE") {
          const id = (payload.old as Order).id;
          removedOrderIds.current.add(id);
          setOrders((prev) => prev.filter((o) => o.id !== id));
        }
      })
      .subscribe((status) => {
        if (status === "SUBSCRIBED") fetchOrders();
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const advance = async (order: Order) => {
    if (updating.has(order.id)) return;
    const nextStatus = order.status === "cooking" ? "ready" : "done";
    setUpdating((prev) => new Set(prev).add(order.id));
    await supabase.rpc("update_order_status", { p_order_id: order.id, p_status: nextStatus });
    setUpdating((prev) => {
      const s = new Set(prev);
      s.delete(order.id);
      return s;
    });
  };

  return (
    <div className="min-h-screen bg-gray-100 p-4">
      <h1 className="text-2xl font-bold mb-4">表示管理</h1>

      {orders.length === 0 ? (
        <div className="flex items-center justify-center h-64 text-gray-400 text-xl">
          注文はありません
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {orders.map((order) => (
            <button
              key={order.id}
              onClick={() => advance(order)}
              disabled={updating.has(order.id)}
              className={cn(
                "rounded-2xl p-4 flex flex-col gap-2 border-2 text-left transition-all active:scale-95",
                order.status === "cooking"
                  ? "bg-white border-gray-200 hover:border-orange-400"
                  : "bg-green-50 border-green-400 hover:border-green-600",
                updating.has(order.id) && "opacity-50 cursor-not-allowed"
              )}
            >
              <div className="flex items-center justify-between">
                <span className="text-3xl font-black">#{order.order_number}</span>
                <span
                  className={cn(
                    "text-xs font-bold px-2 py-1 rounded-full",
                    order.status === "cooking"
                      ? "bg-orange-100 text-orange-600"
                      : "bg-green-100 text-green-600"
                  )}
                >
                  {order.status === "cooking" ? "調理中" : "呼出中"}
                </span>
              </div>

              <div className="space-y-0.5">
                {(order.items as OrderItem[]).map((item, i) => (
                  <div key={i} className="text-sm text-gray-600">
                    {item.product_name}
                    {item.quantity > 1 ? ` ×${item.quantity}` : ""}
                  </div>
                ))}
              </div>

              <div className="mt-1 text-xs text-center font-bold text-gray-400 border-t pt-2">
                {order.status === "cooking" ? "タップ → 呼び出し" : "タップ → 完了"}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
