# LAN共有モード（学祭当日の推奨構成）

インターネットに出さず、**1台のホスト（Mac等）でスタックを起動**し、
**同じWi-Fiの端末**（会計タブレット・調理・受け渡し・モニター等）から
ホストのIPでアクセスして使う構成。ドメイン/HTTPS/ポート開放/別サーバーは不要。

```
[会計タブレット] [調理] [受け渡し] [モニター]  … すべて同じWi-Fi
        └──────────── http://<ホストのIP>:3001 ───────────┘
                         │
                  ホスト1台（Docker: frontend/backend/reverb/db/redis/queue）
```

## 起動（ホストで1コマンド）

```bash
cd ~/gakusaiPos
./scripts/lan-up.sh
```

- ホストのLAN IPを自動検出し、接続先(`.env`)を設定して起動します。
- 自動検出できない場合は手動指定:
  ```bash
  LAN_IP=192.168.1.50 ./scripts/lan-up.sh
  ```
- 実行後に表示される `http://<IP>:3001` を各端末のブラウザで開き、共通パスワードでログイン。

## 事前に確認すること
- **全端末とホストが同じWi-Fi**に接続していること。
- **ホストのファイアウォール**でDocker（ポート3001/8001/8080）への受信接続を許可。
  - macOS: システム設定 > ネットワーク > ファイアウォール（オフ、または受信許可）。
- できれば**ホストのIPを固定**（ルーターのDHCP予約 or 固定IP）。IPが変わったら `lan-up.sh` を再実行。
- ホスト（PC）は当日**起動したまま・スリープさせない**こと。

## 停止・その他
```bash
docker compose down          # 停止
docker compose logs -f       # ログ確認
```
- 通常の開発（localhostのみ）に戻すには: `rm .env && docker compose up -d`

## 補足・制限
- 現状は開発サーバー（`next dev` / `php artisan serve`）で動作します。
  数台〜十数台規模のLANなら実用上問題ありません。
- Next.js 16 の開発サーバーは localhost 以外のオリジンからの内部リクエストを
  既定で 403 ブロックするため、`lan-up.sh` が `LAN_DEV_ORIGIN=<IP>` を渡し
  `next.config.ts` の `allowedDevOrigins` に追加して回避しています。
  （**手動で `docker compose up` する場合は `.env` に `LAN_DEV_ORIGIN=<IP>` が必要**）。
- ブラウザのコンソールに Next.js のHMR用WebSocket接続エラーが出ることがありますが、
  **機能には影響しません**（アプリのリアルタイム更新はReverb:8080で別途動作）。
- localStorage が使えない環境（シークレットモード等）でも、トークンをメモリに保持して
  同一セッション中はログインを維持します。
- より高負荷・高信頼にしたい場合は、フロントを standalone 本番ビルド化・
  backendを Octane/FPM 化する余地あり（今後の課題）。
- タブレットは自動スリープ・自動ロックを切っておくと安定します。
