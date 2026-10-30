const paths = [
  "M7.5 3.5c-2.5 0-4 2-4 4.5 0 3 1.4 4.5 1.9 7.5.4 2.6 1 5 2.3 5 1.6 0 1.4-5.5 4.3-5.5s2.7 5.5 4.3 5.5c1.3 0 1.9-2.4 2.3-5 .5-3 1.9-4.5 1.9-7.5 0-2.5-1.5-4.5-4-4.5-1.9 0-2.8 1.2-4.5 1.2S9.4 3.5 7.5 3.5Z",
  "M7.5 3.5c-2.5 0-4 2-4 4.5 0 3 1.4 4.5 1.9 7.5.4 2.6 1 5 2.3 5 1.6 0 1.4-5.5 4.3-5.5s2.7 5.5 4.3 5.5c1.3 0 1.9-2.4 2.3-5 .5-3 1.9-4.5 1.9-7.5 0-2.5-1.5-4.5-4-4.5-1.9 0-2.8 1.2-4.5 1.2S9.4 3.5 7.5 3.5Z",
  "M3 7h18v10a4 4 0 0 1-4 0H7a4 4 0 0 1-4-4Z",
  "M12 3.5a8.5 8.5 0 1 0 0 17 8.5 8.5 0 0 0 0-17Z",
  "M6 3v6a4 4 0 0 0 8 0V3",
  "M4 9c0 6 3.6 10 8 10s8-4 8-10",
]

export function ServiceIcon({ index }: { index: number }) {
  if (index === 1) {
    return (
      <svg className="ico" viewBox="0 0 24 24" aria-hidden="true">
        <path d={paths[0]} />
        <circle cx="12" cy="9.5" r="2" />
      </svg>
    )
  }
  if (index === 2) {
    return (
      <svg className="ico" viewBox="0 0 24 24" aria-hidden="true">
        <rect x="3" y="7" width="18" height="10" rx="4" />
        <path d="M3 12h18M8 7v10M16 7v10" />
      </svg>
    )
  }
  if (index === 3) {
    return (
      <svg className="ico" viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="8.5" />
        <path d="M8.5 14c1 1.4 2.2 2 3.5 2s2.5-.6 3.5-2M9 9.5h.01M15 9.5h.01" />
      </svg>
    )
  }
  if (index === 4) {
    return (
      <svg className="ico" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M6 3v6a4 4 0 0 0 8 0V3M10 13v2a5 5 0 0 0 10 0v-2" />
        <circle cx="20" cy="11" r="2" />
      </svg>
    )
  }
  if (index === 5) {
    return (
      <svg className="ico" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 9c0 6 3.6 10 8 10s8-4 8-10" />
        <path d="M4 9h16M8 9v4M12 9v5M16 9v4" />
      </svg>
    )
  }
  return (
    <svg className="ico" viewBox="0 0 24 24" aria-hidden="true">
      <path d={paths[0]} />
    </svg>
  )
}

export function ArrowIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <path d="M4 10h11m-4-4 4 4-4 4" />
    </svg>
  )
}
