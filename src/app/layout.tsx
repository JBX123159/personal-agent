import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "AI Native Vehicle | Personal Agent",
  description: "Memory 与 Vehicle Context 驱动的智能座舱 Personal Agent 产品原型",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
