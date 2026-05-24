import type { Metadata, Viewport } from "next";
import {
  Mochiy_Pop_One,
  Zen_Maru_Gothic,
  Noto_Sans_JP,
  Quicksand,
  Yusei_Magic,
} from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";

/* ============================================================
   Google Fonts — 設計書 §3.3 タイポグラフィ
   - Mochiy Pop One : ロゴ・最大見出し (大胆ポップ感)
   - Zen Maru Gothic: 見出し H1/H2 (丸ゴシック / 絵本トーン)
   - Noto Sans JP   : 本文
   - Quicksand      : 数字・英字
   - Yusei Magic    : 吹き出し内手書き風
   ============================================================ */
const mochiyPop = Mochiy_Pop_One({
  variable: "--font-mochiy",
  weight: "400",
  subsets: ["latin"],
  display: "swap",
});
const zenMaru = Zen_Maru_Gothic({
  variable: "--font-zen-maru",
  weight: ["500", "700", "900"],
  subsets: ["latin"],
  display: "swap",
});
const notoSansJp = Noto_Sans_JP({
  variable: "--font-noto-jp",
  weight: ["400", "500", "700"],
  subsets: ["latin"],
  display: "swap",
});
const quicksand = Quicksand({
  variable: "--font-quicksand",
  weight: ["500", "700"],
  subsets: ["latin"],
  display: "swap",
});
const yuseiMagic = Yusei_Magic({
  variable: "--font-yusei",
  weight: "400",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "トモユニチャット",
  description:
    "大学生のAI学習ナビゲーター「TOMO」。トモのAI分身が24時間、AI活用・レポート・プロンプトのコツに答えます。",
  applicationName: "トモユニチャット",
  authors: [{ name: "B-Steep Inc." }],
  keywords: ["AI", "大学生", "トモユニ", "トモラボ", "ChatGPT", "Claude", "Gemini", "学習"],
  openGraph: {
    title: "トモユニチャット",
    description: "大学生のAI学習ナビゲーター。トモのAI分身が24時間相談に乗ります。",
    type: "website",
  },
  robots: { index: false, follow: false }, // Phase 1 は noindex
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#A8784A",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="ja"
      className={`${mochiyPop.variable} ${zenMaru.variable} ${notoSansJp.variable} ${quicksand.variable} ${yuseiMagic.variable}`}
    >
      <body className="min-h-dvh font-sans">
        <TooltipProvider delayDuration={200}>{children}</TooltipProvider>
        <Analytics />
      </body>
    </html>
  );
}
