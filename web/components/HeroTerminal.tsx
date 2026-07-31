"use client";

import { useEffect, useState } from "react";
import { useLang } from "@/lib/i18n";

const FRAMES = "⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏";

/**
 * The hero terminal waits as long as the real call does (~4.4s) before the
 * reply lands. The delay is the argument: you are watching Google's latency.
 */
export function HeroTerminal() {
  const { t } = useLang();
  const [frame, setFrame] = useState(0);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setDone(true);
      return;
    }
    const spin = setInterval(() => setFrame((f) => (f + 1) % FRAMES.length), 90);
    const finish = setTimeout(() => setDone(true), 4400);
    return () => {
      clearInterval(spin);
      clearTimeout(finish);
    };
  }, []);

  return (
    <div className="term">
      <div className="term-bar">
        <span className="d" style={{ background: "#FF6B6B" }} />
        <span className="d" style={{ background: "#FFB454" }} />
        <span className="d" style={{ background: "#24C8A0" }} />
        <span className="term-title">bash · live instance</span>
      </div>
      <div className="term-body">
        <pre>
          <span className="p">$</span> TOKEN=$(curl -s -X POST <span className="dm">\</span>
          {"\n    "}
          <span className="st">
            https://freegemini.felipeestrela.com.br/create-session
          </span>{" "}
          <span className="dm">\</span>
          {"\n    | jq -r .sessionToken)\n\n"}
          <span className="p">$</span> curl -s https://freegemini.felipeestrela.com.br
          <span className="st">/chat</span> <span className="dm">\</span>
          {"\n    "}
          <span className="fl">-H</span>{" "}
          <span className="st">&quot;Authorization: Bearer $TOKEN&quot;</span>{" "}
          <span className="dm">\</span>
          {"\n    "}
          <span className="fl">-d</span>{" "}
          <span className="st">
            &#39;&#123;&quot;prompt&quot;:&quot;Explain streams in Node.&quot;&#125;&#39;
          </span>
          {"\n\n"}
          {done ? (
            <>
              &#123; <span className="ky">&quot;ok&quot;</span>:{" "}
              <span className="ok">true</span>,{" "}
              <span className="ky">&quot;reply&quot;</span>:{" "}
              <span className="st">
                &quot;A stream is an abstraction for…&quot;
              </span>{" "}
              &#125;
              {"\n"}
              <span className="dm">└─ 4.4s · 99.5% inside StreamGenerate</span>
            </>
          ) : (
            <span className="wait">
              {FRAMES[frame]} {t("hero.term.waiting")}
            </span>
          )}
        </pre>
      </div>
    </div>
  );
}
