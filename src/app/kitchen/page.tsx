"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { Order, OrderItem } from "@/types";
import { cn } from "@/lib/utils";

function useElapsedSeconds(createdAt: string) {
  const [seconds, setSeconds] = useState(() =>
    Math.floor((Date.now() - new Date(createdAt).getTime()) / 1000)
  );
  useEffect(() => {
    const id = setInterval(() => {
      setSeconds(Math.floor((Date.now() - new Date(createdAt).getTime()) / 1000));
    }, 1000);
    return () => clearInterval(id);
  }, [createdAt]);
  return seconds;
}

function formatTime(seconds: number) {
  const m = Math.floor(seconds / 60).toString().padStart(2, "0");
  const s = (seconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

function OrderCard({ order }: { order: Order }) {
  const elapsed = useElapsedSeconds(order.created_at);
  const isWarning = elapsed >= 300;
  const isDanger = elapsed >= 600;

  return (
    <div
      className={cn(
        "rounded-2xl p-4 flex flex-col gap-2 border-2 transition-colors",
        isDanger
          ? "bg-red-50 border-red-400"
          : isWarning
          ? "bg-yellow-50 border-yellow-400"
          : "bg-white border-gray-200"
      )}
    >
      <div className="flex items-center justify-between">
        <span
          className={cn(
            "text-3xl font-black",
            isDanger ? "text-red-600" : "text-gray-800"
          )}
        >
          #{order.order_number}
        </span>
        <span
          className={cn(
            "text-lg font-mono font-bold",
            isDanger ? "text-red-600" : isWarning ? "text-yellow-600" : "text-gray-500"
          )}
        >
          {formatTime(elapsed)}
        </span>
      </div>

      <div className="space-y-1">
        {(order.items as OrderItem[]).map((item, i) => (
          <div key={i} className="text-sm">
            <span className="font-semibold">{item.product_name}</span>
            {item.quantity > 1 && (
              <span className="text-gray-500"> × {item.quantity}</span>
            )}
            {Array.isArray(item.toppings) && item.toppings.length > 0 && (
              <div className="text-xs text-gray-400 ml-2">
                + {item.toppings.join(", ")}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function KitchenPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const removedOrderIds = useRef<Set<string>>(new Set());

  useEffect(() => {
    const fetchOrders = async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("*")
        .eq("status", "cooking")
        .order("created_at", { ascending: true });
      if (error) {
        setFetchError("注文データの取得に失敗しました: " + error.message);
        return;
      }
      if (data) {
        const snapshot = data as Order[];
        setOrders((prev) => {
          const merged = [...prev];
          for (const o of snapshot) {
            if (!removedOrderIds.current.has(o.id) && !merged.some((p) => p.id === o.id)) merged.push(o);
          }
          return merged.sort(
            (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
          );
        });
      }
    };

    // subscribe してから初期データ取得（購読前の INSERT を見逃さないため）
    const channel = supabase
      .channel("kitchen-orders")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders" },
        (payload) => {
          if (payload.eventType === "INSERT") {
            const order = payload.new as Order;
            if (order.status === "cooking") {
              setOrders((prev) => {
                if (prev.some((o) => o.id === order.id)) return prev;
                return [...prev, order].sort(
                  (a, b) =>
                    new Date(a.created_at).getTime() -
                    new Date(b.created_at).getTime()
                );
              });
            }
          } else if (payload.eventType === "UPDATE") {
            const order = payload.new as Order;
            setOrders((prev) => {
              if (order.status !== "cooking") {
                removedOrderIds.current.add(order.id);
                return prev.filter((o) => o.id !== order.id);
              }
              if (prev.some((o) => o.id === order.id)) {
                return prev.map((o) => (o.id === order.id ? order : o));
              }
              return [...prev, order].sort(
                (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
              );
            });
          } else if (payload.eventType === "DELETE") {
            setOrders((prev) =>
              prev.filter((o) => o.id !== (payload.old as Order).id)
            );
          }
        }
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          // 購読確立後にスナップショット取得（間の INSERT を Realtime で受け取れる状態）
          fetchOrders();
        } else if (status === "CHANNEL_ERROR") {
          setFetchError("リアルタイム接続に失敗しました。画面を再読み込みしてください。");
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  if (fetchError) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="bg-white rounded-2xl p-8 max-w-sm w-full text-center border-2 border-red-300">
          <div className="text-4xl mb-4">⚠️</div>
          <h2 className="text-xl font-bold text-red-600 mb-2">接続エラー</h2>
          <p className="text-gray-600 text-sm mb-6">{fetchError}</p>
          <button
            onClick={() => window.location.reload()}
            className="w-full py-3 bg-red-500 text-white font-bold rounded-xl"
          >
            再読み込み
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 p-4">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">調理中オーダー</h1>
        <div className="flex gap-4 text-sm text-gray-500">
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-full bg-yellow-400 inline-block" />
            5分超
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-full bg-red-400 inline-block" />
            10分超
          </span>
        </div>
      </div>

      {orders.length === 0 ? (
        <div className="flex items-center justify-center h-64 text-gray-400 text-xl">
          調理中のオーダーはありません
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
          {orders.map((order) => (
            <OrderCard key={order.id} order={order} />
          ))}
        </div>
      )}
    </div>
  );
}
