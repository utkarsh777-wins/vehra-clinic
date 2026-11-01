"use client"

import { useEffect, useState } from "react"

import { HeroArch } from "@/components/hero-arch"
import { LanguageSwitch, openChat, useLocale } from "@/components/locale"
import { ArrowIcon, ServiceIcon } from "@/components/service-icons"
import { getClinic } from "@/lib/clinic"
import { openTodayLabel } from "@/lib/open-status"

const PHONE_TEL = "tel:+910000000000"
const PHONE_LABEL = "+91 00000 00000"
const DIRECTIONS = "https://www.openstreetmap.org/search?query=Banga%20Road%2C%20Phagwara"

export function HomePage({ whatsappHref }: { whatsappHref: string }) {
  const { t } = useLocale()

  useEffect(() => {
    const root = document.documentElement
    const shot = new URLSearchParams(window.location.search).has("shot")
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    root.querySelectorAll<HTMLElement>(".hero__copy > *").forEach((el, index) => {
      el.style.setProperty("--i", String(index))
    })
    root.querySelectorAll<HTMLElement>(".reveal-group").forEach((group) => {
      ;[...group.children].forEach((child, index) => {
        ;(child as HTMLElement).style.setProperty("--i", String(index))
      })
    })
    if (!shot && "IntersectionObserver" in window) {
      const seen = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (!entry.isIntersecting) return
            entry.target.classList.add("is-in")
            seen.unobserve(entry.target)
          })
        },
        { rootMargin: "0px 0px -10% 0px", threshold: 0.12 },
      )
      root.querySelectorAll(".reveal").forEach((el) => seen.observe(el))
    } else {
      root.querySelectorAll(".reveal").forEach((el) => el.classList.add("is-in"))
    }

    const nav = root.querySelector(".nav")
    const layers: [Element | null, number][] = [
      [root.querySelector(".ill-far"), 0.02],
      [root.querySelector(".ill-mid"), 0.035],
      [root.querySelector(".ill-near"), 0.05],
      [root.querySelector(".ill-sun"), -0.03],
    ]
    const fine = window.matchMedia("(pointer:fine) and (min-width:900px)").matches
    let ticking = false
    const onScroll = () => {
      if (ticking) return
      ticking = true
      requestAnimationFrame(() => {
        const y = window.scrollY
        nav?.classList.toggle("is-stuck", y > 8)
        if (fine && !reduce && !shot && y < 900) {
          layers.forEach(([el, factor]) => {
            if (el instanceof HTMLElement || el instanceof SVGElement) {
              el.style.transform = `translateY(${Math.min(14, y * factor).toFixed(2)}px)`
            }
          })
        }
        ticking = false
      })
    }
    onScroll()
    window.addEventListener("scroll", onScroll, { passive: true })

    const ctas = root.querySelector(".hero__ctas")
    const small = window.matchMedia("(max-width: 599px)")
    const params = new URLSearchParams(window.location.search)
    if (shot && small.matches && !params.has("full")) {
      document.body.classList.add("hero-ctas-visible")
    }
    let ctaWatch: IntersectionObserver | undefined
    if (ctas && "IntersectionObserver" in window && !shot) {
      ctaWatch = new IntersectionObserver(([entry]) => {
        document.body.classList.toggle("hero-ctas-visible", entry.isIntersecting && small.matches)
      })
      ctaWatch.observe(ctas)
    }

    return () => {
      window.removeEventListener("scroll", onScroll)
      ctaWatch?.disconnect()
    }
  }, [])

  return (
    <>
      <header className="nav" id="top">
        <div className="wrap nav__in">
          <a className="brand" href="#top" aria-label={t.nav.home}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/monogram.svg" width="32" height="32" alt="" />
            <span className="brand__word">
              Vehra<span className="brand__sub">Dental & Family Clinic</span>
            </span>
          </a>
          <nav className="nav__links" aria-label="Primary">
            <a href="#services">{t.nav.services}</a>
            <a href="#doctors">{t.nav.doctors}</a>
            <a href="#visit">{t.nav.visit}</a>
            <a href="#faq">{t.nav.faq}</a>
          </nav>
          <div className="nav__actions">
            <LanguageSwitch label={t.chat.lang} />
            <button className="btn btn--primary btn--sm nav__cta" type="button" onClick={() => openChat("book")}>
              {t.nav.book}
            </button>
          </div>
        </div>
      </header>

      <main id="main">
        <section className="hero" aria-labelledby="hero-h">
          <div className="wrap hero__grid">
            <div className="hero__copy">
              <p className="tag">
                <span aria-hidden="true">●</span> {t.hero.tag}
              </p>
              <p className="eyebrow">{t.hero.eyebrow}</p>
              <h1 id="hero-h" className="display">
                {t.hero.line2 ? (
                  <>
                    <span className="line">{t.hero.line1}</span>{" "}
                    <span className="line">
                      {t.hero.line2} <em>{t.hero.em}</em>.
                    </span>
                  </>
                ) : (
                  <span className="line">{t.hero.line1}</span>
                )}
              </h1>
              <p className="lede">{t.hero.lede}</p>
              <div className="hero__ctas">
                <button className="btn btn--primary" type="button" onClick={() => openChat("book")}>
                  {t.hero.book} <ArrowIcon />
                </button>
                <button className="btn btn--ghost" type="button" onClick={() => openChat()}>
                  {t.hero.ask}
                </button>
              </div>
              <dl className="hero__facts">
                <div>
                  <dt>{t.hero.today}</dt>
                  <dd>{t.hero.todayValue}</dd>
                </div>
                <div>
                  <dt>{t.hero.walkins}</dt>
                  <dd>{t.hero.walkinsValue}</dd>
                </div>
              </dl>
            </div>
            <figure className="hero__art">
              <HeroArch title={t.hero.illTitle} desc={t.hero.illDesc} />
              <figcaption className="hero__card">
                <span className="hero__card-k">{t.hero.sample}</span>
                <HeroHours />
              </figcaption>
            </figure>
          </div>
        </section>

        <section className="section" id="services" aria-labelledby="svc-h">
          <div className="wrap">
            <header className="sec-head reveal">
              <p className="eyebrow">{t.services.eyebrow}</p>
              <h2 id="svc-h" className="h2">
                {t.services.title}
              </h2>
              <p className="sec-head__p">{t.services.lede}</p>
            </header>
            <ul className="svc reveal-group">
              {t.services.items.map(([title, body], index) => (
                <li className="svc__item reveal" key={title}>
                  <ServiceIcon index={index} />
                  <h3>{title}</h3>
                  <p>{body}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="section section--alt" id="doctors" aria-labelledby="doc-h">
          <div className="wrap doc">
            <header className="sec-head reveal">
              <p className="eyebrow">{t.doctors.eyebrow}</p>
              <h2 id="doc-h" className="h2">
                {t.doctors.title}
              </h2>
              <p className="sec-head__p">{t.doctors.lede}</p>
            </header>
            <div className="doc__cards reveal-group">
              {t.doctors.people.map(([name, initials, role, note, languages], index) => (
                <article className="person reveal" key={name}>
                  <div className={index === 0 ? "avatar" : "avatar avatar--b"} aria-hidden="true">
                    {initials}
                  </div>
                  <div>
                    <h3>{name}</h3>
                    <p className="person__role">{role}</p>
                    <p className="person__note">{note}</p>
                    <p className="person__lang">{languages}</p>
                  </div>
                </article>
              ))}
            </div>
            <div className="hours reveal">
              <table>
                <caption>
                  {t.doctors.caption} <span className="ph">sample</span>
                </caption>
                <thead>
                  <tr>
                    {t.doctors.cols.map((col) => (
                      <th key={col} scope="col">
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {t.doctors.rows.map(([day, morning, evening]) => (
                    <tr key={day}>
                      <th scope="row">{day}</th>
                      <td>{morning}</td>
                      <td>{evening}</td>
                    </tr>
                  ))}
                  <tr>
                    <th scope="row">{t.doctors.sunday}</th>
                    <td colSpan={2} className="muted">
                      {t.doctors.closed}
                    </td>
                  </tr>
                </tbody>
              </table>
              <p className="hours__note">{t.doctors.note}</p>
            </div>
          </div>
        </section>

        <section className="section" id="why" aria-labelledby="why-h">
          <div className="wrap why">
            <header className="sec-head reveal">
              <p className="eyebrow">{t.why.eyebrow}</p>
              <h2 id="why-h" className="h2">
                {t.why.title}
              </h2>
            </header>
            <ol className="why__list reveal-group">
              {t.why.items.map(([title, body], index) => (
                <li className="reveal" key={title}>
                  <span className="why__n">{String(index + 1).padStart(2, "0")}</span>
                  <h3>{title}</h3>
                  <p>{body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="section section--alt" id="visit" aria-labelledby="visit-h">
          <div className="wrap visit">
            <div className="visit__copy reveal">
              <p className="eyebrow">{t.visit.eyebrow}</p>
              <h2 id="visit-h" className="h2">
                {t.visit.title}
              </h2>
              <address>
                {t.visit.lines.map((line) => (
                  <span key={line}>
                    {line}
                    <br />
                  </span>
                ))}
              </address>
              <p className="flag">{t.visit.flag}</p>
              <ul className="visit__meta">
                <li>
                  <span>{t.visit.phone}</span>
                  <a href={PHONE_TEL}>{PHONE_LABEL}</a> <span className="ph">placeholder</span>
                </li>
                <li>
                  <span>{t.visit.whatsapp}</span>
                  <a href={whatsappHref}>WhatsApp</a> <span className="ph">placeholder</span>
                </li>
                <li>
                  <span>{t.visit.parking}</span>
                  {t.visit.parkingValue}
                </li>
                <li>
                  <span>{t.visit.access}</span>
                  {t.visit.accessValue}
                </li>
              </ul>
              <div className="visit__ctas">
                <button className="btn btn--primary" type="button" onClick={() => openChat("book")}>
                  {t.visit.book}
                </button>
                <a className="btn btn--ghost" href={DIRECTIONS}>
                  {t.visit.directions}
                </a>
              </div>
            </div>
            <div className="map reveal">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img className="map__img" src="/map-schematic.svg" alt={t.visit.mapAlt} />
              <div className="map__pin" aria-hidden="true">
                <span>{t.visit.pin}</span>
              </div>
              <p className="map__note">{t.visit.mapNote}</p>
            </div>
          </div>
        </section>

        <section className="section" id="faq" aria-labelledby="faq-h">
          <div className="wrap faq">
            <header className="sec-head reveal">
              <p className="eyebrow">{t.faq.eyebrow}</p>
              <h2 id="faq-h" className="h2">
                {t.faq.title}
              </h2>
              <p className="sec-head__p">
                {t.faq.before}{" "}
                <button className="link" type="button" onClick={() => openChat()}>
                  {t.faq.ask}
                </button>{" "}
                {t.faq.after}
              </p>
            </header>
            <div className="faq__list reveal">
              {t.faq.items.map(([question, answer], index) => (
                <details key={question} open={index === 0}>
                  <summary>{question}</summary>
                  <p>
                    {answer}
                    {index === 4 ? (
                      <>
                        {" "}
                        <span className="ph">sample</span>
                      </>
                    ) : null}
                  </p>
                </details>
              ))}
            </div>
          </div>
        </section>

        <section className="cta-band" id="book" aria-labelledby="book-h">
          <div className="wrap cta-band__in reveal">
            <h2 id="book-h" className="h2">
              {t.cta.title}
            </h2>
            <p>{t.cta.body}</p>
            <div className="hero__ctas">
              <button className="btn btn--light" type="button" onClick={() => openChat("book")}>
                {t.cta.request}
              </button>
              <a className="btn btn--outline-light" href={PHONE_TEL}>
                {t.cta.call}
              </a>
            </div>
          </div>
        </section>
      </main>

      <footer className="foot">
        <div className="wrap foot__grid">
          <div>
            <a className="brand" href="#top">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/monogram.svg" width="28" height="28" alt="" />
              <span className="brand__word">Vehra</span>
            </a>
            <p className="foot__p">{t.footer.blurb}</p>
          </div>
          <div>
            <h3>{t.footer.visit}</h3>
            <p>
              {t.footer.address}
              <br />
              {t.footer.region} <span className="ph">fictional</span>
            </p>
          </div>
          <div>
            <h3>{t.footer.timings}</h3>
            <p>
              {t.footer.hours}
              <br />
              {t.footer.sunday} <span className="ph">sample</span>
            </p>
          </div>
          <div>
            <h3>{t.footer.explore}</h3>
            <p>
              <a href="#services">{t.footer.services}</a>
              <br />
              <a href="#doctors">{t.footer.doctors}</a>
              <br />
              <a href="#faq">{t.footer.faq}</a>
              <br />
              <a href="/bookings">{t.footer.log}</a>
            </p>
          </div>
        </div>
        <div className="wrap foot__legal">
          <p>
            <strong>Sample site.</strong> {t.footer.legal}
          </p>
          <p>{t.footer.credit}</p>
        </div>
      </footer>
    </>
  )
}

function HeroHours() {
  const { locale } = useLocale()
  const [status, setStatus] = useState<{ closed: boolean; label: string } | null>(null)
  useEffect(() => {
    // The clock is read after mount so the prerender does not bake in a build-time instant.
    /* eslint-disable react-hooks/set-state-in-effect */
    setStatus(openTodayLabel(new Date(), locale, getClinic().hours))
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [locale])
  return (
    <span className="hero__card-v">
      <span className={status?.closed === false ? "dot dot--open" : "dot dot--off"} aria-hidden="true" />
      {status?.label ?? "…"}
    </span>
  )
}
