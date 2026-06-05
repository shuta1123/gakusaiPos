import Link from "next/link";

const screens = [
  { href: "/customer", label: "客用注文画面", desc: "注文内容の確認" },
  { href: "/pos", label: "店用注文画面 (POS)", desc: "注文入力・会計" },
  { href: "/kitchen", label: "店用作成画面", desc: "調理中オーダー管理" },
  { href: "/display", label: "客用待ち番号表示", desc: "番号案内" },
  { href: "/manage", label: "店用表示管理画面", desc: "呼び出し・完了操作" },
  { href: "/order", label: "スマホ注文画面", desc: "来客セルフ注文" },
];

export default function Home() {
  return (
    <main className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-8">
      <h1 className="text-3xl font-bold mb-2">学祭 POS システム</h1>
      <p className="text-gray-500 mb-10">画面を選択してください</p>
      <div className="grid grid-cols-2 gap-4 w-full max-w-2xl">
        {screens.map((s) => (
          <Link
            key={s.href}
            href={s.href}
            className="bg-white rounded-xl border border-gray-200 p-6 hover:shadow-md transition-shadow"
          >
            <div className="text-lg font-semibold">{s.label}</div>
            <div className="text-sm text-gray-500 mt-1">{s.desc}</div>
          </Link>
        ))}
      </div>
    </main>
  );
}
