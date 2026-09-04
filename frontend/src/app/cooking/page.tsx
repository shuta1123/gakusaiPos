import AuthGuard from "@/components/AuthGuard";
import ScreenPlaceholder from "@/components/ScreenPlaceholder";

export default function CookingPage() {
  return (
    <AuthGuard>
      <ScreenPlaceholder
        title="調理担当"
        description="注文番号×品目の表形式。0の品目行は非表示、10件超で次の段へ折り返し。スペースキー／番号タップで先頭注文を完了。列幅72px固定・左詰め・数字32px。"
      />
    </AuthGuard>
  );
}
