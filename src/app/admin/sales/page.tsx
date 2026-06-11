"use client";

import { useEffect, useState, useRef } from "react";
import { supabase } from "@/lib/supabase";
import type { Order } from "@/types";

export default function AdminSalesPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [resetting, setResetting] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const removedOrderIds = useRef<Set<string>>(new Set());

  useEffect(() => {
    const channel = supabase
      .channel("admin-sales")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "orders" },
        (payload) => {
          const order = payload.new as Order;
          if (removedOrderIds.current.has(order.id)) return;
          setOrders((prev) => {
            if (prev.some((o) => o.id === order.id)) return prev;
            return [...prev, order];
          });
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "orders" },
        (payload) => {
          const updated = payload.new as Order;
          setOrders((prev) =>
            prev.map((o) => (o.id === updated.id ? updated : o))
          );
        }
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "orders" },
        (payload) => {
          const id = (payload.old as { id: string }).id;
          removedOrderIds.current.add(id);
          setOrders((prev) => prev.filter((o) => o.id !== id));
        }
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          supabase
            .from("orders")
            .select("*")
            .order("created_at", { ascending: false })
            .then(({ data }) => {
              if (data) {
                const filtered = (data as Order[]).filter(
                  (o) => !removedOrderIds.current.has(o.id)
                );
                setOrders(filtered);
              }
            });
        }
      });

    return () => { supabase.removeChannel(channel); };
  }, []);

  const totalSales = orders.reduce((sum, o) => sum + o.total_price, 0);
  const totalDiscount = orders.reduce((sum, o) => sum + o.discount, 0);
  const posOrders = orders.filter((o) => o.source === "pos");
  const spOrders = orders.filter((o) => o.source === "smartphone");

  const handleReset = async () => {
    setResetting(true);
    await supabase.rpc("reset_order_numbers");
    setResetting(false);
    setConfirmReset(false);
  };

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" });
  };

  const statusLabel = (s: string) => {
    if (s === "cooking") return { label: "調理中", cls: "bg-yellow-100 text-yellow-700" };
    if (s === "ready")   return { label: "呼出済", cls: "bg-green-100 text-green-700" };
    return { label: "完了", cls: "bg-gray-100 text-gray-500" };
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-800">売上</h2>
        <button
          onClick={() => setConfirmReset(true)}
          className="border border-red-300 text-red-600 hover:bg-red-50 font-medium px-4 py-2 rounded-lg text-sm transition-colors"
        >
          注文番号リセット
        </button>
      </div>

      {/* サマリーカード */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="合計売上" value={`¥${totalSales.toLocaleString()}`} color="orange" />
        <StatCard label="注文数" value={`${orders.length} 件`} color="blue" />
        <StatCard label="割引総額" value={`¥${totalDiscount.toLocaleString()}`} color="red" />
        <StatCard
          label="客単価"
          value={orders.length > 0 ? `¥${Math.round(totalSales / orders.length).toLocaleString()}` : "—"}
          color="green"
        />
      </div>

      {/* 内訳 */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500 mb-1">POS レジ</p>
          <p className="text-2xl font-bold text-gray-800">
            ¥{posOrders.reduce((s, o) => s + o.total_price, 0).toLocaleString()}
          </p>
          <p className="text-sm text-gray-500 mt-1">{posOrders.length} 件</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500 mb-1">スマホ注文</p>
          <p className="text-2xl font-bold text-gray-800">
            ¥{spOrders.reduce((s, o) => s + o.total_price, 0).toLocaleString()}
          </p>
          <p className="text-sm text-gray-500 mt-1">{spOrders.length} 件</p>
        </div>
      </div>

      {/* 注文一覧 */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
          <p className="text-sm font-medium text-gray-700">注文一覧 (新しい順)</p>
        </div>
        {orders.length === 0 ? (
          <p className="text-center text-gray-400 py-10 text-sm">注文がありません</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-xs text-gray-500">
                  <th className="text-left px-4 py-2 font-medium">番号</th>
                  <th className="text-left px-4 py-2 font-medium">時刻</th>
                  <th className="text-left px-4 py-2 font-medium">内容</th>
                  <th className="text-right px-4 py-2 font-medium">小計</th>
                  <th className="text-right px-4 py-2 font-medium">割引</th>
                  <th className="text-right px-4 py-2 font-medium">合計</th>
                  <th className="text-center px-4 py-2 font-medium">経路</th>
                  <th className="text-center px-4 py-2 font-medium">状態</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {[...orders]
                  .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                  .map((o) => {
                    const st = statusLabel(o.status);
                    const subtotal = o.total_price + o.discount;
                    return (
                      <tr key={o.id} className="hover:bg-gray-50">
                        <td className="px-4 py-2.5 font-bold text-gray-800">
                          #{o.order_number}
                        </td>
                        <td className="px-4 py-2.5 text-gray-500">{formatTime(o.created_at)}</td>
                        <td className="px-4 py-2.5 text-gray-600 max-w-[220px]">
                          <span className="truncate block">
                            {o.items.map((i) => `${i.product_name}×${i.quantity}`).join(" / ")}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-right text-gray-600">
                          ¥{subtotal.toLocaleString()}
                        </td>
                        <td className="px-4 py-2.5 text-right text-red-500">
                          {o.discount > 0 ? `-¥${o.discount.toLocaleString()}` : "—"}
                        </td>
                        <td className="px-4 py-2.5 text-right font-bold text-gray-800">
                          ¥{o.total_price.toLocaleString()}
                        </td>
                        <td className="px-4 py-2.5 text-center">
                          <span className={
                            "text-xs px-2 py-0.5 rounded-full font-medium " +
                            (o.source === "pos"
                              ? "bg-blue-100 text-blue-600"
                              : "bg-purple-100 text-purple-600")
                          }>
                            {o.source === "pos" ? "POS" : "スマホ"}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-center">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${st.cls}`}>
                            {st.label}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* リセット確認モーダル */}
      {confirmReset && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 text-center">
            <div className="text-4xl mb-3">⚠️</div>
            <h3 className="text-lg font-bold text-gray-800 mb-2">注文番号をリセット</h3>
            <p className="text-sm text-gray-500 mb-6">
              全注文データが削除され、注文番号が初期値に戻ります。<br />
              この操作は取り消せません。
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmReset(false)}
                disabled={resetting}
                className="flex-1 border border-gray-300 text-gray-700 font-medium py-2.5 rounded-lg text-sm hover:bg-gray-50"
              >
                キャンセル
              </button>
              <button
                onClick={handleReset}
                disabled={resetting}
                className="flex-1 bg-red-500 hover:bg-red-600 text-white font-bold py-2.5 rounded-lg text-sm disabled:opacity-60"
              >
                {resetting ? "リセット中..." : "リセットする"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color: "orange" | "blue" | "red" | "green";
}) {
  const colorMap = {
    orange: "text-orange-600 bg-orange-50",
    blue:   "text-blue-600 bg-blue-50",
    red:    "text-red-600 bg-red-50",
    green:  "text-green-600 bg-green-50",
  };
  return (
    <div className={`rounded-xl p-4 ${colorMap[color]}`}>
      <p className="text-xs font-medium opacity-70 mb-1">{label}</p>
      <p className="text-2xl font-bold">{value}</p>
    </div>
  );
}
