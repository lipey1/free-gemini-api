"use client";

import { useRef, type ReactNode } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(useGSAP, ScrollTrigger);

/*
  MOTION CONTRACT

  Personality: Corporate. Signature easing: expo-out (0.16, 1, 0.3, 1), already
  the page's --ease. Duration palette: 180ms quick, 420ms standard, 2.0s slow.

  PRIMARY: the waterfall bars draw in proportion to the time they actually
  took. auth.verify_jwt (1 ms) is done in 0.27s; gemini.StreamGenerate (7.3 s)
  crawls for 2.0s. The whole reveal runs about 3s, and the reader feels the
  ratio before reading a single number. This is the page's thesis expressed as
  motion rather than decoration.

  SECONDARY: the time axis draws downward on scroll scrub, and each node dot
  lights as the line reaches it. Scroll is the time axis, so moving the page
  and moving through the trace are the same gesture.

  AMBIENT: the dot the axis has just passed stays lit, so the reader always
  knows their position in the request.

  Everything collapses to a static, fully visible page under
  prefers-reduced-motion via gsap.matchMedia.
*/

const EASE = "expo.out";

/** Draw time in seconds, log-scaled so a 0.02ms span is still perceptible. */
function drawDuration(ms: number, maxMs: number): number {
  const norm = Math.log10(1 + Math.max(ms, 0.01)) / Math.log10(1 + maxMs);
  return 0.12 + 1.9 * norm;
}

