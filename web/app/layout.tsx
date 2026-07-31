import type { Metadata, Viewport } from "next";
import { LangProvider } from "@/lib/i18n";
import "./globals.css";

const SITE_URL = "https://freegemini.felipeestrela.com.br";

const DESCRIPTION =
  "A thin HTTP proxy exposing the Gemini web StreamGenerate endpoint over REST. " +
  "Built on Node.js and Elysia, with no Puppeteer and no official SDK in the " +
  "request path. Independent project, not affiliated with Google.";

// A screenshot of the live landing page. Link unfurls (Discord, Slack, X,
// iMessage) show this instead of a bare title and blurb.
const OG_IMAGE = {
  url: "/og.png",
  width: 2400,
  height: 1260,
  alt: "Free Gemini API landing page: a runnable cURL example against the /chat endpoint.",
};

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Free Gemini API · REST access to Gemini, without an SDK or a browser",
    // Sub-pages set only their own title; this keeps the brand on the end.
    template: "%s · Free Gemini API",
  },
  description: DESCRIPTION,
  applicationName: "Free Gemini API",
  keywords: [
    "gemini api",
    "free gemini api",
    "gemini rest api",
    "gemini http proxy",
    "gemini without sdk",
    "streamgenerate",
    "elysia",
    "node.js",
  ],
  authors: [{ name: "Felipe Estrela", url: "https://github.com/lipey1" }],
  creator: "Felipe Estrela",
  alternates: { canonical: "/" },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large" },
  },
  openGraph: {
    type: "website",
    url: "/",
    siteName: "Free Gemini API",
    title: "Free Gemini API · REST access to Gemini",
    description:
      "A thin HTTP proxy exposing Gemini web over REST. Node.js and Elysia, " +
      "no Puppeteer, no official SDK.",
    locale: "en_US",
    alternateLocale: ["pt_BR"],
    images: [OG_IMAGE],
  },
  twitter: {
    // Renders the screenshot full-width rather than as a thumbnail.
    card: "summary_large_image",
    title: "Free Gemini API · REST access to Gemini",
    description:
      "A thin HTTP proxy exposing Gemini web over REST. Node.js and Elysia, " +
      "no Puppeteer, no official SDK.",
    images: [OG_IMAGE.url],
  },
};

export const viewport: Viewport = {
  themeColor: "#0A0A0B",
  colorScheme: "dark",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        {/* Runs before first paint so the correct language is the only one
            ever rendered. Without it the pre-rendered English markup paints,
            then hydration swaps it, and Portuguese visitors see a flicker. */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "(function(){try{var l=localStorage.getItem('fga.lang');" +
              "if(l!=='en'&&l!=='pt'){l=(navigator.language||'').toLowerCase()" +
              ".indexOf('pt')===0?'pt':'en';}" +
              "var d=document.documentElement;d.setAttribute('data-lang',l);" +
              "d.lang=l==='pt'?'pt-BR':'en';}" +
              "catch(e){document.documentElement.setAttribute('data-lang','en');}})()",
          }}
        />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;700&display=swap"
          rel="stylesheet"
        />
        <link
          rel="icon"
          href={
            "data:image/svg+xml," +
            encodeURIComponent(
              '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">' +
                '<path d="M14 5 5 16l9 11" stroke="#4F8CFF" stroke-width="3.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/>' +
                '<path d="M18 5l9 11-9 11" stroke="#FAFAFA" stroke-width="3.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/>' +
                "</svg>",
            )
          }
        />
      </head>
      <body>
        {/* Schema.org description of the project, for search result rich data. */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "SoftwareApplication",
              name: "Free Gemini API",
              applicationCategory: "DeveloperApplication",
              operatingSystem: "Node.js",
              description: DESCRIPTION,
              url: SITE_URL,
              image: `${SITE_URL}/og.png`,
              codeRepository: "https://github.com/lipey1/free-gemini-api",
              license: "https://opensource.org/licenses/ISC",
              author: {
                "@type": "Person",
                name: "Felipe Estrela",
                url: "https://github.com/lipey1",
              },
              offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
            }),
          }}
        />
        <LangProvider>{children}</LangProvider>
      </body>
    </html>
  );
}
