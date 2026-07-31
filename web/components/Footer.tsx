"use client";

import { T } from "@/components/T";
import { useLang } from "@/lib/i18n";
import { API_BASE } from "@/lib/api";

export function Footer() {
  const { t } = useLang();

  return (
    <div className="wrap">
      <footer className="site-footer">
        <span>
          Free Gemini API · ISC · <T k="footer.by" />{" "}
          <a href="https://github.com/lipey1">Felipe Estrela</a>
        </span>
        <span>
          <a href={`${API_BASE}/docs`}>/docs</a> ·{" "}
          <a href={`${API_BASE}/openapi.json`}>/openapi.json</a>
        </span>
      </footer>
    </div>
  );
}
