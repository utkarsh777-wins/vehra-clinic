"use client"

import { useLocale } from "@/components/locale"

export function DemoBar() {
  const { t } = useLocale()
  const rest = t.demoBar.replace(/^Demo, fictional business\.?\s*/, "")
  return (
    <div className="demo-bar" role="note">
      <span className="demo-bar__dot" aria-hidden="true" />
      <p>
        <strong>Demo, fictional business.</strong> {rest}
      </p>
    </div>
  )
}
