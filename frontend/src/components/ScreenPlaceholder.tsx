import Link from "next/link";

type Props = {
  title: string;
  description: string;
  /** 認証が必要な画面か（客用/order以外はtrue） */
  requiresAuth?: boolean;
};

/**
 * フェーズ1のルーティング確認用プレースホルダー。
 * UI本体は後続フェーズで実装する。
 */
export default function ScreenPlaceholder({
  title,
  description,
  requiresAuth = true,
}: Props) {
  return (
    <main className="mx-auto flex max-w-2xl flex-1 flex-col justify-center gap-4 p-8">
      <div className="flex items-center gap-2">
        <h1 className="text-2xl font-bold">{title}</h1>
        <span className="rounded-full border border-black/15 px-2 py-0.5 text-xs opacity-70 dark:border-white/20">
          {requiresAuth ? "要ログイン" : "認証なし"}
        </span>
      </div>
      <p className="text-sm opacity-70">{description}</p>
      <p className="text-xs opacity-50">
        ※ この画面はフェーズ1の骨格です。UIは後続フェーズで実装します。
      </p>
      <Link href="/select" className="text-sm underline opacity-70">
        ← 画面選択へ
      </Link>
    </main>
  );
}
