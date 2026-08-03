"use client";

import { T } from "@/components/T";
import { API_BASE } from "@/lib/api";

export function Footer() {
  return (
    <footer className="site-footer">
      <div className="wrap site-footer-in">
        <span>
          Free Gemini API · ISC · <T k="footer.by" />{" "}
          <a href="https://github.com/lipey1">Felipe Estrela</a>
        </span>
        <span>
          <a href={`${API_BASE}/docs`}>/docs</a> ·{" "}
          <a href={`${API_BASE}/openapi.json`}>/openapi.json</a>
        </span>
      </div>
    </footer>
  );
}
