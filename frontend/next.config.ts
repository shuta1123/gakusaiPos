import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  // 本番は standalone 出力（.next/standalone/server.js）で軽量に起動する。
  output: "standalone",
  // モノレポ配下で親ディレクトリのロックファイルを誤検出しないよう明示。
  turbopack: {
    root: path.join(__dirname),
  },
  outputFileTracingRoot: path.join(__dirname),
};

export default nextConfig;
