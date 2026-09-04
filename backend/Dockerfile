FROM php:8.4-cli

# システム依存 & PHP拡張
RUN apt-get update && apt-get install -y --no-install-recommends \
        git unzip libzip-dev libicu-dev default-mysql-client \
    && docker-php-ext-install pdo_mysql bcmath pcntl zip intl \
    && rm -rf /var/lib/apt/lists/*

# Composer
COPY --from=composer:2 /usr/bin/composer /usr/bin/composer

WORKDIR /var/www/html

# 依存を先に入れてレイヤーキャッシュを効かせる
COPY composer.json composer.lock ./
RUN composer install --no-interaction --prefer-dist --no-progress --no-scripts --no-autoloader

# アプリ本体
COPY . .
RUN composer dump-autoload --optimize

# エントリポイント（DB待機→マイグレーション→サーバー起動）
COPY docker/entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

EXPOSE 8001

ENTRYPOINT ["entrypoint.sh"]
CMD ["php", "artisan", "serve", "--host=0.0.0.0", "--port=8001"]