export function TraceMotion({ children }: { children: ReactNode }) {
  const root = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      // Trigger positions are measured at creation. Inter and JetBrains Mono
      // land afterwards and reflow the page, so every start/end would be off
      // by hundreds of pixels without this.
      if (document.fonts?.status !== "loaded") {
        document.fonts?.ready.then(() => ScrollTrigger.refresh());
      }

      /**
       * Land the axis exactly on the lower edge of the closing CTA.
       *
       * The position used to come from spacing tokens, which assumed a button
       * height that does not survive a different font size, zoom level or line
       * wrap. Measuring both boxes removes the assumption.
       */
      const alignAxisEnd = () => {
        const layer = root.current?.querySelector<HTMLElement>(".axis-layer");
        const axisEl = root.current?.querySelector<HTMLElement>(".axis");
        const endAt = root.current?.querySelector<HTMLElement>("[data-axis-end]");
        const firstTick = root.current?.querySelector<HTMLElement>("[data-tick]");
        if (!layer || !axisEl || !endAt || !firstTick) return;

        const layerBox = layer.getBoundingClientRect();
        const tickBox = firstTick.getBoundingClientRect();

        // Start at the centre of the first node. A fixed 60px offset left the
        // opening dot floating ~46px above the line it belongs to.
        const top = tickBox.top + tickBox.height / 2 - layerBox.top;
        axisEl.style.setProperty("--axis-start", `${Math.max(0, Math.round(top))}px`);

        const gap = layerBox.bottom - endAt.getBoundingClientRect().bottom;
        axisEl.style.setProperty("--axis-end", `${Math.max(0, Math.round(gap))}px`);
      };

      alignAxisEnd();
      // Re-measure whenever layout settles or changes.
      document.fonts?.ready.then(alignAxisEnd);
      ScrollTrigger.addEventListener("refresh", alignAxisEnd);

      const mm = gsap.matchMedia();

      // ── reduced motion: everything visible, nothing moves ──────────
      mm.add("(prefers-reduced-motion: reduce)", () => {
        gsap.set("[data-bar]", { scaleX: 1 });
        gsap.set("[data-qfill]", { scaleX: 1 });
        gsap.set("[data-axis-fill]", { scaleY: 1 });
        gsap.set("[data-tick]", { opacity: 1 });
        gsap.set("[data-reveal]", { opacity: 1, y: 0 });
        gsap.set("[data-stamp]", { opacity: 1, x: 0 });
      });

      mm.add("(prefers-reduced-motion: no-preference)", () => {
        // ── OPENING: the first viewport states the thesis ───────────
        // Runs on load, not on scroll, so motion is the first thing the
        // visitor sees. Everything lifts from below along one axis; the
        // terminal arrives last because it is the proof, not the claim.
        const hero = root.current?.querySelector("[data-hero]");
        if (hero) {
          const pick = (sel: string) => hero.querySelector(sel);
          const opening = gsap.timeline({ delay: 0.1 });

          opening
            .from(pick("[data-stamp]") as Element, {
              opacity: 0,
              x: -10,
              duration: 0.5,
              ease: EASE,
            })
            .from(
              pick(".tagline") as Element,
              { opacity: 0, y: 12, duration: 0.5, ease: EASE },
              "-=0.35",
            )
            .from(
              pick("h1") as Element,
              { opacity: 0, y: 26, duration: 0.75, ease: EASE },
              "-=0.3",
            )
            .from(
              pick(".hero-body") as Element,
              { opacity: 0, y: 18, duration: 0.6, ease: EASE },
              "-=0.5",
            )
            .from(
              gsap.utils.toArray<HTMLElement>(
                hero.querySelectorAll(".cta-row .btn"),
              ),
              { opacity: 0, y: 12, duration: 0.45, stagger: 0.07, ease: EASE },
              "-=0.4",
            )
            .from(
              pick(".term") as Element,
              { opacity: 0, y: 22, scale: 0.985, duration: 0.7, ease: EASE },
              "-=0.55",
            );
        }

        // ── the timestamp on each node slides in with its section ───
        gsap.utils
          .toArray<HTMLElement>("[data-stamp]")
          .slice(1)
          .forEach((stamp) => {
            gsap.from(stamp, {
              opacity: 0,
              x: -10,
              duration: 0.5,
              ease: EASE,
              scrollTrigger: { trigger: stamp, start: "top 88%", once: true },
            });
          });

        // ── SECONDARY: the axis draws as you scroll ─────────────────
        const fill = root.current?.querySelector("[data-axis-fill]");
        const axis = root.current?.querySelector(".axis");
        if (fill && axis) {
          gsap.set(fill, { scaleY: 0, transformOrigin: "top center" });
          gsap.to(fill, {
            scaleY: 1,
            ease: "none",
            scrollTrigger: {
              // Measured against the axis itself. The end has to be a position
              // the page can actually reach: at max scroll the axis bottom
              // still sits ~275px above the fold, so an end line at 60% of the
              // viewport was unreachable and the fill stopped short. clamp()
              // additionally pins start/end inside the document bounds.
              trigger: axis,
              start: "clamp(top 75%)",
              end: "clamp(bottom bottom)",
              scrub: 0.4,
              invalidateOnRefresh: true,
            },
          });
        }

        // ── AMBIENT: node dots light as the axis passes them ────────
        gsap.utils.toArray<HTMLElement>("[data-tick]").forEach((tick) => {
          gsap.set(tick, { opacity: 0.25, scale: 0.6 });
          ScrollTrigger.create({
            trigger: tick,
            start: "top 62%",
            onEnter: () =>
              gsap.to(tick, {
                opacity: 1,
                scale: 1,
                duration: 0.42,
                ease: "back.out(2.2)",
              }),
            onLeaveBack: () =>
              gsap.to(tick, { opacity: 0.25, scale: 0.6, duration: 0.2 }),
          });
        });

        // ── section copy: quiet lift, well under the 1/3 rule ───────
        gsap.utils.toArray<HTMLElement>("[data-reveal]").forEach((el) => {
          gsap.from(el, {
            opacity: 0,
            y: 18,
            duration: 0.55,
            ease: EASE,
            scrollTrigger: { trigger: el, start: "top 85%", once: true },
          });
        });

        // ── PRIMARY: spans draw in proportion to real duration ──────
        const bars = gsap.utils.toArray<HTMLElement>("[data-bar]");
        const maxMs = bars.reduce(
          (m, b) => Math.max(m, Number(b.dataset.ms) || 0),
          1,
        );

        const wf = root.current?.querySelector("[data-waterfall]");
        if (wf) {
          gsap.set(bars, { scaleX: 0, transformOrigin: "left center" });

          ScrollTrigger.create({
            trigger: wf,
            start: "top 72%",
            once: true,
            onEnter: () => {
              const children = bars.filter((b) => b.dataset.root !== "true");
              const rootBar = bars.find((b) => b.dataset.root === "true");

              const durations = children.map((b) =>
                drawDuration(Number(b.dataset.ms) || 0, maxMs),
              );
              const total = durations.reduce((a, d) => a + d, 0);

              const tl = gsap.timeline();

              // The child spans run end to end, in request order. Each draws
              // linearly so bar length reads as elapsed time, and each takes
              // as long as it really took: StreamGenerate crawls for two
              // seconds while the own-code spans flick past.
              children.forEach((bar, i) => {
                tl.to(
                  bar,
                  { scaleX: 1, duration: durations[i], ease: "none" },
                  i === 0 ? 0 : ">",
                );
                // the duration cell lands as its own bar finishes
                const cell = bar.closest(".bar-row")?.querySelector("[data-dur]");
                if (cell) tl.to(cell, { opacity: 1, duration: 0.25, ease: EASE }, ">-0.1");
              });

              // The summary bar fills across exactly the same window, so the
              // parent is always the sum of its children rather than a
              // decorative bar racing ahead of them.
              if (rootBar) {
                tl.to(rootBar, { scaleX: 1, duration: total, ease: "none" }, 0);
                const rootCell = rootBar
                  .closest(".bar-row")
                  ?.querySelector("[data-dur]");
                if (rootCell) tl.to(rootCell, { opacity: 1, duration: 0.3 }, 0.1);
              }
            },
          });
          gsap.set("[data-dur]", { opacity: 0.25 });
        }

        // ── quota meters: wave stagger, under the 500ms budget ──────
        const quota = root.current?.querySelector("[data-quota]");
        if (quota) {
          gsap.set("[data-qfill]", { scaleX: 0, transformOrigin: "left center" });
          gsap.to("[data-qfill]", {
            scaleX: 1,
            duration: 0.75,
            ease: EASE,
            stagger: 0.06,
            scrollTrigger: { trigger: quota, start: "top 80%", once: true },
          });
        }
      });

      return () => {
        ScrollTrigger.removeEventListener("refresh", alignAxisEnd);
        mm.revert();
      };
    },
    { scope: root },
  );

  return (
    <div ref={root} className="trace">
      {/* The axis must share the rows' coordinate box. The dots are positioned
          inside .row (which lives in the centred .wrap), so an axis measured
          from the full-width .trace lands ~90px to the left of them. This
          overlay mirrors .wrap's max-width and padding so both agree. */}
      <div className="axis-layer" aria-hidden="true">
        <div className="axis">
          <div className="axis-fill" data-axis-fill />
        </div>
      </div>
      {children}
    </div>
  );
}
