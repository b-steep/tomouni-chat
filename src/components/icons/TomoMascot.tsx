/**
 * TOMO マスコット (黒×茶ロングダックスフント)
 * 設計書 §3.4 — トモラボ代表トモさんのAIアバター
 *
 * ChatGPT生成の水彩イラスト（背景付き）をそのまま使用。
 *
 * variant:
 *   - "face"    : 顔のみ (アバター・吹き出し横用) — 320x320
 *   - "hero"    : 全身+ペン (Welcome ヒーロー用) — 500x553
 *   - "writing" : 全身+ペン (装飾用) — 500x553
 *
 * mood: CSS filter / transform で表情の代用 (default/thinking/happy/sad)
 */
import Image from "next/image";
import { cn } from "@/lib/utils";

type Variant = "face" | "hero" | "writing";
type Mood = "default" | "thinking" | "happy" | "sad";

// next/image では local image にクエリパラメータを付けると
// Vercel 上で INVALID_IMAGE_OPTIMIZE_REQUEST エラーになるため除去
const VARIANT_SOURCES = {
  face: { src: `/mascots/tomo-avatar.png`, width: 320, height: 320 },
  hero: { src: `/mascots/tomo-hero.png`, width: 500, height: 659 },
  writing: { src: `/mascots/tomo-hero.png`, width: 500, height: 659 },
} as const;

const MOOD_CLASSES: Record<Mood, string> = {
  default: "",
  thinking: "saturate-90",
  happy: "saturate-110",
  sad: "saturate-50 brightness-95 -rotate-3",
};

type Props = {
  variant?: Variant;
  mood?: Mood;
  className?: string;
  priority?: boolean;
  /** 円形アバター用に face をコンテナいっぱいに表示する */
  fillCircle?: boolean;
};

export function TomoMascot({
  variant = "face",
  mood = "default",
  className,
  priority = false,
  fillCircle = false,
}: Props) {
  const src = VARIANT_SOURCES[variant];

  return (
    <Image
      src={src.src}
      alt="TOMO (トモのAIアバター)"
      width={src.width}
      height={src.height}
      draggable={false}
      priority={priority}
      className={cn(
        "select-none transition-all",
        MOOD_CLASSES[mood],
        // 正方形+余白付き画像なので object-contain で枠内に全部収める (はみ出さない)
        fillCircle && "h-full w-full object-contain",
        className,
      )}
    />
  );
}
