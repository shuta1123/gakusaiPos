import ScreenPlaceholder from "@/components/ScreenPlaceholder";

export default function OrderPage() {
  return (
    <ScreenPlaceholder
      title="モバイルオーダー"
      description="客がスマホから注文・変更・キャンセル（会計前まで）を行う画面。番号帯は 7XX。"
      requiresAuth={false}
    />
  );
}
