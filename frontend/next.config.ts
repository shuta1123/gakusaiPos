import type { NextConfig } from "next";
import path from "node:path";

// LAN共有モード用: 開発サーバーは localhost 以外のオリジンからの内部リクエストを
// 既定で 403 ブロックするため、ホストのLAN IP を許可オリジンに追加する。
// scripts/lan-up.sh が LAN_DEV_ORIGIN=<IP> を渡す。
const lanOrigin = process.env.LAN_DEV_ORIGIN?.trim();

const nextConfig: NextConfig = {
  // 本番は standalone 出力（.next/standalone/server.js）で軽量に起動する。
  output: "standalone",
  // 開発時の左下インジケータ（N）を非表示にする。本番では元々表示されない。
  devIndicators: false,
  // 開発サーバーへ LAN の別端末からアクセスできるように許可する（LAN共有モード）。
  ...(lanOrigin ? { allowedDevOrigins: [lanOrigin] } : {}),
  // モノレポ配下で親ディレクトリのロックファイルを誤検出しないよう明示。
  turbopack: {
    root: path.join(__dirname),
  },
  outputFileTracingRoot: path.join(__dirname),
};

export default nextConfig;
