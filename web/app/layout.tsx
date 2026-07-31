import type { Metadata, Viewport } from "next";
import { LangProvider } from "@/lib/i18n";
import "./globals.css";

export const metadata: Metadata = {
  title: "Free Gemini API · REST access to Gemini, without an SDK or a browser",
  description:
    "A thin HTTP proxy exposing the Gemini web StreamGenerate endpoint over REST. Built on Node.js 18 and Elysia, with no Puppeteer and no official SDK in the request path. Independent project, not affiliated with Google.",
  metadataBase: new URL("https://freegemini.felipeestrela.com.br"),
  openGraph: {
    title: "Free Gemini API",
    description: "A thin HTTP proxy exposing Gemini web over REST. Node.js 18 and Elysia.",
    type: "website",
  },
  authors: [{ name: "Felipe Estrela", url: "https://github.com/lipey1" }],
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
        <LangProvider>{children}</LangProvider>
      </body>
    </html>
  );
}
