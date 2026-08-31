import Link from "next/link";

const screens: { href: string; label: string }[] = [
  { href: "/cashier?register=会計1", label: "会計1" },
  { href: "/cashier?register=会計2", label: "会計2" },
  { href: "/cooking", label: "調理担当" },
  { href: "/kitchen", label: "受け渡し（管理）" },
  { href: "/display", label: "受け渡し（客向け）" },
  { href: "/order", label: "モバイルオーダー" },
];

export default function SelectPage() {
  return (
    <main className="mx-auto flex max-w-3xl flex-1 flex-col justify-center gap-6 p-8">
      <h1 className="text-center text-2xl font-bold">画面選択</h1>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        {screens.map((s) => (
          <Link
            key={s.label}
            href={s.href}
            className="flex aspect-square items-center justify-center rounded-xl border border-black/15 p-4 text-center font-medium hover:bg-black/5 dark:border-white/20 dark:hover:bg-white/10"
          >
            {s.label}
          </Link>
        ))}
      </div>
    </main>
  );
}
