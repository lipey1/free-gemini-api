"use client";

import { dict, type Key } from "@/lib/i18n";

/**
 * Renders BOTH languages and lets CSS show one, keyed off `html[data-lang]`.
 *
 * Why not just swap the string on state change: this site is a static export,
 * so the HTML ships pre-rendered in English. The browser paints that markup
 * before React ever runs, which means a Portuguese visitor saw English first
 * and watched it flip at hydration. An inline script in <head> sets data-lang
 * before the first paint, so the correct half is the only one ever shown.
 *
 * Bonus: the language toggle works even with JavaScript disabled for anyone
 * who lands with a stored preference, and both languages stay in the markup
 * for search engines.
 */
export function T({ k }: { k: Key }) {
  const entry = dict[k];
  return (
    <>
      <span data-l="en">{entry.en}</span>
      <span data-l="pt">{entry.pt}</span>
    </>
  );
}
