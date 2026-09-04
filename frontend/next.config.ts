import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  // モノレポ配下で親ディレクトリのロックファイルを誤検出しないよう明示。
  turbopack: {
    root: path.join(__dirname),
  },
};

export default nextConfig;
