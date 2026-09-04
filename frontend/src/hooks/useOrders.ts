"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { orderApi, type Order, type OrderSource, type OrderStatus } from "@/lib/api";
import { getEcho } from "@/lib/echo";

type Filter = { status?: OrderStatus; source?: OrderSource };

type UseOrdersResult = {
  orders: Order[];
  loading: boolean;
  error: string | null;
  /** WebSocket 接続中かどうか（false の間はポーリングで代替） */
  connected: boolean;
  /** 再取得。完了まで待てるよう Promise を返す。 */
  refresh: () => Promise<void>;
};

const POLL_INTERVAL_MS = 5000;

/**
 * 注文一覧をリアルタイムに購読するフック。
 * WebSocket(Reverb) 接続時はイベントで更新し、未接続時はポーリングにフォールバックする。
 */
export function useOrders(filter: Filter = {}): UseOrdersResult {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);

  // filter はオブジェクトなので依存を安定化するため個別値で扱う。
  const { status, source } = filter;

  // アンマウント後のsetStateと、古いレスポンスによる上書きを防ぐガード。
  const aliveRef = useRef(true);
  const seqRef = useRef(0);
  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
    };
  }, []);

  const fetchOrders = useCallback(async () => {
    const seq = ++seqRef.current;
    const stale = () => !aliveRef.current || seq !== seqRef.current;
    try {
      const data = await orderApi.list({ status, source });
      if (stale()) return;
      setOrders(data);
      setError(null);
    } catch (e) {
      if (stale()) return;
      setError(e instanceof Error ? e.message : "取得に失敗しました");
    } finally {
      if (!stale()) setLoading(false);
    }
  }, [status, source]);

  // 最新の fetchOrders を ref 経由で参照し、購読の再設定を避ける。
  const fetchRef = useRef(fetchOrders);
  useEffect(() => {
    fetchRef.current = fetchOrders;
  }, [fetchOrders]);

  useEffect(() => {
    let disposed = false;
    let pollTimer: ReturnType<typeof setInterval> | null = null;

    const startPolling = () => {
      if (pollTimer) return;
      pollTimer = setInterval(() => fetchRef.current(), POLL_INTERVAL_MS);
    };
    const stopPolling = () => {
      if (pollTimer) {
        clearInterval(pollTimer);
        pollTimer = null;
      }
    };

    // 初回取得
    fetchRef.current();

    const echo = getEcho();
    if (echo) {
      const channel = echo.channel("orders");
      const onAny = () => fetchRef.current();
      channel.listen(".order.created", onAny);
      channel.listen(".order.status_updated", onAny);
      channel.listen(".order.cancelled", onAny);

      // 接続状態を監視し、未接続の間だけポーリングする。
      const connector = (
        echo.connector as { pusher?: { connection?: PusherConnection } }
      ).pusher;
      const conn = connector?.connection;
      const sync = () => {
        if (disposed || !conn) return;
        const isConnected = conn.state === "connected";
        setConnected(isConnected);
        if (isConnected) stopPolling();
        else startPolling();
      };
      if (conn) {
        conn.bind("state_change", sync);
        sync();
      } else {
        startPolling();
      }

      return () => {
        disposed = true;
        stopPolling();
        conn?.unbind?.("state_change", sync);
        // このフック分のリスナーのみ解除する（同一チャンネルを購読する
        // 別の useOrders を巻き込んで leaveChannel しない）。
        try {
          channel.stopListening(".order.created", onAny);
          channel.stopListening(".order.status_updated", onAny);
          channel.stopListening(".order.cancelled", onAny);
        } catch {
          /* noop */
        }
      };
    }

    // Echo 生成不可 → 常時ポーリング
    startPolling();
    return () => {
      disposed = true;
      stopPolling();
    };
  }, [status, source]);

  // 参照を安定させ、利用側の useCallback 依存が毎回変わらないようにする。
  const refresh = useCallback(() => fetchRef.current(), []);

  return { orders, loading, error, connected, refresh };
}

type PusherConnection = {
  state: "initialized" | "connecting" | "connected" | "unavailable" | "failed" | "disconnected";
  bind: (event: string, cb: () => void) => void;
  unbind?: (event: string, cb: () => void) => void;
};
