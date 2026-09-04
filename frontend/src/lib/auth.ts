// スタッフ認証トークンの保存・取得。共通パスワード方式の無期限トークンを
// localStorage に保持する（客用画面は無いため全画面がこのトークンを使う）。

const TOKEN_KEY = "gakusai_pos_token";

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
}

export function clearToken(): void {
  try {
    window.localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* noop */
  }
}

export function isLoggedIn(): boolean {
  return getToken() !== null;
}
