"use client";

import { useEffect, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { getToken, onAuthChange } from "@/lib/auth";

function subscribe(callback: () => void) {
  // 他タブ変更（storage）と同一タブ変更（onAuthChange）の両方を購読する。
  window.addEventListener("storage", callback);
  const off = onAuthChange(callback);
  return () => {
    window.removeEventListener("storage", callback);
    off();
  };
}

/**
 * スタッフ用画面をラップし、未ログインなら /login へリダイレクトする。
 * ログイン状態は localStorage を外部ストアとして購読する（SSR時は未ログイン扱い）。
 */
export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const loggedIn = useSyncExternalStore(
    subscribe,
    () => getToken() !== null,
    () => false,
  );

  useEffect(() => {
    if (!loggedIn) router.replace("/login");
  }, [loggedIn, router]);

  if (!loggedIn) {
    return (
      <main className="flex flex-1 items-center justify-center p-8">
        <p className="text-sm opacity-60">読み込み中…</p>
      </main>
    );
  }

  return <>{children}</>;
}
