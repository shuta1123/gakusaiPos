import AuthGuard from "@/components/AuthGuard";
import ScreenPlaceholder from "@/components/ScreenPlaceholder";

export default function CashierPage() {
  return (
    <AuthGuard>
      <ScreenPlaceholder
        title="会計"
        description="対面注文の会計。お釣り計算と番号発番（会計1=1XX / 会計2=2XX）。担当レジは画面選択から ?register= で受け取る。"
      />
    </AuthGuard>
  );
}
