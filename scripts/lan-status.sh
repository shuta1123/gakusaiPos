#!/usr/bin/env bash
#
# LAN共有モードの状態を確認する。
# 現在のMacのIPと、起動時に設定したIP(.env)を比べ、
# 変わっていたら lan-up.sh の再実行を促す。
#
#   ./scripts/lan-status.sh
#
cd "$(cd "$(dirname "$0")/.." && pwd)"

# 現在のLAN IP
CUR="$(ipconfig getifaddr en0 2>/dev/null || true)"
[ -z "$CUR" ] && CUR="$(ipconfig getifaddr en1 2>/dev/null || true)"

# 設定中のIP（.env）
SET=""
[ -f .env ] && SET="$(grep '^NEXT_PUBLIC_REVERB_HOST=' .env 2>/dev/null | cut -d= -f2)"

echo "現在のMac IP : ${CUR:-（取得できません）}"
echo "設定中のIP   : ${SET:-（未設定／LANモード未起動）}"
echo "------------------------------------------------------------"

if [ -z "$SET" ]; then
  echo "⚠ まだ LANモードで起動していません。"
  echo "  → ./scripts/lan-up.sh で起動してください。"
elif [ "$CUR" = "$SET" ]; then
  echo "✅ IPは変わっていません。そのまま使えます。"
  echo "   アクセス: http://$SET:3001"
else
  echo "⚠ IPが変わっています！ 今のままだと別端末から繋がりません。"
  echo "  → ./scripts/lan-up.sh を再実行してください（新しいURLが表示されます）。"
fi
