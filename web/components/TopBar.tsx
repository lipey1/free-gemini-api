"use client";

import { Lockup } from "./Logo";
import { T } from "@/components/T";
import { useLang } from "@/lib/i18n";
import { API_BASE } from "@/lib/api";

export function TopBar({
  active,
}: {
  active?: "home" | "playground" | "pricing" | "account";
}) {
  const { lang, setLang } = useLang();

  return (
    <div className="top">
      <div className="top-in">
        <Lockup />
        <span className="top-spacer" />

        <a
          className="top-link"
          href="/pricing/"
          data-active={active === "pricing"}
          data-hide-sm="true"
        >
          <T k="nav.pricing" />
        </a>
        <a
          className="top-link"
          href="/playground/"
          data-active={active === "playground"}
        >
          <T k="nav.playground" />
        </a>
        <a className="top-link" data-hide-sm="true" href={`${API_BASE}/docs`}>
          <T k="nav.docs" />
        </a>
        <a
          className="top-link"
          href="/account/"
          data-active={active === "account"}
        >
          <T k="nav.account" />
        </a>
        <a
          className="top-link"
          data-hide-sm="true"
          href="https://github.com/lipey1/free-gemini-api"
        >
          <T k="nav.github" />&nbsp;↗
        </a>

        <div className="lang" role="group" aria-label="Language / Idioma">
          <button
            type="button"
            data-lang-btn="en"
            onClick={() => setLang("en")}
            aria-pressed={lang === "en"}
          >
            EN
          </button>
          <button
            type="button"
            data-lang-btn="pt"
            onClick={() => setLang("pt")}
            aria-pressed={lang === "pt"}
          >
            PT
          </button>
        </div>
      </div>
    </div>
  );
}
