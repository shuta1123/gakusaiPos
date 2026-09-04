// 実行環境から注入される公開設定（ブラウザから参照される値）。
export const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8001/api";

export const REVERB = {
  appKey: process.env.NEXT_PUBLIC_REVERB_APP_KEY ?? "",
  host: process.env.NEXT_PUBLIC_REVERB_HOST ?? "localhost",
  port: Number(process.env.NEXT_PUBLIC_REVERB_PORT ?? "8080"),
  scheme: process.env.NEXT_PUBLIC_REVERB_SCHEME ?? "http",
} as const;
