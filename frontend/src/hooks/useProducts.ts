"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { productApi, type Product } from "@/lib/api";
import { getEcho } from "@/lib/echo";

type UseProductsResult = {
  products: Product[];
  loading: boolean;
  error: string | null;
  refresh: () => void;
};

const POLL_INTERVAL_MS = 15000;

/**
 * 商品一覧を購読するフック。
 * WebSocket(Reverb) で `product.updated`（売り切れ切替など）を受け取り、
 * 未接続時はポーリングにフォールバックする。
 */
export function useProducts(): UseProductsResult {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // アンマウント後のsetStateと、古いレスポンスによる上書きを防ぐガード。
  const aliveRef = useRef(true);
  const seqRef = useRef(0);
  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
    };
  }, []);

  const fetchProducts = useCallback(async () => {
    const seq = ++seqRef.current;
    const stale = () => !aliveRef.current || seq !== seqRef.current;
    try {
      const data = await productApi.list();
      if (stale()) return;
      setProducts(data);
      setError(null);
    } catch (e) {
      if (stale()) return;
      setError(e instanceof Error ? e.message : "商品の取得に失敗しました");
    } finally {
      if (!stale()) setLoading(false);
    }
  }, []);

  const fetchRef = useRef(fetchProducts);
  useEffect(() => {
    fetchRef.current = fetchProducts;
  }, [fetchProducts]);

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

    fetchRef.current();

    const echo = getEcho();
    if (echo) {
      const channel = echo.channel("products");
      const onUpdated = () => fetchRef.current();
      channel.listen(".product.updated", onUpdated);

      const conn = (
        echo.connector as { pusher?: { connection?: PusherConnection } }
      ).pusher?.connection;
      const sync = () => {
        if (disposed || !conn) return;
        if (conn.state === "connected") stopPolling();
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
        // このフック分のリスナーのみ解除（他の購読者を巻き込まない）。
        try {
          channel.stopListening(".product.updated", onUpdated);
        } catch {
          /* noop */
        }
      };
    }

    startPolling();
    return () => {
      disposed = true;
      stopPolling();
    };
  }, []);

  const refresh = useCallback(() => fetchRef.current(), []);

  return { products, loading, error, refresh };
}

type PusherConnection = {
  state:
    | "initialized"
    | "connecting"
    | "connected"
    | "unavailable"
    | "failed"
    | "disconnected";
  bind: (event: string, cb: () => void) => void;
  unbind?: (event: string, cb: () => void) => void;
};
