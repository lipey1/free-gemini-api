"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { TopBar } from "@/components/TopBar";
import { Footer } from "@/components/Footer";
import {
  fetchMe,
  fetchPlans,
  startCheckout,
  type Plan,
  type PublicUser,
} from "@/lib/auth";

gsap.registerPlugin(useGSAP);

type Currency = "BRL" | "USD";

function formatPrice(plan: Plan, currency: Currency) {
  if (currency === "USD") {
    if (plan.priceUsdCents === 0) return { main: "$0", period: "" };
    return {
      main: new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: 0,
      }).format(plan.priceUsd),
      period: "/mo",
    };
  }
  if (plan.priceBrlCents === 0) return { main: "R$ 0", period: "" };
  return {
    main: new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
      maximumFractionDigits: 0,
    }).format(plan.priceBrl),
    period: "/mês",
  };
}

export default function PricingPage() {
  const router = useRouter();
  const rootRef = useRef<HTMLElement>(null);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [stripeEnabled, setStripeEnabled] = useState(false);
  const [user, setUser] = useState<PublicUser | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [currency, setCurrency] = useState<Currency>("BRL");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    Promise.all([fetchPlans(), fetchMe()]).then(([catalog, me]) => {
      setPlans(catalog.plans);
      setStripeEnabled(catalog.stripeEnabled);
      setUser(me?.user ?? null);
      setReady(true);
    });
  }, []);

  useGSAP(
    () => {
      if (!ready || !plans.length) return;

      const mm = gsap.matchMedia();

      mm.add("(prefers-reduced-motion: reduce)", () => {
        gsap.set("[data-price-reveal]", { clearProps: "all" });
      });

      mm.add("(prefers-reduced-motion: no-preference)", () => {
        const head = gsap.utils.toArray<HTMLElement>("[data-price-head]");
        const cards = gsap.utils.toArray<HTMLElement>("[data-price-card]");
        const badge = gsap.utils.toArray<HTMLElement>("[data-price-badge]");

        gsap.fromTo(
          head,
          { autoAlpha: 0, y: 24 },
          { autoAlpha: 1, y: 0, duration: 0.65, ease: "power3.out" },
        );

        gsap.fromTo(
          cards,
          { autoAlpha: 0, y: 36 },
          {
            autoAlpha: 1,
            y: 0,
            duration: 0.6,
            stagger: 0.07,
            delay: 0.12,
            ease: "power3.out",
            clearProps: "transform",
          },
        );

        if (badge.length) {
          gsap.fromTo(
            badge,
            { autoAlpha: 0, y: -6, scale: 0.92 },
            {
              autoAlpha: 1,
              y: 0,
              scale: 1,
              duration: 0.4,
              delay: 0.5,
              ease: "back.out(1.7)",
            },
          );
        }
      });
    },
    {
      scope: rootRef,
      dependencies: [ready, plans.length],
      revertOnUpdate: true,
    },
  );

  useGSAP(
    () => {
      if (!ready || !plans.length) return;
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

      gsap.fromTo(
        "[data-price-amount]",
        { autoAlpha: 0.4, y: 8 },
        {
          autoAlpha: 1,
          y: 0,
          duration: 0.28,
          ease: "power2.out",
          stagger: 0.03,
          overwrite: true,
        },
      );
    },
    {
      scope: rootRef,
      dependencies: [currency, ready, plans.length],
      revertOnUpdate: true,
    },
  );

  async function onSelect(plan: Plan) {
    setError(null);
    if (plan.id === "free") {
      if (!user) router.push("/register/");
      else router.push("/account/");
      return;
    }
    if (!user) {
      router.push(`/login/?next=/pricing/`);
      return;
    }
    if (!plan.checkoutAvailable) {
      setError(
        stripeEnabled
          ? "Stripe Price ID for this plan is missing."
          : "Stripe is not configured on this instance.",
      );
      return;
    }
    setLoadingId(plan.id);
    try {
      const { url } = await startCheckout(plan.id);
      window.location.href = url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Checkout failed.");
      setLoadingId(null);
    }
  }

  return (
    <>
      <TopBar active="pricing" />
      <main className="wrap pricing-page" ref={rootRef}>
        <header className="sec-head" data-price-head data-price-reveal>
          <p className="kicker">Pricing</p>
          <h1>Request plans</h1>
          <p className="measure">
            Limits are requests per minute on <code>/chat</code>. Free stays at
            20/min.
          </p>

          <div className="currency-toggle" role="group" aria-label="Currency">
            <button
              type="button"
              data-on={currency === "BRL"}
              onClick={() => setCurrency("BRL")}
            >
              BRL
            </button>
            <button
              type="button"
              data-on={currency === "USD"}
              onClick={() => setCurrency("USD")}
            >
              USD
            </button>
          </div>
        </header>

        {error ? (
          <div className="form-banner" data-tone="error">
            {error}
          </div>
        ) : null}

        <div className="pricing-grid" data-count={plans.length || 5}>
          {plans.map((plan) => {
            const current = user?.plan === plan.id;
            const price = formatPrice(plan, currency);
            const featured = plan.popular || plan.highlight;

            return (
              <article
                key={plan.id}
                className="price-card"
                data-price-card
                data-price-reveal
                data-featured={featured ? "true" : "false"}
                data-current={current ? "true" : "false"}
                data-plan={plan.id}
                onMouseEnter={(e) => {
                  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
                  gsap.to(e.currentTarget, {
                    y: -6,
                    duration: 0.28,
                    ease: "power2.out",
                    overwrite: "auto",
                  });
                }}
                onMouseLeave={(e) => {
                  gsap.to(e.currentTarget, {
                    y: 0,
                    duration: 0.35,
                    ease: "power2.out",
                    overwrite: "auto",
                  });
                }}
              >
                {plan.popular ? (
                  <span className="price-badge" data-price-badge>
                    <span data-l="en">Most bought</span>
                    <span data-l="pt">Mais comprado</span>
                  </span>
                ) : null}

                <header className="price-card-head">
                  <h2>{plan.name}</h2>
                  <p className="price-amount" data-price-amount>
                    {price.main}
                    {price.period ? <span>{price.period}</span> : null}
                  </p>
                  <p className="price-alt">
                    {currency === "BRL"
                      ? plan.priceUsdCents === 0
                        ? "$0"
                        : `≈ $${plan.priceUsd}/mo`
                      : plan.priceBrlCents === 0
                        ? "R$ 0"
                        : `≈ R$ ${plan.priceBrl}/mês`}
                  </p>
                  <p className="price-rpm">
                    <b>{plan.rpm.toLocaleString(currency === "BRL" ? "pt-BR" : "en-US")}</b>{" "}
                    req/min
                  </p>
                </header>

                <ul>
                  {plan.features.map((f) => (
                    <li key={f}>{f}</li>
                  ))}
                </ul>

                <button
                  type="button"
                  className={featured ? "btn btn-primary" : "btn btn-ghost"}
                  disabled={loadingId === plan.id || current}
                  onClick={() => onSelect(plan)}
                >
                  {current
                    ? "Current plan"
                    : loadingId === plan.id
                      ? "Redirecting…"
                      : plan.id === "free"
                        ? user
                          ? "Stay on Free"
                          : "Start free"
                        : "Subscribe"}
                </button>
              </article>
            );
          })}
        </div>

        {!stripeEnabled ? (
          <p className="pricing-note">
            Stripe keys are not set on this instance. Checkout buttons stay
            disabled until <code>STRIPE_SECRET_KEY</code> and price IDs are
            configured.
          </p>
        ) : null}
      </main>
      <Footer />
    </>
  );
}
