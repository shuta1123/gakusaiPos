FROM node:20-alpine

WORKDIR /app

# 依存関係ファイルを先にコピーしてキャッシュを活用
COPY package*.json ./
RUN npm install

# ソースコードをコピー（volumeマウント時はこちらが上書きされる）
COPY . .

EXPOSE 3000

CMD ["npm", "run", "dev"]
