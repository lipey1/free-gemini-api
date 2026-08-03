"use client";

import Link from "next/link";
import {
  ReactNode,
  useEffect,
  useLayoutEffect,
  useRef,
} from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { Lockup, LogoMark } from "@/components/Logo";

gsap.registerPlugin(useGSAP);

export type DashSection = "overview" | "keys" | "security" | "billing";

const NAV: Array<{
  id: DashSection;
  label: string;
  hint: string;
  index: string;
  icon: ReactNode;
}> = [
  {
    id: "overview",
    label: "Overview",
    hint: "Usage & limits",
    index: "01",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M4 19V5M4 19h16" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        <path d="M8 15v-4M12 15V8M16 15v-6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    id: "keys",
    label: "API keys",
    hint: "Auth headers",
    index: "02",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle cx="8" cy="12" r="3.2" stroke="currentColor" strokeWidth="1.6" />
        <path d="M11 12h9M17 12v3M20 12v2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    id: "security",
    label: "Security",
    hint: "2FA & access",
    index: "03",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M12 3 5 6.5v5c0 4.2 2.8 7.5 7 8.5 4.2-1 7-4.3 7-8.5v-5L12 3Z"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
  {
    id: "billing",
    label: "Billing",
    hint: "Plan & Stripe",
    index: "04",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <rect x="3.5" y="6" width="17" height="12" rx="2" stroke="currentColor" strokeWidth="1.6" />
        <path d="M3.5 10h17" stroke="currentColor" strokeWidth="1.6" />
      </svg>
    ),
  },
];

function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function DashboardShell({
  section,
  onSection,
  userLabel,
  planLabel,
  rpm,
  isAdmin,
  onLogout,
  children,
}: {
  section: DashSection;
  onSection: (s: DashSection) => void;
  userLabel: string;
  planLabel: string;
  rpm: number;
  isAdmin?: boolean;
  onLogout: () => void;
  children: ReactNode;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const navRef = useRef<HTMLElement>(null);
  const pillRef = useRef<HTMLSpanElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const title = NAV.find((n) => n.id === section)?.label || "Dashboard";

  useGSAP(
    () => {
      if (prefersReducedMotion()) return;
      const tl = gsap.timeline({ defaults: { ease: "power3.out" } });
      tl.from(".dash-side-top, .dash-nav-item, .dash-side-links, .dash-side-account", {
        autoAlpha: 0,
        x: -12,
        duration: 0.45,
        stagger: 0.045,
      }).from(
        ".dash-top h1",
        { autoAlpha: 0, y: 10, duration: 0.4 },
        "-=0.25",
      );
    },
    { scope: rootRef },
  );

  useLayoutEffect(() => {
    const nav = navRef.current;
    const pill = pillRef.current;
    if (!nav || !pill) return;
    const active = nav.querySelector<HTMLElement>(
      `.dash-nav-item[data-active="true"]`,
    );
    if (!active) return;

    const navBox = nav.getBoundingClientRect();
    const box = active.getBoundingClientRect();
    const next = {
      y: box.top - navBox.top,
      height: box.height,
    };

    if (prefersReducedMotion()) {
      gsap.set(pill, { y: next.y, height: next.height, autoAlpha: 1 });
      return;
    }

    gsap.to(pill, {
      y: next.y,
      height: next.height,
      autoAlpha: 1,
      duration: 0.35,
      ease: "power3.out",
    });
  }, [section, isAdmin]);

  useEffect(() => {
    const titleEl = titleRef.current;
    const bodyEl = bodyRef.current;
    if (!titleEl || !bodyEl) return;

    if (prefersReducedMotion()) {
      gsap.set([titleEl, bodyEl], { clearProps: "all" });
      return;
    }

    gsap.fromTo(
      titleEl,
      { autoAlpha: 0, y: 8, filter: "blur(4px)" },
      { autoAlpha: 1, y: 0, filter: "blur(0px)", duration: 0.35, ease: "power2.out" },
    );
    const items = bodyEl.querySelectorAll("[data-dash-animate]");
    if (!items.length) return;
    gsap.fromTo(
      items,
      { autoAlpha: 0, y: 14 },
      {
        autoAlpha: 1,
        y: 0,
        duration: 0.4,
        stagger: 0.05,
        ease: "power3.out",
      },
    );
  }, [section]);

  return (
    <div className="dash" ref={rootRef}>
      <aside className="dash-side">
        <div className="dash-side-top">
          <Lockup />
        </div>

        <nav className="dash-nav" aria-label="Account" ref={navRef}>
          <span className="dash-nav-pill" ref={pillRef} aria-hidden="true" />
          {NAV.map((item) => (
            <button
              key={item.id}
              type="button"
              className="dash-nav-item"
              data-active={section === item.id}
              onClick={() => onSection(item.id)}
            >
              <span className="dash-nav-index mono" aria-hidden="true">
                {item.index}
              </span>
              <span className="dash-nav-ico">{item.icon}</span>
              <span className="dash-nav-copy">
                <span className="dash-nav-label">{item.label}</span>
                <span className="dash-nav-hint">{item.hint}</span>
              </span>
            </button>
          ))}
          {isAdmin ? (
            <Link href="/admin/" className="dash-nav-item">
              <span className="dash-nav-index mono" aria-hidden="true">
                05
              </span>
              <span className="dash-nav-ico" aria-hidden="true">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="8" r="3.2" stroke="currentColor" strokeWidth="1.6" />
                  <path
                    d="M5 19c1.4-3 3.8-4.5 7-4.5s5.6 1.5 7 4.5"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                  />
                </svg>
              </span>
              <span className="dash-nav-copy">
                <span className="dash-nav-label">Admin</span>
                <span className="dash-nav-hint">Users & plans</span>
              </span>
            </Link>
          ) : null}
        </nav>

        <div className="dash-side-links">
          <Link href="/playground/">Console</Link>
          <Link href="/pricing/">Pricing</Link>
          <Link href="/">Site</Link>
        </div>

        <div className="dash-side-account">
          <div className="dash-avatar" aria-hidden="true">
            <LogoMark size={18} />
          </div>
          <div className="dash-side-account-text">
            <div className="dash-side-account-name">{userLabel}</div>
            <div className="dash-side-account-meta">
              {planLabel} · {rpm.toLocaleString()} rpm
            </div>
          </div>
          <button
            type="button"
            className="dash-signout"
            onClick={onLogout}
            aria-label="Sign out"
            title="Sign out"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M10 5H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h4M14 16l4-4-4-4M18 12H9"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>
      </aside>

      <div className="dash-main">
        <header className="dash-top">
          <p className="dash-top-kicker mono">Account console</p>
          <h1 ref={titleRef}>{title}</h1>
        </header>
        <div className="dash-body" ref={bodyRef} key={section}>
          {children}
        </div>
      </div>
    </div>
  );
}
