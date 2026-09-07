#!/usr/bin/env bash
#
# LAN共有モードで起動する。
# 1台（このホスト）でスタックを起動し、同じWi-Fiの端末から
#   http://<このホストのLAN IP>:3001
# でアクセスして使う。ドメイン/HTTPS/ポート開放は不要。
#
# 使い方:
#   ./scripts/lan-up.sh                # LAN IP を自動検出
#   LAN_IP=192.168.1.50 ./scripts/lan-up.sh   # 手動指定
#
set -euo pipefail
cd "$(cd "$(dirname "$0")/.." && pwd)"

# --- LAN IP を決める（優先: 環境変数 LAN_IP、次に自動検出）---
IP="${LAN_IP:-}"
if [ -z "$IP" ]; then
  # macOS（Wi-Fi=en0、有線=en1 が多い）
  IP="$(ipconfig getifaddr en0 2>/dev/null || true)"
  [ -z "$IP" ] && IP="$(ipconfig getifaddr en1 2>/dev/null || true)"
  # Linux
  if [ -z "$IP" ] && command -v hostname >/dev/null 2>&1; then
    IP="$(hostname -I 2>/dev/null | awk '{print $1}')"
  fi
fi
if [ -z "$IP" ]; then
  echo "エラー: LAN IP を自動検出できませんでした。"
  echo "  LAN_IP=192.168.x.x ./scripts/lan-up.sh のように指定してください。"
  exit 1
fi

echo "LAN IP: $IP"

# --- 端末（ブラウザ）が参照する接続先を .env に書き込む ---
# ※ フロントは別端末で動くので localhost ではなくホストの IP を指す必要がある。
cat > .env <<EOF
# LAN共有モード（scripts/lan-up.sh が生成）。ホスト: $IP
NEXT_PUBLIC_API_BASE=http://$IP:8001/api
NEXT_PUBLIC_REVERB_HOST=$IP
NEXT_PUBLIC_REVERB_PORT=8080
NEXT_PUBLIC_REVERB_SCHEME=http
CORS_ALLOWED_ORIGINS=http://$IP:3001
EOF

# --- 起動（env 反映のため再作成込み）---
docker compose up -d --build

cat <<EOF

============================================================
 LAN共有モードで起動しました
------------------------------------------------------------
 同じ Wi-Fi の端末（タブレット等）のブラウザで:

     http://$IP:3001

 共通パスワードでログイン → 画面選択。
------------------------------------------------------------
 注意:
  - このホスト（$IP）を起動したままにしておくこと。
  - macOS のファイアウォールが有効な場合、Docker への
    受信接続を「許可」する必要があります
    （システム設定 > ネットワーク > ファイアウォール）。
  - ホストの IP が変わったら、もう一度このスクリプトを実行。
  - 停止は:  docker compose down
============================================================
EOF
