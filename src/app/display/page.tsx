"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { Order } from "@/types";

export default function DisplayPage() {
  const [cookingOrders, setCookingOrders] = useState<Order[]>([]);
  const [readyOrders, setReadyOrders] = useState<Order[]>([]);
  const removedOrderIds = useRef<Set<string>>(new Set());

  useEffect(() => {
    const fetchOrders = async () => {
      const { data } = await supabase
        .from("orders")
        .select("*")
        .in("status", ["cooking", "ready"])
        .order("created_at", { ascending: true });
      if (data) {
        const orders = data as Order[];
        setCookingOrders((prev) => {
          const merged = [...prev];
          for (const o of orders.filter((o) => o.status === "cooking")) {
            if (!removedOrderIds.current.has(o.id) && !merged.some((p) => p.id === o.id)) merged.push(o);
          }
          return merged.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
        });
        setReadyOrders((prev) => {
          const merged = [...prev];
          for (const o of orders.filter((o) => o.status === "ready")) {
            if (!removedOrderIds.current.has(o.id) && !merged.some((p) => p.id === o.id)) merged.push(o);
          }
          return merged.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
        });
      }
    };

    const channel = supabase
      .channel("display-orders")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, (payload) => {
        if (payload.eventType === "INSERT") {
          const order = payload.new as Order;
          if (order.status === "cooking") {
            setCookingOrders((prev) => {
              if (prev.some((o) => o.id === order.id)) return prev;
              return [...prev, order].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
            });
          }
        } else if (payload.eventType === "UPDATE") {
          const order = payload.new as Order;
          if (order.status === "cooking") {
            setCookingOrders((prev) => {
              if (prev.some((o) => o.id === order.id)) return prev.map((o) => (o.id === order.id ? order : o));
              return [...prev, order].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
            });
            setReadyOrders((prev) => prev.filter((o) => o.id !== order.id));
          } else if (order.status === "ready") {
            setCookingOrders((prev) => prev.filter((o) => o.id !== order.id));
            setReadyOrders((prev) => {
              if (prev.some((o) => o.id === order.id)) return prev;
              return [...prev, order].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
            });
          } else if (order.status === "done") {
            removedOrderIds.current.add(order.id);
            setCookingOrders((prev) => prev.filter((o) => o.id !== order.id));
            setReadyOrders((prev) => prev.filter((o) => o.id !== order.id));
          }
        } else if (payload.eventType === "DELETE") {
          const id = (payload.old as Order).id;
          removedOrderIds.current.add(id);
          setCookingOrders((prev) => prev.filter((o) => o.id !== id));
          setReadyOrders((prev) => prev.filter((o) => o.id !== id));
        }
      })
      .subscribe((status) => {
        if (status === "SUBSCRIBED") fetchOrders();
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return (
    <div className="flex h-screen bg-gray-900 text-white overflow-hidden">
      {/* 調理中エリア */}
      <div className="flex-1 flex flex-col border-r border-gray-700">
        <div className="py-5 bg-gray-800 text-center text-2xl font-bold tracking-widest text-yellow-400">
          調理中
        </div>
        <div className="flex-1 overflow-y-auto p-6 grid grid-cols-3 gap-4 content-start">
          {cookingOrders.map((order) => (
            <div
              key={order.id}
              className="bg-gray-800 rounded-2xl flex items-center justify-center aspect-square"
            >
              <span className="text-5xl font-black text-white">{order.order_number}</span>
            </div>
          ))}
          {cookingOrders.length === 0 && (
            <div className="col-span-3 flex items-center justify-center h-40 text-gray-600 text-xl">
              しばらくお待ちください
            </div>
          )}
        </div>
      </div>

      {/* お呼び出しエリア */}
      <div className="flex-1 flex flex-col">
        <div className="py-5 bg-green-900 text-center text-2xl font-bold tracking-widest text-green-300">
          お呼び出し
        </div>
        <div className="flex-1 overflow-y-auto p-6 grid grid-cols-3 gap-4 content-start">
          {readyOrders.map((order) => (
            <div
              key={order.id}
              className="bg-green-900 rounded-2xl flex items-center justify-center aspect-square border-2 border-green-500"
            >
              <span className="text-5xl font-black text-green-300">{order.order_number}</span>
            </div>
          ))}
          {readyOrders.length === 0 && (
            <div className="col-span-3 flex items-center justify-center h-40 text-gray-600 text-xl">
              −
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
