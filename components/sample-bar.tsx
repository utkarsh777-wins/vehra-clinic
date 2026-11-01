"use client"

import { useLocale } from "@/components/locale"

export function SampleBar() {
  const { t } = useLocale()
  const rest = t.sampleBar.replace(/^Sample site\.?\s*/, "")
  return (
    <div className="sample-bar" role="note">
      <span className="sample-bar__dot" aria-hidden="true" />
      <p>
        <strong>Sample site.</strong> {rest}
      </p>
    </div>
  )
}
