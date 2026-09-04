import AuthGuard from "@/components/AuthGuard";
import ScreenPlaceholder from "@/components/ScreenPlaceholder";

export default function KitchenPage() {
  return (
    <AuthGuard>
      <ScreenPlaceholder
        title="受け渡し（管理）"
        description="準備完了・受け渡し完了の操作と履歴管理を行うスタッフ向け画面。"
      />
    </AuthGuard>
  );
}
