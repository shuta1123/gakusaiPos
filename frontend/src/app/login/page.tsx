export default function LoginPage() {
  return (
    <main className="mx-auto flex max-w-sm flex-1 flex-col justify-center gap-4 p-8">
      <h1 className="text-2xl font-bold">スタッフログイン</h1>
      <p className="text-sm opacity-70">
        共通パスワードでログインします（フェーズ1の骨格）。
      </p>
      <form className="flex flex-col gap-3">
        <input
          type="password"
          placeholder="共通パスワード"
          disabled
          className="rounded-lg border border-black/15 px-4 py-3 dark:border-white/20"
        />
        <button
          type="button"
          disabled
          className="rounded-lg border border-black/15 px-4 py-3 font-medium opacity-60 dark:border-white/20"
        >
          ログイン
        </button>
      </form>
      <p className="text-xs opacity-50">
        ※ 認証処理は後続フェーズで実装します（POST /api/auth/login）。
      </p>
    </main>
  );
}
