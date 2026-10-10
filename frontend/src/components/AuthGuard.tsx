"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getToken, onAuthChange } from "@/lib/auth";

type Status = "checking" | "in" | "out";

/**
 * スタッフ用画面をラップし、未ログインなら /login へリダイレクトする。
 * 判定はマウント後の effect で毎回 getToken() を実クライアントで読む（SSR/ハイドレーション
 * のスナップショットに依存しない）。同一タブ(onAuthChange)・他タブ(storage)の変更も購読。
 */
export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [status, setStatus] = useState<Status>("checking");

  useEffect(() => {
    const check = () => {
      if (getToken() !== null) {
        setStatus("in");
      } else {
        setStatus("out");
        router.replace("/login");
      }
    };
    check();
    const off = onAuthChange(check);
    window.addEventListener("storage", check);
    return () => {
      off();
      window.removeEventListener("storage", check);
    };
  }, [router]);

  if (status === "in") {
    return <>{children}</>;
  }

  // out（/login へ遷移中）は何も描画しない。checking は読み込み表示。
  if (status === "out") {
    return null;
  }
  return (
    <main className="flex flex-1 items-center justify-center p-8">
      <p className="text-sm opacity-60">読み込み中…</p>
    </main>
  );
}
