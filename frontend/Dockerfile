FROM node:22-alpine

WORKDIR /app

# 依存を先に入れてレイヤーキャッシュを効かせる
COPY package.json package-lock.json ./
RUN npm ci

# アプリ本体
COPY . .

EXPOSE 3001

# フェーズ1は開発サーバーで起動（ホットリロード対応）
CMD ["npm", "run", "dev", "--", "--hostname", "0.0.0.0", "--port", "3001"]
