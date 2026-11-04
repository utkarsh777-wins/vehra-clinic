import type { Metadata } from "next"
import { connection } from "next/server"

import { BookingLog } from "@/components/booking-log"
import { viewSecretProblem } from "@/lib/guard"
import { brand } from "@/theme/brand"

export const instant = false

export const metadata: Metadata = {
  title: `Request log · ${brand.shortName}`,
  robots: { index: false, follow: false },
  openGraph: { title: `Request log · ${brand.shortName}`, description: brand.description },
  twitter: { card: "summary", title: `Request log · ${brand.shortName}`, description: brand.description },
}

export default async function BookingsPage() {
  await connection()
  const closed = viewSecretProblem()
  return (
    <main id="main" className="section">
      {closed ? (
        <div className="wrap" style={{ maxWidth: 760 }}>
          <p className="eyebrow">Sample site</p>
          <h1 className="h2">Request log</h1>
          <p className="sec-head__p" style={{ marginTop: 16 }}>
            The request log is closed until BOOKINGS_VIEW_SECRET is set to a private value of at least 16 characters.
          </p>
        </div>
      ) : (
        <BookingLog />
      )}
    </main>
  )
}
