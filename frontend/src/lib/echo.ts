import Echo from "laravel-echo";
import Pusher from "pusher-js";
import { REVERB } from "./config";

// laravel-echo が内部で参照する Pusher をグローバルに登録。
declare global {
  interface Window {
    Pusher: typeof Pusher;
    Echo?: Echo<"reverb">;
  }
}

let echo: Echo<"reverb"> | null = null;

/**
 * Reverb(WebSocket) に接続する Echo シングルトンを返す。
 * appKey 未設定などで生成に失敗した場合は null（呼び出し側はポーリングにフォールバック）。
 */
export function getEcho(): Echo<"reverb"> | null {
  if (typeof window === "undefined") return null;
  if (echo) return echo;
  if (!REVERB.appKey) return null;

  try {
    window.Pusher = Pusher;
    echo = new Echo({
      broadcaster: "reverb",
      key: REVERB.appKey,
      wsHost: REVERB.host,
      wsPort: REVERB.port,
      wssPort: REVERB.port,
      forceTLS: REVERB.scheme === "https",
      enabledTransports: ["ws", "wss"],
    });
    window.Echo = echo;
    return echo;
  } catch {
    echo = null;
    return null;
  }
}

export function disconnectEcho(): void {
  try {
    echo?.disconnect();
  } catch {
    /* noop */
  }
  echo = null;
  if (typeof window !== "undefined") window.Echo = undefined;
}
