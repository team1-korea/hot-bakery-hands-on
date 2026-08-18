import type { Metadata } from "next";
import { Archivo_Black, Gothic_A1 } from "next/font/google";
import type { ReactNode } from "react";

import "./globals.css";

const archivoBlack = Archivo_Black({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-sign-latin",
  display: "swap",
});

const gothicA1 = Gothic_A1({
  weight: ["700", "900"],
  subsets: ["latin"],
  variable: "--font-sign-korean",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Avalanche Bakery",
  description: "쿠키를 굽고, 오늘의 추억을 온체인에 보관합니다.",
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="ko" className={`${archivoBlack.variable} ${gothicA1.variable}`}>
      <body>{children}</body>
    </html>
  );
}
