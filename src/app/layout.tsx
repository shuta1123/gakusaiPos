import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "学祭 POS",
  description: "大学祭用 POS システム",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
