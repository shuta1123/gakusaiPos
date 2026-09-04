// スタッフ認証トークンの保存・取得。共通パスワード方式の無期限トークンを
// localStorage に保持する（客用画面は無いため全画面がこのトークンを使う）。

const TOKEN_KEY = "gakusai_pos_token";

// 同一タブ内のトークン変更を購読するためのリスナー群。
// localStorage の "storage" イベントは他タブ変更しか発火しないため、
// 同一タブでの setToken/clearToken を通知する仕組みを別途用意する。
const listeners = new Set<() => void>();

function notify(): void {
  listeners.forEach((cb) => cb());
}

/** トークン変更（同一タブ）を購読する。返り値で解除。 */
export function onAuthChange(callback: () => void): () => void {
  listeners.add(callback);
  return () => {
    listeners.delete(callback);
  };
}

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string): void {
  try {
    window.localStorage.setItem(TOKEN_KEY, token);
  } catch {
    /* localStorage 不可の環境では何もしない */
  }
  notify();
}

export function clearToken(): void {
  try {
    window.localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* noop */
  }
  notify();
}

export function isLoggedIn(): boolean {
  return getToken() !== null;
}
