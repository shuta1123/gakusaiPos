import Link from "next/link";

export default function Home() {
  return (
    <main className="mx-auto flex max-w-md flex-1 flex-col justify-center gap-6 p-8 text-center">
      <h1 className="text-2xl font-bold">学祭POS</h1>
      <p className="text-sm opacity-70">大学祭向けPOSシステム（スタッフ用）</p>
      <Link
        href="/login"
        className="rounded-lg bg-black px-4 py-3 font-medium text-white hover:opacity-90 dark:bg-white dark:text-black"
      >
        スタッフログイン
      </Link>
    </main>
  );
}
