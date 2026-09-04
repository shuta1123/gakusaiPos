import Link from "next/link";

export default function Home() {
  return (
    <main className="mx-auto flex max-w-md flex-1 flex-col justify-center gap-6 p-8 text-center">
      <h1 className="text-2xl font-bold">学祭POS</h1>
      <p className="text-sm opacity-70">
        大学祭向けPOS・モバイルオーダーシステム
      </p>
      <div className="flex flex-col gap-3">
        <Link
          href="/login"
          className="rounded-lg border border-black/15 px-4 py-3 font-medium hover:bg-black/5 dark:border-white/20 dark:hover:bg-white/10"
        >
          スタッフログイン
        </Link>
        <Link
          href="/order"
          className="rounded-lg border border-black/15 px-4 py-3 font-medium hover:bg-black/5 dark:border-white/20 dark:hover:bg-white/10"
        >
          モバイルオーダー（客用）
        </Link>
      </div>
    </main>
  );
}
