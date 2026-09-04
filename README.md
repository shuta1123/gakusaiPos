# 学祭POS システム

大学祭にて商品を販売するためのPOS・モバイルオーダーシステム。
1日約1000人来場を想定。自宅サーバーで運用。

## 機能概要

- **モバイルオーダー**：客がスマホから注文・キャンセル・変更が可能（会計前まで）
- **会計**：対面注文・モバイルオーダーの会計に対応。お釣り計算・番号発番
- **受け渡し（客向け）**：準備中・受け取り可能な番号をリアルタイム表示
- **受け渡し（管理）**：準備完了・受け渡し完了の操作・履歴管理
- **調理担当**：注文番号×品目の表形式で表示。スペースキーで先頭注文を完了

## 画面一覧

| 画面 | URL | 説明 |
|---|---|---|
| モバイルオーダー | `/order` | 客がスマホで注文 |
| 会計 | `/cashier` | スタッフが対面・モバイル注文を会計 |
| 受け渡し（客向け） | `/display` | 番号案内モニター |
| 受け渡し（管理） | `/kitchen` | 準備・受け渡し管理 |
| 調理担当 | `/cooking` | 調理スタッフ向け注文管理 |

## 商品

| 商品名 | 価格 |
|---|---|
| 焼きそば | ¥300 |
| 焼きそばパン | ¥350 |
| フランクフルト | ¥200 |
| ホットドッグ | ¥250 |

## 注文番号ルール

3桁で管理。末尾2桁（XX）は 00〜99 で共通。

| 端末 | 番号帯 |
|---|---|
| 会計1 | 1XX |
| 会計2 | 2XX |
| モバイルオーダー | 7XX |

## ステータスフロー

```
注文完了 → 会計完了 → 準備完了 → 受け渡し完了
```

| ステータス | 操作する画面 | 操作者 |
|---|---|---|
| 注文完了 | 会計 / モバイルオーダー | 会計スタッフ / 客 |
| 会計完了 | 会計 | 会計スタッフ |
| 準備完了 | 受け渡し（管理） | 受け渡しスタッフ |
| 受け渡し完了 | 受け渡し（管理） | 受け渡しスタッフ |

## 調理担当画面仕様

- 列=注文番号、行=品目の表形式
- 0の品目行は非表示
- 10件超えたら次の段（テーブル）に折り返し
- スペースキーで先頭列（次の注文）を完了
- 番号ヘッダーをタップしても完了
- 列幅72px固定・左詰め・数字32px

## 技術スタック

| 分類 | 技術 |
|---|---|
| フロントエンド | Next.js / TypeScript / React |
| バックエンド | Laravel（PHP 8.x） |
| データベース | MySQL |
| インフラ | Docker |
| サーバー | 自宅サーバー |

## DB設計

**orders**

| カラム | 型 | 説明 |
|---|---|---|
| id | INT | 主キー |
| number | INT | 注文番号（00〜99） |
| source | ENUM | 会計1 / 会計2 / モバイル |
| status | ENUM | 注文完了 / 会計完了 / 準備完了 / 受け渡し完了 |
| created_at | TIMESTAMP | 作成日時 |

**order_items**

| カラム | 型 | 説明 |
|---|---|---|
| id | INT | 主キー |
| order_id | INT | ordersへの外部キー |
| product_id | INT | productsへの外部キー |
| quantity | INT | 数量 |
| unit_price | INT | 注文時点の単価スナップショット |

**products**

| カラム | 型 | 説明 |
|---|---|---|
| id | INT | 主キー |
| name | VARCHAR | 商品名 |
| price | INT | 価格 |

## ディレクトリ構成

```
gakusaiPos/
├── frontend/   Next.js (TypeScript) … ポート 3001
├── backend/    Laravel (PHP)         … ポート 8001（API）
├── docker-compose.yml
└── .github/workflows/  CI/CD
```

## サービス構成（docker compose）

| サービス | 内容 | ポート |
|---|---|---|
| frontend | Next.js 開発サーバー | 3001 |
| backend | Laravel API サーバー | 8001 |
| reverb | Laravel Reverb（WebSocket） | 8080 |
| queue | キューワーカー（ブロードキャスト配送） | — |
| db | MySQL 8.4 | 3307（ホスト）→ 3306（コンテナ） |
| redis | Redis 7 | 6379 |

> ホスト側の 3307 はローカルMySQLとの競合回避のため。コンテナ間は `db:3306` で接続。`DB_PORT_HOST` で変更可。

## セットアップ

```bash
git clone https://github.com/shuta1123/gakusaiPos.git
cd gakusaiPos
docker compose up -d --build
```

起動後:

- フロント: http://localhost:3001
- API: http://localhost:8001/api
- WebSocket: ws://localhost:8080

商品データは backend の起動時に自動でマイグレーション・シードされます。
スタッフ共通パスワードの初期値は `gakusai2026`（`docker-compose.yml` / `backend/.env` の `STAFF_PASSWORD`）。

## API エンドポイント

| メソッド | パス | 認証 | 説明 |
|---|---|---|---|
| POST | `/api/auth/login` | なし | 共通パスワードでログイン |
| POST | `/api/auth/logout` | 要 | ログアウト |
| GET | `/api/products` | なし | 商品一覧 |
| PATCH | `/api/products/{id}` | 要 | 売り切れ設定など |
| GET | `/api/orders` | 要 | 注文一覧（status/source 絞り込み可） |
| POST | `/api/orders` | なし | 注文作成 |
| GET | `/api/orders/{id}` | なし | 注文詳細 |
| PATCH | `/api/orders/{id}/status` | 要 | ステータス更新 |
| DELETE | `/api/orders/{id}` | 要 | 注文キャンセル |
| GET | `/api/orders/next-number` | 要 | 次の注文番号（`?source=`） |

認証は共通パスワード由来の Bearer トークン方式（無期限）。`/order`（客用）が使う API のみ認証なし。

## WebSocket イベント

`orders` チャンネル: `order.created` / `order.status_updated` / `order.cancelled`
`products` チャンネル: `product.updated`

## 支払い

- 現金のみ
- お釣り自動計算あり