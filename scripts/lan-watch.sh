#!/usr/bin/env bash
#
# LAN IP を監視し、変わったら自動で lan-up.sh を実行して追従する。
# これを起動したまま放置しておけば、IP変更に自動対応する。
# 終了は Ctrl+C。
#
#   ./scripts/lan-watch.sh
#
cd "$(cd "$(dirname "$0")/.." && pwd)"

INTERVAL="${WATCH_INTERVAL:-15}" # 監視間隔（秒）

cur_ip() {
  ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || true
}
set_ip() {
  [ -f .env ] && grep '^NEXT_PUBLIC_REVERB_HOST=' .env 2>/dev/null | cut -d= -f2
}

echo "LAN IP 監視を開始します（${INTERVAL}秒ごと）。Ctrl+C で終了。"
echo "現在の設定IP: $(set_ip)"

while true; do
  CUR="$(cur_ip)"
  SET="$(set_ip)"

  if [ -n "$CUR" ] && [ "$CUR" != "$SET" ]; then
    # 一瞬のブレで無駄に再起動しないよう、少し待って同じIPが続くか確認。
    sleep 3
    CUR2="$(cur_ip)"
    if [ "$CUR" = "$CUR2" ] && [ "$CUR" != "$(set_ip)" ]; then
      echo ""
      echo "[$(date '+%H:%M:%S')] IPが変わりました: ${SET:-なし} → ${CUR}。再設定します…"
      ./scripts/lan-up.sh
      echo "[$(date '+%H:%M:%S')] 追従完了。新しいURL: http://${CUR}:3001"
    fi
  fi

  sleep "$INTERVAL"
done
