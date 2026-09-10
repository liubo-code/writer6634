import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "伏线 · 小说工作台",
  description: "从软木板大纲到长篇正文，按章节关联人物、伏笔与写作计划的私人小说工作台。",
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
