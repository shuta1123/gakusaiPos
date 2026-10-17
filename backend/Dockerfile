FROM php:8.3-cli

# LaravelがMySQLと動くために必要なPHP拡張をインストール
RUN apt-get update && apt-get install -y \
    git curl zip unzip \
    libzip-dev libpng-dev libonig-dev libxml2-dev \
    && docker-php-ext-install pdo pdo_mysql mbstring zip exif pcntl bcmath \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

# Composerをインストール（公式イメージからコピー）
COPY --from=composer:latest /usr/bin/composer /usr/bin/composer

WORKDIR /var/www/backend

COPY . .

EXPOSE 8000

ENTRYPOINT ["/var/www/backend/entrypoint.sh"]
