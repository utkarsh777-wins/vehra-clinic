import { readFileSync } from "node:fs"
import path from "node:path"
import { runInNewContext } from "node:vm"
import { describe, expect, it } from "vitest"

const layout = readFileSync(path.join(process.cwd(), "app/layout.tsx"), "utf8")

function htmlTag() {
  const match = layout.match(/<html\b[\s\S]*?>/)
  if (!match) throw new Error("root layout is missing an html tag")
  return match[0]
}

function themeBootSource() {
  const match = layout.match(/const themeBoot = `([\s\S]*?)`/)
  if (!match) throw new Error("root layout is missing themeBoot")
  return match[1]
}

function boot(search: string, prefersDark: boolean) {
  const classes: string[] = []
  const root = {
    dataset: { theme: "light" },
    classList: {
      add(token: string) {
        classes.push(token)
      },
    },
  }
  runInNewContext(themeBootSource(), {
    URLSearchParams,
    location: { search },
    document: { documentElement: root },
    matchMedia: () => ({ matches: prefersDark }),
  })
  return { theme: root.dataset.theme, classes }
}

describe("pre-hydration html state", () => {
  it("tells React the boot script may change html before hydration", () => {
    expect(htmlTag()).toContain("suppressHydrationWarning")
  })

  it("keeps the js class off the server markup and off shot loads", () => {
    expect(htmlTag()).not.toMatch(/className=\{[^}]*\bjs\b/)
    expect(boot("", false)).toEqual({ theme: "light", classes: ["js"] })
    expect(boot("", true)).toEqual({ theme: "dark", classes: ["js"] })
    expect(boot("?theme=dark", false)).toEqual({ theme: "dark", classes: ["js"] })
    expect(boot("?theme=light", true)).toEqual({ theme: "light", classes: ["js"] })
    expect(boot("?theme=sepia", true)).toEqual({ theme: "dark", classes: ["js"] })
    expect(boot("?shot=1", true)).toEqual({ theme: "dark", classes: [] })
    expect(boot("?shot", false)).toEqual({ theme: "light", classes: [] })
  })
})
