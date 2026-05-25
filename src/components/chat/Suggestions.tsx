/**
 * Suggestions — 付箋風4枚カード
 * 設計書 §3.5 — PiyoAILab カラー流用 + 微 tilt + ホバー時にまっすぐ
 */
"use client";
import { cn } from "@/lib/utils";

export type SuggestionItem = {
  id: string;
  icon: string;
  label: string;
  prompt: string;
  bg: "orange" | "yellow" | "teal" | "pink";
  tilt: number; // deg
};

const DEFAULT_SUGGESTIONS: SuggestionItem[] = [
  {
    id: "es",
    icon: "📝",
    label: "ESをAIで添削",
    prompt: "就活のエントリーシート（ES）をAIで添削・改善するコツを教えて。",
    bg: "orange",
    tilt: -2.2,
  },
  {
    id: "interview",
    icon: "🎤",
    label: "面接対策 × AI",
    prompt: "就活の面接対策をAIで練習する方法を教えて。",
    bg: "yellow",
    tilt: 1.8,
  },
  {
    id: "prompt",
    icon: "💡",
    label: "プロンプトの書き方",
    prompt: "AIに質問するときのプロンプトの書き方のコツを教えて。",
    bg: "teal",
    tilt: -1.4,
  },
  {
    id: "tool",
    icon: "🔍",
    label: "どのAI使えばいい？",
    prompt: "ChatGPT、Claude、Geminiって何が違うの？大学生はどれから始めるべき？",
    bg: "pink",
    tilt: 2.6,
  },
];

const BG_CLASSES = {
  orange: "bg-sticky-orange [--border-color:var(--color-sticky-orange-border)]",
  yellow: "bg-sticky-yellow [--border-color:var(--color-sticky-yellow-border)]",
  teal: "bg-sticky-teal [--border-color:var(--color-sticky-teal-border)]",
  pink: "bg-sticky-pink [--border-color:var(--color-sticky-pink-border)]",
} as const;

type Props = {
  items?: SuggestionItem[];
  onSelect: (prompt: string) => void;
};

export function Suggestions({ items = DEFAULT_SUGGESTIONS, onSelect }: Props) {
  return (
    <section className="mt-1 mb-3" aria-label="質問のサジェスト">
      <div className="mb-3 flex items-center justify-center gap-2 text-wood-700">
        <span className="h-px w-8 bg-craft-300" />
        <span
          className="text-sm font-medium"
          style={{ fontFamily: "var(--font-yusei)" }}
        >
          何を相談する？
        </span>
        <span className="h-px w-8 bg-craft-300" />
      </div>
      <ul className="grid grid-cols-2 gap-3 px-1">
        {items.map((s) => (
          <li key={s.id} style={{ ["--tilt" as string]: `${s.tilt}deg` }}>
            <button
              type="button"
              onClick={() => onSelect(s.prompt)}
              className={cn(
                "sticky-note flex w-full flex-col items-start gap-1.5 text-left",
                "border-[var(--border-color)]",
                BG_CLASSES[s.bg],
              )}
              aria-label={s.label}
            >
              <span className="text-2xl leading-none" aria-hidden>
                {s.icon}
              </span>
              <span
                className="text-sm leading-snug text-ink-900"
                style={{ fontFamily: "var(--font-yusei)" }}
              >
                {s.label}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
