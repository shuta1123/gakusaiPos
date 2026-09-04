#!/usr/bin/env bash
set -e

cd /var/www/html

# .env が無ければ雛形から生成
if [ ! -f .env ]; then
    cp .env.example .env
fi

# コンテナ環境変数(compose由来)を .env に反映する。
# `php artisan serve`(php -S) は Docker の環境変数を直接読めない場合があるため、
# 確実に読める .env ファイルへ書き込む（CORS/APP_KEY等をコンテナ間で一致させる）。
sync_env() {
    key="$1"
    val="$(printenv "$key" 2>/dev/null || true)"
    [ -z "$val" ] && return 0
    if grep -q "^${key}=" .env; then
        sed -i "s|^${key}=.*|${key}=${val}|" .env
    else
        printf '%s=%s\n' "$key" "$val" >> .env
    fi
}
for k in APP_ENV APP_DEBUG APP_URL APP_KEY APP_LOCALE \
         DB_CONNECTION DB_HOST DB_PORT DB_DATABASE DB_USERNAME DB_PASSWORD \
         REDIS_CLIENT REDIS_HOST REDIS_PORT CACHE_STORE QUEUE_CONNECTION SESSION_DRIVER \
         BROADCAST_CONNECTION REVERB_APP_ID REVERB_APP_KEY REVERB_APP_SECRET \
         REVERB_HOST REVERB_PORT REVERB_SCHEME REVERB_SERVER_HOST REVERB_SERVER_PORT \
         STAFF_PASSWORD CORS_ALLOWED_ORIGINS; do
    sync_env "$k"
done

# APP_KEY 未設定なら生成
if ! grep -q "^APP_KEY=base64:" .env; then
    php artisan key:generate --force
fi

# DB の起動待ち（backend/queue/reverb すべてで待つ）
if [ -n "$DB_HOST" ]; then
    echo "Waiting for database ${DB_HOST}:${DB_PORT:-3306} ..."
    until php -r "exit(@fsockopen(getenv('DB_HOST'), (int)(getenv('DB_PORT') ?: 3306)) ? 0 : 1);" 2>/dev/null; do
        sleep 2
    done
    echo "Database is up."
fi

# マイグレーションは backend サービスでのみ実行
if [ "${RUN_MIGRATIONS:-false}" = "true" ]; then
    echo "Running migrations ..."
    php artisan migrate --force

    # シードは商品テーブルが空の初回のみ（再起動で運用状態を上書きしない）
    PRODUCT_COUNT="$(php artisan tinker --execute='echo \App\Models\Product::count();' 2>/dev/null | tail -n1 | tr -dc '0-9')"
    if [ "${PRODUCT_COUNT:-0}" = "0" ]; then
        echo "Seeding initial data ..."
        php artisan db:seed --force
    else
        echo "Seed skipped (products already exist: ${PRODUCT_COUNT})."
    fi
fi

# 設定キャッシュのクリア（マウント環境での取りこぼし防止）
php artisan config:clear || true

exec "$@"
