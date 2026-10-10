// スタッフ認証トークンの保存・取得。共通パスワード方式の無期限トークンを
// localStorage に保持する（客用画面は無いため全画面がこのトークンを使う）。

const TOKEN_KEY = "gakusai_pos_token";

// localStorage が使えない環境（シークレットモード等）でも同一セッション中は
// ログインを維持できるよう、メモリ上にもトークンを保持する。
let memoryToken: string | null = null;

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
    const stored = window.localStorage.getItem(TOKEN_KEY);
    if (stored !== null) return stored;
  } catch {
    /* localStorage 不可 → メモリのトークンにフォールバック */
  }
  return memoryToken;
}

export function setToken(token: string): void {
  // localStorage が使えなくてもメモリで維持する。
  memoryToken = token;
  try {
    window.localStorage.setItem(TOKEN_KEY, token);
  } catch {
    /* localStorage 不可の環境ではメモリのみで継続 */
  }
  notify();
}

export function clearToken(): void {
  memoryToken = null;
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
