import { API_BASE } from "./config";
import { clearToken, getToken } from "./auth";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public body?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

type ApiOptions = {
  method?: string;
  body?: unknown;
  /** true の場合、401 でもトークンを消さない（ログイン試行など） */
  skipAuthReset?: boolean;
  signal?: AbortSignal;
};

/**
 * バックエンド API を叩く共通クライアント。
 * - 保存済みトークンを Authorization: Bearer で付与
 * - 401 の場合はトークンを破棄（呼び出し側でログインへ誘導）
 */
export async function api<T = unknown>(
  path: string,
  options: ApiOptions = {},
): Promise<T> {
  const { method = "GET", body, skipAuthReset = false, signal } = options;

  const headers: Record<string, string> = {
    Accept: "application/json",
  };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers["Content-Type"] = "application/json";

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    signal,
  });

  if (res.status === 401 && !skipAuthReset) {
    clearToken();
  }

  const isJson = res.headers.get("content-type")?.includes("application/json");
  const data = isJson ? await res.json().catch(() => undefined) : undefined;

  if (!res.ok) {
    const message =
      (data as { message?: string } | undefined)?.message ??
      `リクエストに失敗しました (${res.status})`;
    throw new ApiError(res.status, message, data);
  }

  return data as T;
}

// --- 型定義 ---
export type Product = {
  id: number;
  name: string;
  price: number;
  is_sold_out: boolean;
};

export type OrderSource = "会計1" | "会計2";
export type OrderStatus =
  | "注文完了"
  | "会計完了"
  | "準備完了"
  | "呼び出し中"
  | "受け渡し完了"
  | "キャンセル";

export type OrderItem = {
  id: number;
  order_id: number;
  product_id: number;
  quantity: number;
  unit_price: number;
  product?: Product;
};

export type Order = {
  id: number;
  number: number;
  source: OrderSource;
  status: OrderStatus;
  discount: number;
  created_at: string;
  items?: OrderItem[];
};

// --- エンドポイントラッパー ---
export const authApi = {
  login: (password: string) =>
    api<{ token: string }>("/auth/login", {
      method: "POST",
      body: { password },
      skipAuthReset: true,
    }),
  logout: () => api("/auth/logout", { method: "POST" }),
};

export const productApi = {
  list: () => api<Product[]>("/products"),
  update: (id: number, patch: Partial<Pick<Product, "is_sold_out" | "price">>) =>
    api<Product>(`/products/${id}`, { method: "PATCH", body: patch }),
};

export const orderApi = {
  list: (params?: { status?: OrderStatus; source?: OrderSource }) => {
    const q = new URLSearchParams();
    if (params?.status) q.set("status", params.status);
    if (params?.source) q.set("source", params.source);
    const qs = q.toString();
    return api<Order[]>(`/orders${qs ? `?${qs}` : ""}`);
  },
  get: (id: number) => api<Order>(`/orders/${id}`),
  create: (payload: {
    source: OrderSource;
    items: { product_id: number; quantity: number }[];
    status?: OrderStatus;
    discount?: number;
  }) => api<Order>("/orders", { method: "POST", body: payload }),
  updateStatus: (id: number, status: OrderStatus) =>
    api<Order>(`/orders/${id}/status`, { method: "PATCH", body: { status } }),
  cancel: (id: number) => api(`/orders/${id}`, { method: "DELETE" }),
  nextNumber: (source: OrderSource) =>
    api<{ number: number }>(
      `/orders/next-number?source=${encodeURIComponent(source)}`,
    ),
};
