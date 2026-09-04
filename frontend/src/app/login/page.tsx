"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { authApi, ApiError } from "@/lib/api";
import { isLoggedIn, setToken } from "@/lib/auth";

export default function LoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // 既にログイン済みなら画面選択へ。
  useEffect(() => {
    if (isLoggedIn()) router.replace("/select");
  }, [router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const { token } = await authApi.login(password);
      setToken(token);
      router.replace("/select");
    } catch (err) {
      setError(
        err instanceof ApiError && err.status === 401
          ? "パスワードが違います"
          : "ログインに失敗しました",
      );
      setSubmitting(false);
    }
  }

  return (
    <main className="mx-auto flex max-w-sm flex-1 flex-col justify-center gap-4 p-8">
      <h1 className="text-2xl font-bold">スタッフログイン</h1>
      <form className="flex flex-col gap-3" onSubmit={handleSubmit}>
        <input
          type="password"
          inputMode="text"
          autoFocus
          placeholder="共通パスワード"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="rounded-lg border border-black/15 px-4 py-3 dark:border-white/20"
        />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={submitting || password.length === 0}
          className="rounded-lg bg-black px-4 py-3 font-medium text-white disabled:opacity-50 dark:bg-white dark:text-black"
        >
          {submitting ? "ログイン中…" : "ログイン"}
        </button>
      </form>
    </main>
  );
}
