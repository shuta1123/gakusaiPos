#!/usr/bin/env bash
set -e

cd /var/www/html

# .env が無ければ雛形から生成
if [ ! -f .env ]; then
    cp .env.example .env
fi

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

# マイグレーション & シードは backend サービスでのみ実行
if [ "${RUN_MIGRATIONS:-false}" = "true" ]; then
    echo "Running migrations & seeders ..."
    php artisan migrate --seed --force
fi

# 設定キャッシュのクリア（マウント環境での取りこぼし防止）
php artisan config:clear || true

exec "$@"
