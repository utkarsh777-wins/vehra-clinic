import type { Metadata } from "next"
import localFont from "next/font/local"
import Script from "next/script"

import { ChatWidget } from "@/components/chat-widget"
import { SampleBar } from "@/components/sample-bar"
import { LocaleProvider } from "@/components/locale"
import { brand } from "@/theme/brand"

import "./globals.css"

const fraunces = localFont({
  src: [
    {
      path: "../node_modules/@fontsource-variable/fraunces/files/fraunces-latin-full-normal.woff2",
      weight: "100 900",
      style: "normal",
    },
    {
      path: "../node_modules/@fontsource-variable/fraunces/files/fraunces-latin-full-italic.woff2",
      weight: "100 900",
      style: "italic",
    },
  ],
  variable: "--font-fraunces",
  display: "swap",
})

const instrument = localFont({
  src: [
    {
      path: "../node_modules/@fontsource-variable/instrument-sans/files/instrument-sans-latin-wght-normal.woff2",
      weight: "400 600",
      style: "normal",
    },
    {
      path: "../node_modules/@fontsource-variable/instrument-sans/files/instrument-sans-latin-wght-italic.woff2",
      weight: "400 600",
      style: "italic",
    },
  ],
  variable: "--font-instrument",
  display: "swap",
})

const mukta = localFont({
  src: [
    { path: "../node_modules/@fontsource/mukta/files/mukta-devanagari-400-normal.woff2", weight: "400", style: "normal" },
    { path: "../node_modules/@fontsource/mukta/files/mukta-devanagari-500-normal.woff2", weight: "500", style: "normal" },
    { path: "../node_modules/@fontsource/mukta/files/mukta-devanagari-600-normal.woff2", weight: "600", style: "normal" },
  ],
  variable: "--font-mukta",
  display: "swap",
})

const mahee = localFont({
  src: [
    {
      path: "../node_modules/@fontsource/mukta-mahee/files/mukta-mahee-gurmukhi-400-normal.woff2",
      weight: "400",
      style: "normal",
    },
    {
      path: "../node_modules/@fontsource/mukta-mahee/files/mukta-mahee-gurmukhi-500-normal.woff2",
      weight: "500",
      style: "normal",
    },
    {
      path: "../node_modules/@fontsource/mukta-mahee/files/mukta-mahee-gurmukhi-600-normal.woff2",
      weight: "600",
      style: "normal",
    },
  ],
  variable: "--font-mahee",
  display: "swap",
})

const title = `${brand.name}, Phagwara`
const description = brand.description

export const metadata: Metadata = {
  title,
  description,
  robots: { index: false, follow: false },
  openGraph: {
    title,
    description,
    siteName: brand.name,
    locale: "en_IN",
    type: "website",
  },
  twitter: {
    card: "summary",
    title,
    description,
  },
}

const themeBoot = `(function(){var q=new URLSearchParams(location.search);var t=q.get("theme");var root=document.documentElement;if(t==="dark"||t==="light")root.dataset.theme=t;else root.dataset.theme=matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";if(!q.has("shot"))root.classList.add("js");})();`

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      data-theme="light"
      className={`${fraunces.variable} ${instrument.variable} ${mukta.variable} ${mahee.variable}`}
    >
      <body>
        <Script id="vehra-theme" strategy="beforeInteractive">
          {themeBoot}
        </Script>
        <a className="skip" href="#main">
          Skip to content
        </a>
        <LocaleProvider>
          <SampleBar />
          {children}
          <ChatWidget />
        </LocaleProvider>
      </body>
    </html>
  )
}
