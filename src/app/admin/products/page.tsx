"use client";

import { useEffect, useState, useRef } from "react";
import { supabase } from "@/lib/supabase";
import type { Product } from "@/types";

interface ProductForm {
  name: string;
  price: string;
  category: string;
  toppingsRaw: string; // カンマ区切り
  set_box: boolean;
  is_stopped: boolean;
}

const emptyForm = (): ProductForm => ({
  name: "",
  price: "",
  category: "",
  toppingsRaw: "",
  set_box: false,
  is_stopped: false,
});

export default function AdminProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [filterCat, setFilterCat] = useState<string>("all");

  // モーダル
  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Product | null>(null);
  const [form, setForm] = useState<ProductForm>(emptyForm());
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // 削除確認
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null);
  const [deleting, setDeleting] = useState(false);

  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const load = (data: Product[]) => {
      setProducts(data);
      const cats = [...new Set(data.map((p) => p.category))].sort();
      setCategories(cats);
    };

    supabase
      .from("products")
      .select("*")
      .order("category")
      .order("name")
      .then(({ data }) => {
        if (data) load(data as Product[]);
      });

    const channel = supabase
      .channel("admin-products")
      .on("postgres_changes", { event: "*", schema: "public", table: "products" }, () => {
        supabase
          .from("products")
          .select("*")
          .order("category")
          .order("name")
          .then(({ data }) => {
            if (data) load(data as Product[]);
          });
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const openAdd = () => {
    setEditTarget(null);
    setForm(emptyForm());
    setFormError(null);
    setModalOpen(true);
    setTimeout(() => nameRef.current?.focus(), 50);
  };

  const openEdit = (p: Product) => {
    setEditTarget(p);
    setForm({
      name: p.name,
      price: String(p.price),
      category: p.category,
      toppingsRaw: p.toppings.join(", "),
      set_box: p.set_box,
      is_stopped: p.is_stopped,
    });
    setFormError(null);
    setModalOpen(true);
    setTimeout(() => nameRef.current?.focus(), 50);
  };

  const closeModal = () => {
    if (saving) return;
    setModalOpen(false);
  };

  const handleSave = async () => {
    const price = parseInt(form.price, 10);
    if (!form.name.trim()) { setFormError("商品名を入力してください。"); return; }
    if (!form.category.trim()) { setFormError("カテゴリを入力してください。"); return; }
    if (isNaN(price) || price < 0) { setFormError("価格は 0 以上の整数で入力してください。"); return; }

    const toppings = form.toppingsRaw
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);

    setSaving(true);
    setFormError(null);

    const { error } = await supabase.rpc("upsert_product", {
      p_id:         editTarget?.id ?? null,
      p_name:       form.name.trim(),
      p_price:      price,
      p_category:   form.category.trim(),
      p_toppings:   toppings,
      p_set_box:    form.set_box,
      p_is_stopped: form.is_stopped,
    });

    setSaving(false);
    if (error) {
      setFormError(error.message);
    } else {
      setModalOpen(false);
    }
  };

  const toggleStopped = async (p: Product) => {
    await supabase.rpc("upsert_product", {
      p_id:         p.id,
      p_name:       p.name,
      p_price:      p.price,
      p_category:   p.category,
      p_toppings:   p.toppings,
      p_set_box:    p.set_box,
      p_is_stopped: !p.is_stopped,
    });
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    const { error } = await supabase.rpc("delete_product", { p_id: deleteTarget.id });
    setDeleting(false);
    if (!error) setDeleteTarget(null);
  };

  const filtered = filterCat === "all"
    ? products
    : products.filter((p) => p.category === filterCat);

  return (
    <div className="max-w-5xl mx-auto">
      {/* ヘッダー */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-gray-800">商品マスタ</h2>
        <button
          onClick={openAdd}
          className="bg-orange-500 hover:bg-orange-600 text-white font-bold px-5 py-2.5 rounded-lg text-sm transition-colors"
        >
          + 新規追加
        </button>
      </div>

      {/* カテゴリフィルタ */}
      <div className="flex gap-2 mb-4 flex-wrap">
        <button
          onClick={() => setFilterCat("all")}
          className={
            "px-4 py-1.5 rounded-full text-sm font-medium transition-colors " +
            (filterCat === "all"
              ? "bg-orange-500 text-white"
              : "bg-white text-gray-600 border border-gray-300 hover:bg-gray-50")
          }
        >
          すべて ({products.length})
        </button>
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setFilterCat(cat)}
            className={
              "px-4 py-1.5 rounded-full text-sm font-medium transition-colors " +
              (filterCat === cat
                ? "bg-orange-500 text-white"
                : "bg-white text-gray-600 border border-gray-300 hover:bg-gray-50")
            }
          >
            {cat} ({products.filter((p) => p.category === cat).length})
          </button>
        ))}
      </div>

      {/* 商品テーブル */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-400">
          商品がありません
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 text-gray-600 font-medium">商品名</th>
                <th className="text-left px-4 py-3 text-gray-600 font-medium">カテゴリ</th>
                <th className="text-right px-4 py-3 text-gray-600 font-medium">価格</th>
                <th className="text-center px-4 py-3 text-gray-600 font-medium">セット箱</th>
                <th className="text-center px-4 py-3 text-gray-600 font-medium">トッピング</th>
                <th className="text-center px-4 py-3 text-gray-600 font-medium">販売停止</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((p) => (
                <tr key={p.id} className={p.is_stopped ? "bg-red-50" : "hover:bg-gray-50"}>
                  <td className="px-4 py-3 font-medium text-gray-800">
                    {p.name}
                    {p.is_stopped && (
                      <span className="ml-2 text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full">
                        停止中
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{p.category}</td>
                  <td className="px-4 py-3 text-right font-medium text-gray-800">
                    ¥{p.price.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-center text-lg">
                    {p.set_box ? "📦" : "—"}
                  </td>
                  <td className="px-4 py-3 text-center text-gray-500">
                    {p.toppings.length > 0 ? p.toppings.join(", ") : "—"}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => toggleStopped(p)}
                      className={
                        "relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none " +
                        (p.is_stopped ? "bg-red-500" : "bg-gray-300")
                      }
                    >
                      <span
                        className={
                          "inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform " +
                          (p.is_stopped ? "translate-x-6" : "translate-x-1")
                        }
                      />
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 justify-end">
                      <button
                        onClick={() => openEdit(p)}
                        className="text-blue-600 hover:text-blue-800 text-xs font-medium px-2 py-1 rounded hover:bg-blue-50 transition-colors"
                      >
                        編集
                      </button>
                      <button
                        onClick={() => setDeleteTarget(p)}
                        className="text-red-500 hover:text-red-700 text-xs font-medium px-2 py-1 rounded hover:bg-red-50 transition-colors"
                      >
                        削除
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 追加/編集モーダル */}
      {modalOpen && (
        <div
          className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
          onClick={(e) => { if (e.target === e.currentTarget) closeModal(); }}
        >
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <h3 className="text-lg font-bold text-gray-800 mb-5">
              {editTarget ? "商品を編集" : "商品を追加"}
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  商品名 <span className="text-red-500">*</span>
                </label>
                <input
                  ref={nameRef}
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                  placeholder="例: から揚げ"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    価格 (円) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={form.price}
                    onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                    placeholder="500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    カテゴリ <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    list="category-list"
                    value={form.category}
                    onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                    placeholder="例: フード"
                  />
                  <datalist id="category-list">
                    {categories.map((c) => <option key={c} value={c} />)}
                  </datalist>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  トッピング (カンマ区切り)
                </label>
                <input
                  type="text"
                  value={form.toppingsRaw}
                  onChange={(e) => setForm((f) => ({ ...f, toppingsRaw: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                  placeholder="例: マヨネーズ, ケチャップ"
                />
              </div>

              <div className="flex items-center gap-6">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={form.set_box}
                    onChange={(e) => setForm((f) => ({ ...f, set_box: e.target.checked }))}
                    className="w-4 h-4 accent-orange-500"
                  />
                  <span className="text-sm font-medium text-gray-700">セット箱あり</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={form.is_stopped}
                    onChange={(e) => setForm((f) => ({ ...f, is_stopped: e.target.checked }))}
                    className="w-4 h-4 accent-red-500"
                  />
                  <span className="text-sm font-medium text-gray-700">販売停止</span>
                </label>
              </div>
            </div>

            {formError && (
              <p className="mt-4 text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">
                {formError}
              </p>
            )}

            <div className="flex gap-3 mt-6">
              <button
                onClick={closeModal}
                disabled={saving}
                className="flex-1 border border-gray-300 text-gray-700 font-medium py-2.5 rounded-lg text-sm hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                キャンセル
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 bg-orange-500 hover:bg-orange-600 text-white font-bold py-2.5 rounded-lg text-sm transition-colors disabled:opacity-60"
              >
                {saving ? "保存中..." : "保存"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 削除確認モーダル */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 text-center">
            <div className="text-4xl mb-3">🗑️</div>
            <h3 className="text-lg font-bold text-gray-800 mb-2">商品を削除しますか？</h3>
            <p className="text-sm text-gray-500 mb-6">
              「{deleteTarget.name}」を削除します。この操作は取り消せません。
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
                className="flex-1 border border-gray-300 text-gray-700 font-medium py-2.5 rounded-lg text-sm hover:bg-gray-50 transition-colors"
              >
                キャンセル
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 bg-red-500 hover:bg-red-600 text-white font-bold py-2.5 rounded-lg text-sm transition-colors disabled:opacity-60"
              >
                {deleting ? "削除中..." : "削除する"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
