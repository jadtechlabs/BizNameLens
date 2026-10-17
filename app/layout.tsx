import type { Metadata } from "next";
import "./globals.css";
import "./saas.css";

export const metadata: Metadata = {
  title: "BizNameLens | Know Before You Name It",
  description:
    "Screen a business name across Virginia registration, trademarks, domains, social handles, and brand risk.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
