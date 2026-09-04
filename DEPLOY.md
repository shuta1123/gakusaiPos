# デプロイ手順（本番: Ubuntu / pos.shutay.com ＋ フォールバック: Mac LAN）

## 構成の全体像

```
[客/スタッフの端末(ブラウザ)]
        │  HTTPS / WSS
        ▼
   Nginx (Ubuntuホスト, 443)
   ├─ /       → frontend  127.0.0.1:3001 (Next.js standalone)
   ├─ /api/   → backend   127.0.0.1:8001 (Laravel)
   └─ /app    → reverb    127.0.0.1:8080 (WebSocket)
        │
   docker compose -f compose.prod.yml (db / redis / backend / reverb / queue / frontend)
```

- コンテナのポートは `127.0.0.1` のみに公開し、外部公開は Nginx 経由に限定。
- フロント/バックは同一ドメイン(pos.shutay.com)なので CORS 不要。

---

## A. 本番デプロイ（Ubuntu, WindowsからSSH）

### 0. 事前準備
- Ubuntu に Docker / docker compose 済み（確認: `docker compose version`）。
- Windows から SSH（PowerShell/Windows Terminal）: `ssh <user>@<UbuntuのIP>`
- **DNS**: `pos.shutay.com` の A レコードを自宅のグローバルIPに向ける。ルーターで **80/443番ポートを Ubuntu にポートフォワード**。

### 1. 取得
```bash
sudo mkdir -p /opt && cd /opt
sudo git clone https://github.com/shuta1123/gakusaiPos.git
sudo chown -R $USER:$USER gakusaiPos
cd gakusaiPos
```

### 2. .env を作成（秘密情報を設定）
```bash
cp .env.production.example .env
# 鍵・シークレットを生成して .env に設定
echo "APP_KEY=base64:$(openssl rand -base64 32)"
echo "REVERB_APP_ID=$(openssl rand -hex 6)"
echo "REVERB_APP_KEY=$(openssl rand -hex 16)"
echo "REVERB_APP_SECRET=$(openssl rand -hex 16)"
```
`.env` を編集し、上記の値と `DB_PASSWORD` / `DB_ROOT_PASSWORD` / `STAFF_PASSWORD` を設定する。

### 3. Nginx + Let's Encrypt（このアプリ用は未設定なので新規）
```bash
sudo apt update && sudo apt install -y nginx certbot python3-certbot-nginx

# アプリ用の設定（HTTP・proxyルール）を配置
sudo cp nginx/pos.shutay.com.conf /etc/nginx/sites-available/pos.shutay.com
sudo ln -sf /etc/nginx/sites-available/pos.shutay.com /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx

# 証明書取得＋HTTPS自動設定（certbotが443ブロックと80→443リダイレクトを追記、自動更新も設定）
sudo certbot --nginx -d pos.shutay.com
```
> `certbot --nginx` は ACME 検証を自身で処理し（アプリ未起動でもOK）、この server ブロックに `listen 443 ssl` と証明書行を追記、80→443リダイレクトも作成。更新は certbot.timer が nginx 認証で無停止実行。

### 4. 起動（ビルド込み）
```bash
docker compose -f compose.prod.yml up -d --build
```
- 初回起動時に backend がマイグレーション実行＋商品を投入（空のときのみ）。
- 状態確認: `docker compose -f compose.prod.yml ps`

### 5. 動作確認
- ブラウザで `https://pos.shutay.com/login` → 共通パスワードでログイン → 画面選択。
- 各画面（会計/調理/受け渡し/モニター）がリアルタイム連動するか確認。

### 6. 更新（再デプロイ）
```bash
cd /opt/gakusaiPos
git pull
docker compose -f compose.prod.yml up -d --build
# マイグレーションを個別に流したい場合:
docker compose -f compose.prod.yml exec backend php artisan migrate --force
```

### （任意）GitHub Actions で自動デプロイ
`.github/workflows/deploy.yml` は用意済み。GitHub の Secrets に
`DEPLOY_HOST` / `DEPLOY_USER` / `DEPLOY_SSH_KEY` / `DEPLOY_PATH`(=`/opt/gakusaiPos`) / `DEPLOY_PORT` を登録すると main マージで自動デプロイ。
※ workflow 内の compose コマンドを `-f compose.prod.yml` に合わせて調整すること。

---

## B. フォールバック（サーバー停止時にこの Mac で動かす / LAN内の端末から使う）

サーバーが落ちたら、Mac 上で開発用 compose を LAN 向け設定で起動し、同じWi‑Fiの端末から Mac のIPでアクセスする（HTTPSなし・LAN内のみ）。

### 1. Mac の LAN IP を調べる
```bash
ipconfig getifaddr en0    # 例: 192.168.1.50（Wi‑Fiは en0、有線は en1 のことが多い）
```

### 2. リポジトリ直下に `.env` を作成（`<MAC_IP>` を置換）
```bash
cat > .env <<'EOF'
NEXT_PUBLIC_API_BASE=http://<MAC_IP>:8001/api
NEXT_PUBLIC_REVERB_HOST=<MAC_IP>
NEXT_PUBLIC_REVERB_PORT=8080
NEXT_PUBLIC_REVERB_SCHEME=http
CORS_ALLOWED_ORIGINS=http://<MAC_IP>:3001
STAFF_PASSWORD=gakusai2026
EOF
```

### 3. 開発用 compose で起動
```bash
docker compose up -d --build
```

### 4. 端末からアクセス
- 同じWi‑Fiの端末のブラウザで `http://<MAC_IP>:3001/login`
- ※ macOSのファイアウォールでDockerのポートへのLAN接続を許可すること。

> 注意: フォールバックは開発サーバー(next dev / artisan serve)で動くため本番より非力。あくまで一時退避用。データは本番Ubuntuとは別（Mac上のDB）。

---

## 補足・注意
- **本番のサーバー実行形態**: frontend は standalone(`next start`相当)で本番ビルド。backend は現状 `php artisan serve`（開発サーバー）。学祭規模(低RPS)なら Nginx 前段で概ね動くが、より堅牢にするなら Laravel Octane / FPM 化を推奨（今後の課題）。
- **公開URLはビルド時に焼き込まれる**（`NEXT_PUBLIC_*`）。本番とMacフォールバックでフロントの参照先が異なるため、それぞれの環境でビルドし直す必要がある（本番=compose.prod.yml、フォールバック=dev compose）。
- **秘密情報**（`.env`）はコミットしない。本番と開発で別の値にする。
