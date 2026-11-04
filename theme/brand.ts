/**
 * Drop-in brand spec for Vehra Dental & Family Clinic.
 *
 * Colour, type and spacing tokens are applied in app/globals.css
 * (ported from the design handoff). Change the public name here;
 * the page and the assistant both read it. Keep the hex values in
 * this file and in globals.css together if a new palette arrives.
 *
 * Fonts are self-hosted in app/layout.tsx with next/font:
 * Fraunces (display), Instrument Sans (UI), Mukta (Hindi), Mukta Mahee (Punjabi).
 */

export const brand = {
  name: "Vehra Dental & Family Clinic",
  shortName: "Vehra",
  sampleLabel: "Sample site",
  city: "Phagwara",
  region: "Punjab",
  tagline: "Care that takes its time.",
  description:
    "Sample site for a fictional dental and family clinic in Phagwara, Punjab. It does not provide medical care.",
  fonts: {
    display: "Fraunces",
    body: "Instrument Sans",
    hindi: "Mukta",
    punjabi: "Mukta Mahee",
  },
  radius: {
    sm: "8px",
    md: "14px",
    lg: "22px",
    full: "999px",
  },
  colors: {
    light: {
      bg: "#F7F3EC",
      surface: "#FFFDF8",
      surface2: "#EFE8DC",
      line: "#E3DCCF",
      lineStrong: "#85877F",
      fg: "#1C2420",
      fg2: "#474E49",
      fg3: "#62675F",
      primary: "#1F5A44",
      primaryHover: "#17473A",
      onPrimary: "#FFFDF8",
      primarySoft: "#E2EDE5",
      mustard: "#E3A62F",
      mustardText: "#8A5A0B",
      mustardSoft: "#F6E7C4",
      error: "#A8322A",
      errorSoft: "#F6E2DE",
      barBg: "#1C2420",
      barFg: "#F7F3EC",
    },
    dark: {
      bg: "#111412",
      surface: "#191D1A",
      surface2: "#1F2420",
      line: "#2A302B",
      lineStrong: "#6A7068",
      fg: "#EEE8DD",
      fg2: "#B9B6AD",
      fg3: "#8F8E86",
      primary: "#7CC4A0",
      primaryHover: "#95D2B2",
      onPrimary: "#0F1A14",
      primarySoft: "#1E3329",
      mustard: "#E8B04A",
      mustardText: "#E8B04A",
      mustardSoft: "#33291A",
      error: "#F08A7E",
      errorSoft: "#3A201D",
      barBg: "#232A25",
      barFg: "#EEE8DD",
    },
  },
} as const
