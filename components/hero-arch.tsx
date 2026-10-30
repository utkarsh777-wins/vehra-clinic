const markup = `
  <title id="vehra-ill-title">Illustration: morning over mustard fields, framed by a doorway arch</title>
  <desc id="vehra-ill-desc">A flat illustration of a low sun over rows of yellow mustard and green fields near Phagwara, seen through an arched doorway with an embroidered phulkari border.</desc>
  <defs>
    <clipPath id="vehra-arch"><path d="M0 680V280a280 280 0 0 1 560 0v400z"/></clipPath>
    <linearGradient id="vehra-sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#EFDDB6"/><stop offset=".55" stop-color="#F5E9D0"/><stop offset="1" stop-color="#F7F0E2"/>
    </linearGradient>
    <pattern id="vehra-phulkari" width="40" height="40" patternUnits="userSpaceOnUse">
      <rect width="40" height="40" fill="#1F5A44"/>
      <path d="M20 4 36 20 20 36 4 20z" fill="none" stroke="#E3A62F" stroke-width="2"/>
      <path d="M20 12 28 20 20 28 12 20z" fill="#E3A62F"/>
      <path d="M20 17 23 20 20 23 17 20z" fill="#1F5A44"/>
      <path d="M0 0 4 4M40 0 36 4M0 40 4 36M40 40 36 36" stroke="#C9832A" stroke-width="2"/>
    </pattern>
  </defs>
  <g clip-path="url(#vehra-arch)">
    <rect width="560" height="680" fill="url(#vehra-sky)"/>
    <g class="ill-sun"><circle cx="352" cy="352" r="64" fill="#E3A62F"/><circle cx="352" cy="352" r="82" fill="none" stroke="#E3A62F" stroke-width="2" opacity=".55"/></g>
    <g class="ill-far" fill="#2C6A52">
      <path d="M-10 432c30-10 46-26 70-24s34 18 60 16 40-22 70-20 36 20 66 18 44-16 76-14 40 18 72 16 50-14 70-10 46 14 66 12v60H-10z"/>
      <rect x="92" y="360" width="5" height="70" fill="#1F5A44"/>
      <ellipse cx="94" cy="364" rx="34" ry="26" fill="#1F5A44"/>
      <ellipse cx="74" cy="378" rx="22" ry="16" fill="#1F5A44"/>
    </g>
    <g class="ill-mid">
      <path d="M-10 452c120-14 260-18 400-10s140 10 180 14v104H-10z" fill="#E3A62F"/>
      <g fill="none" stroke="#C9832A" stroke-width="2" stroke-linecap="round" opacity=".8">
        <path d="M-10 478c140-12 330-12 580 2"/><path d="M-10 504c150-12 340-10 580 6"/><path d="M-10 532c160-10 350-6 580 10"/>
      </g>
    </g>
    <g class="ill-near">
      <path d="M-10 556c140-16 300-18 580-4v140H-10z" fill="#1F5A44"/>
      <g stroke="#2C6A52" stroke-width="3" fill="none">
        <path d="M280 556 40 700"/><path d="M280 556 150 700"/><path d="M280 556 260 700"/><path d="M280 556 370 700"/><path d="M280 556 480 700"/><path d="M280 556 600 690"/><path d="M280 556 -40 660"/>
      </g>
      <path d="M262 556h36l40 130h-116z" fill="#D9C7A2" opacity=".9"/>
    </g>
  </g>
  <path d="M0 680V280a280 280 0 0 1 560 0v400" fill="none" stroke="url(#vehra-phulkari)" stroke-width="28"/>
  <path d="M14 680V280a266 266 0 0 1 532 0v400" fill="none" stroke="#1C2420" stroke-opacity=".12" stroke-width="1"/>
`

export function HeroArch({ title, desc }: { title: string; desc: string }) {
  const html = markup
    .replace("Illustration: morning over mustard fields, framed by a doorway arch", title)
    .replace(
      "A flat illustration of a low sun over rows of yellow mustard and green fields near Phagwara, seen through an arched doorway with an embroidered phulkari border.",
      desc,
    )
  return (
    <svg
      className="hero-svg"
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 560 680"
      role="img"
      aria-labelledby="vehra-ill-title vehra-ill-desc"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}
