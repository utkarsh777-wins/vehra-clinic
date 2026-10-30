import type { Metadata } from "next"

import { BookingLog } from "@/components/booking-log"
import { brand } from "@/theme/brand"

export const metadata: Metadata = {
  title: `Demo booking log · ${brand.shortName}`,
  robots: { index: false, follow: false },
}

export default function BookingsPage() {
  return (
    <main id="main" className="section">
      <BookingLog />
    </main>
  )
}
