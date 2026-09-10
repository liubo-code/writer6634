import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "伏线 · 小说大纲板",
  description: "自由摆放灵感，按阶段写好每一章。私人小说大纲工作台。",
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className="antialiased">{children}</body>
    </html>
  );
}
