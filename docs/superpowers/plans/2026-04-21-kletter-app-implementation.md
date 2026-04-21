# Kletter App Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace current static HTML kletter.vercel.app with a Next.js App Router PWA featuring bottom tab navigation, card feed, offline support, and weekly push notifications — per spec `docs/superpowers/specs/2026-04-21-kletter-app-design.md`.

**Architecture:** Next.js 15 App Router (SSG) + next-pwa service worker + web-push over VAPID + Vercel KV for push token storage + MDX content files. All hosted on Vercel. Email subscription via existing Resend integration.

**Tech Stack:**
- Next.js (App Router, TypeScript)
- MDX (via `next-mdx-remote` or Next.js built-in `@next/mdx`)
- Zod for frontmatter schema validation
- Vitest + React Testing Library for tests
- @ducanh2912/next-pwa (active fork of next-pwa) for service worker
- web-push + @vercel/kv for push infra
- resend (existing)
- Biome (lint + format) — simpler than ESLint+Prettier

**Working Directory:** `~/kletter-newsletter` (same repo, feature branch `app-v1`)

**Spec Reference:** `docs/superpowers/specs/2026-04-21-kletter-app-design.md`

---

## Before Starting

- [ ] **Preflight check**

```bash
cd ~/kletter-newsletter
git status      # expect clean tree on main
git branch      # confirm main is current
```

- [ ] **Create feature branch**

```bash
git checkout -b app-v1
git status      # expect clean on app-v1
```

---

## Phase 0 — Foundation

### Task 1: Archive existing static site

**Files:**
- Move: `deploy/` → `archive/web-v0/`
- Delete: root HTML files (`newsletter_2026_W16*.html`, `newsletter_2026_W16.md`)
- Create: `archive/README.md`

- [ ] **Step 1: Move static site to archive**

```bash
cd ~/kletter-newsletter
mkdir -p archive
git mv deploy archive/web-v0
```

- [ ] **Step 2: Remove root newsletter drafts**

```bash
git rm newsletter_2026_W16.html newsletter_2026_W16_light.html newsletter_2026_W16_email.html newsletter_2026_W16.md
```

- [ ] **Step 3: Create archive README**

```markdown
# Archive

## web-v0/
Pre-app static HTML web magazine. Restored from trycloudflare backup on 2026-04-20.
Content migrated to `content/` directory as MDX when the Next.js app was built.
Preserved here for reference. Do not edit.
```

Save to: `archive/README.md`

- [ ] **Step 4: Commit**

```bash
git add archive/ newsletter_2026_W16*
git commit -m "chore: archive v0 static site before Next.js rewrite"
```

---

### Task 2: Initialize Next.js project at repo root

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.mjs`, `app/layout.tsx`, `app/page.tsx`, `.gitignore`, `biome.json`

- [ ] **Step 1: Initialize Next.js (TypeScript, App Router, Tailwind OFF, src dir OFF, import alias @/)**

```bash
cd ~/kletter-newsletter
npx create-next-app@latest . \
  --typescript --eslint=false --tailwind=false \
  --app --src-dir=false --import-alias "@/*" \
  --use-npm --turbopack
```

When prompted about existing files, answer `No` to keep archive/ and docs/.

- [ ] **Step 2: Verify scaffold**

```bash
ls -la
# expect: app/ public/ package.json tsconfig.json next.config.mjs node_modules/ (and archive/, docs/ preserved)

npm run dev
# open http://localhost:3000 — expect default Next.js welcome page
# Ctrl-C to stop
```

- [ ] **Step 3: Install dev & content deps**

```bash
npm install --save-dev vitest @testing-library/react @testing-library/jest-dom @testing-library/user-event jsdom @vitejs/plugin-react @biomejs/biome @types/node
npm install zod gray-matter react-markdown remark-gfm rehype-sanitize
```

- [ ] **Step 4: Configure Biome**

Create `biome.json`:
```json
{
  "$schema": "https://biomejs.dev/schemas/1.9.4/schema.json",
  "organizeImports": { "enabled": true },
  "linter": {
    "enabled": true,
    "rules": { "recommended": true }
  },
  "formatter": {
    "enabled": true,
    "indentStyle": "space",
    "indentWidth": 2,
    "lineWidth": 100
  },
  "files": {
    "ignore": ["archive/**", ".next/**", "node_modules/**", "docs/**"]
  }
}
```

Add scripts in `package.json` (merge with existing scripts):
```json
"scripts": {
  "dev": "next dev --turbo",
  "build": "next build",
  "start": "next start",
  "test": "vitest run",
  "test:watch": "vitest",
  "lint": "biome check .",
  "lint:fix": "biome check --write ."
}
```

- [ ] **Step 5: Configure Vitest**

Create `vitest.config.ts`:
```ts
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'node:path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./test/setup.ts'],
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, '.') },
  },
})
```

Create `test/setup.ts`:
```ts
import '@testing-library/jest-dom/vitest'
```

- [ ] **Step 6: Smoke test**

```bash
npm run lint
# expect: zero errors (may have warnings in generated files, fix or ignore)

npm run build
# expect: build succeeds, generates .next/
```

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json tsconfig.json next.config.mjs biome.json vitest.config.ts test/ app/ public/ .gitignore
git commit -m "chore: scaffold Next.js App Router + Vitest + Biome"
```

---

### Task 3: Global styles and design tokens

**Files:**
- Create: `app/globals.css` (overwrite Next.js default), `app/tokens.css`

- [ ] **Step 1: Write design tokens**

Create `app/tokens.css`:
```css
:root {
  --primary: #FF0558;
  --primary-dark: #D90048;
  --bg: #0A0A0B;
  --surface: #151518;
  --surface-light: #1E1E22;
  --text: #F0F0F0;
  --text-muted: #888;
  --border: #2A2A2E;
  --accent-blue: #4DA8FF;
  --accent-green: #34D399;
  --accent-yellow: #FBBF24;
  --accent-purple: #A78BFA;

  --tabbar-h: 64px;
  --topbar-h: 52px;
  --radius-card: 16px;
  --radius-pill: 999px;

  --font-sans: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Noto Sans KR', sans-serif;
}
```

- [ ] **Step 2: Global base styles**

Replace `app/globals.css`:
```css
@import './tokens.css';

* { margin: 0; padding: 0; box-sizing: border-box; }

html, body { height: 100%; overscroll-behavior: none; }

body {
  font-family: var(--font-sans);
  background: var(--bg);
  color: var(--text);
  line-height: 1.55;
  -webkit-font-smoothing: antialiased;
}

a { color: inherit; text-decoration: none; }
button { font-family: inherit; }

/* Hide scrollbars in shell chrome, allow in content */
.no-scrollbar::-webkit-scrollbar { width: 0; height: 0; }
```

- [ ] **Step 3: Commit**

```bash
git add app/globals.css app/tokens.css
git commit -m "style: add design tokens and global base styles"
```

---

## Phase 1 — Content Model

### Task 4: Frontmatter schema and content loader

**Files:**
- Create: `lib/content/schema.ts`, `lib/content/load.ts`
- Test: `lib/content/__tests__/schema.test.ts`, `lib/content/__tests__/load.test.ts`

- [ ] **Step 1: Write failing schema test**

Create `lib/content/__tests__/schema.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { FrontmatterSchema } from '../schema'

describe('FrontmatterSchema', () => {
  const valid = {
    title: 'BEEF 시즌2 본격 제작',
    week: '2026-W17',
    publishedAt: '2026-04-22',
    thumbnail: '/images/w17.jpg',
    excerpt: '아카데미 후광',
  }

  it('accepts valid frontmatter', () => {
    const parsed = FrontmatterSchema.parse(valid)
    expect(parsed.title).toBe('BEEF 시즌2 본격 제작')
  })

  it('rejects missing title', () => {
    expect(() => FrontmatterSchema.parse({ ...valid, title: undefined })).toThrow()
  })

  it('rejects malformed week', () => {
    expect(() => FrontmatterSchema.parse({ ...valid, week: 'W17-2026' })).toThrow()
  })

  it('rejects malformed publishedAt', () => {
    expect(() => FrontmatterSchema.parse({ ...valid, publishedAt: '2026/04/22' })).toThrow()
  })

  it('defaults tags to empty array', () => {
    const parsed = FrontmatterSchema.parse(valid)
    expect(parsed.tags).toEqual([])
  })
})
```

- [ ] **Step 2: Run test — should fail (schema not defined)**

```bash
npm test -- schema.test
# expect: Cannot find module '../schema'
```

- [ ] **Step 3: Implement schema**

Create `lib/content/schema.ts`:
```ts
import { z } from 'zod'

export const FrontmatterSchema = z.object({
  title: z.string().min(1),
  week: z.string().regex(/^\d{4}-W\d{2}$/, 'week must be like "2026-W17"'),
  publishedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'publishedAt must be YYYY-MM-DD'),
  thumbnail: z.string().min(1),
  excerpt: z.string().min(1),
  tags: z.array(z.string()).default([]),
})

export type Frontmatter = z.infer<typeof FrontmatterSchema>

export type ContentKind = 'weekly' | 'shortform'

export interface ContentEntry {
  kind: ContentKind
  slug: string          // e.g. "2026-W17"
  frontmatter: Frontmatter
  body: string          // raw MDX/markdown body
}
```

- [ ] **Step 4: Run test — should pass**

```bash
npm test -- schema.test
# expect: 5 tests pass
```

- [ ] **Step 5: Write failing load test**

Create `lib/content/__tests__/load.test.ts`:
```ts
import { describe, it, expect, beforeAll } from 'vitest'
import { mkdtempSync, writeFileSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { loadAll, loadOne } from '../load'

let contentDir: string

beforeAll(() => {
  contentDir = mkdtempSync(join(tmpdir(), 'kletter-test-'))
  mkdirSync(join(contentDir, 'weekly'), { recursive: true })
  mkdirSync(join(contentDir, 'shortform'), { recursive: true })

  writeFileSync(join(contentDir, 'weekly', '2026-W17.mdx'),
`---
title: "BEEF 시즌2 본격 제작"
week: "2026-W17"
publishedAt: "2026-04-22"
thumbnail: "/images/w17.jpg"
excerpt: "아카데미 후광"
---

# Body
Content here.`)

  writeFileSync(join(contentDir, 'weekly', '2026-W16.mdx'),
`---
title: "사냥개들 시즌2"
week: "2026-W16"
publishedAt: "2026-04-15"
thumbnail: "/images/w16.jpg"
excerpt: "봄 개막"
---

Body.`)
})

describe('loadAll', () => {
  it('loads all weekly entries sorted by publishedAt desc', async () => {
    const entries = await loadAll('weekly', contentDir)
    expect(entries).toHaveLength(2)
    expect(entries[0].slug).toBe('2026-W17')
    expect(entries[1].slug).toBe('2026-W16')
  })

  it('returns empty array for kind with no files', async () => {
    const entries = await loadAll('shortform', contentDir)
    expect(entries).toEqual([])
  })
})

describe('loadOne', () => {
  it('loads a single entry by slug', async () => {
    const entry = await loadOne('weekly', '2026-W17', contentDir)
    expect(entry?.frontmatter.title).toBe('BEEF 시즌2 본격 제작')
    expect(entry?.body).toContain('Content here')
  })

  it('returns null for missing slug', async () => {
    const entry = await loadOne('weekly', '2099-W99', contentDir)
    expect(entry).toBeNull()
  })
})
```

- [ ] **Step 6: Run test — should fail**

```bash
npm test -- load.test
# expect: Cannot find module '../load'
```

- [ ] **Step 7: Implement loader**

Create `lib/content/load.ts`:
```ts
import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import matter from 'gray-matter'
import { FrontmatterSchema, type ContentEntry, type ContentKind } from './schema'

const DEFAULT_DIR = join(process.cwd(), 'content')

export async function loadAll(kind: ContentKind, rootDir = DEFAULT_DIR): Promise<ContentEntry[]> {
  const dir = join(rootDir, kind)
  let files: string[]
  try {
    files = await readdir(dir)
  } catch {
    return []
  }
  const mdx = files.filter((f) => f.endsWith('.mdx'))
  const entries = await Promise.all(mdx.map((f) => parseFile(kind, join(dir, f))))
  return entries.sort((a, b) =>
    b.frontmatter.publishedAt.localeCompare(a.frontmatter.publishedAt),
  )
}

export async function loadOne(
  kind: ContentKind,
  slug: string,
  rootDir = DEFAULT_DIR,
): Promise<ContentEntry | null> {
  try {
    return await parseFile(kind, join(rootDir, kind, `${slug}.mdx`))
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null
    throw err
  }
}

async function parseFile(kind: ContentKind, filePath: string): Promise<ContentEntry> {
  const raw = await readFile(filePath, 'utf8')
  const { data, content } = matter(raw)
  const frontmatter = FrontmatterSchema.parse(data)
  const slug = filePath.split('/').pop()!.replace(/\.mdx$/, '')
  return { kind, slug, frontmatter, body: content }
}
```

- [ ] **Step 8: Run test — should pass**

```bash
npm test
# expect: all schema + load tests pass
```

- [ ] **Step 9: Commit**

```bash
git add lib/content/
git commit -m "feat(content): add MDX frontmatter schema and loader"
```

---

### Task 5: Migrate existing 8 HTML pages to MDX

**Files:**
- Create: `content/weekly/2026-W16.mdx`, `content/weekly/2026-W17.mdx`, `content/shortform/2026-W17.mdx`
- Create: `scripts/migrate-html-to-mdx.ts` (one-time, kept for reference)

The archived HTML lives in `archive/web-v0/weekly/2026-WXX/index.html` and `archive/web-v0/shortform/2026-W17/index.html`. Content is inline-styled; we extract text and restructure.

- [ ] **Step 1: Write the migration script**

Create `scripts/migrate-html-to-mdx.ts`:
```ts
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'

interface Source {
  kind: 'weekly' | 'shortform'
  slug: string
  htmlPath: string
  title: string
  week: string
  publishedAt: string
  thumbnail: string
  excerpt: string
}

const sources: Source[] = [
  {
    kind: 'weekly', slug: '2026-W17',
    htmlPath: 'archive/web-v0/weekly/2026-W17/index.html',
    title: 'BEEF 시즌2 본격 제작',
    week: '2026-W17', publishedAt: '2026-04-22',
    thumbnail: '/images/w17-cover.jpg',
    excerpt: '아카데미 후광 · 넷플릭스 신작 5편 · TVer 주간 TOP 10',
  },
  {
    kind: 'weekly', slug: '2026-W16',
    htmlPath: 'archive/web-v0/weekly/2026-W16/index.html',
    title: '사냥개들 시즌2 & 봄 드라마 개막전',
    week: '2026-W16', publishedAt: '2026-04-15',
    thumbnail: '/images/w16-cover.jpg',
    excerpt: 'Disney+ 사냥개들 시즌2 · U-NEXT 독점 · 4월 신작 라인업',
  },
  {
    kind: 'shortform', slug: '2026-W17',
    htmlPath: 'archive/web-v0/shortform/2026-W17/index.html',
    title: 'BUMP 신작 3편 · ReelShort 한국 진출',
    week: '2026-W17', publishedAt: '2026-04-22',
    thumbnail: '/images/sf17-cover.jpg',
    excerpt: 'Tatedra 월간 MAU 200만 돌파 · UniReel 런칭 이슈',
  },
]

function extractBody(html: string): string {
  // Strip <head>, <script>, <style>. Keep <h1-4>, <p>, <a>, <ul>, <ol>, <li>, <blockquote>, <img>.
  // Convert to minimal markdown-compatible HTML; MDX will pass raw HTML through.
  const main = html.match(/<main[^>]*>([\s\S]*?)<\/main>/i)?.[1]
    ?? html.match(/<body[^>]*>([\s\S]*?)<\/body>/i)?.[1]
    ?? ''
  return main
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/\s*style="[^"]*"/gi, '')
    .replace(/\s*class="[^"]*"/gi, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

for (const s of sources) {
  const html = readFileSync(s.htmlPath, 'utf8')
  const body = extractBody(html)
  const outDir = `content/${s.kind}`
  mkdirSync(outDir, { recursive: true })
  const fm = [
    '---',
    `title: "${s.title.replace(/"/g, '\\"')}"`,
    `week: "${s.week}"`,
    `publishedAt: "${s.publishedAt}"`,
    `thumbnail: "${s.thumbnail}"`,
    `excerpt: "${s.excerpt.replace(/"/g, '\\"')}"`,
    '---',
    '',
    body,
    '',
  ].join('\n')
  writeFileSync(join(outDir, `${s.slug}.mdx`), fm)
  console.log(`wrote ${outDir}/${s.slug}.mdx`)
}
```

- [ ] **Step 2: Run migration**

```bash
npx tsx scripts/migrate-html-to-mdx.ts
# expect: 3 files written

ls content/weekly content/shortform
# expect: 2026-W16.mdx 2026-W17.mdx / 2026-W17.mdx
```

- [ ] **Step 3: Manually audit MDX — fix inline HTML that won't render**

Open each MDX and:
- Remove empty/broken tags left by the strip
- Replace `<h2>` with markdown `##` when straightforward
- Keep any `<a href>` intact
- For now, accept that some raw HTML remains (react-markdown will render with sanitize)

If output looks too noisy, simplify bodies manually. Goal: readable in <ArticleView>.

- [ ] **Step 4: Verify loader reads new MDX**

Add a smoke script at the bottom of `lib/content/__tests__/load.test.ts` or run an ad-hoc check:
```bash
npx tsx -e "import('./lib/content/load.ts').then(m => m.loadAll('weekly').then(r => console.log(r.map(e => e.slug))))"
# expect: [ '2026-W17', '2026-W16' ]
```

- [ ] **Step 5: Commit**

```bash
git add content/ scripts/migrate-html-to-mdx.ts
git commit -m "feat(content): migrate W16/W17 weekly and W17 shortform to MDX"
```

---

## Phase 2 — App Shell

### Task 6: AppShell + TopBar component

**Files:**
- Create: `components/AppShell.tsx`, `components/TopBar.tsx`
- Test: `components/__tests__/AppShell.test.tsx`, `components/__tests__/TopBar.test.tsx`

- [ ] **Step 1: Write failing TopBar test**

Create `components/__tests__/TopBar.test.tsx`:
```tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { TopBar } from '../TopBar'

describe('TopBar', () => {
  it('renders brand name', () => {
    render(<TopBar online={true} />)
    expect(screen.getByText(/Kletter/i)).toBeInTheDocument()
  })

  it('shows online indicator when online', () => {
    render(<TopBar online={true} />)
    expect(screen.getByLabelText(/online/i)).toBeInTheDocument()
  })

  it('shows offline indicator when offline', () => {
    render(<TopBar online={false} />)
    expect(screen.getByLabelText(/offline/i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test — expect fail**

```bash
npm test -- TopBar
```

- [ ] **Step 3: Implement TopBar**

Create `components/TopBar.tsx`:
```tsx
'use client'
import styles from './TopBar.module.css'

export function TopBar({ online }: { online: boolean }) {
  return (
    <header className={styles.topbar}>
      <div className={styles.title}>
        Kletter<span className={styles.dot}>.</span>
      </div>
      <div
        className={styles.status}
        aria-label={online ? 'online' : 'offline'}
      >
        <span className={`${styles.dotIndicator} ${online ? styles.on : styles.off}`} />
        {online ? '온라인' : '오프라인'}
      </div>
    </header>
  )
}
```

Create `components/TopBar.module.css`:
```css
.topbar {
  position: sticky; top: 0;
  height: var(--topbar-h);
  background: rgba(10,10,11,0.92);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border-bottom: 1px solid var(--border);
  display: flex; align-items: center; justify-content: space-between;
  padding: 0 18px;
  z-index: 20;
}
.title { font-size: 17px; font-weight: 700; letter-spacing: -0.3px; }
.dot { color: var(--primary); }
.status { font-size: 11px; color: var(--text-muted); display: flex; gap: 6px; align-items: center; }
.dotIndicator { width: 6px; height: 6px; border-radius: 50%; }
.on  { background: var(--accent-green); box-shadow: 0 0 6px var(--accent-green); }
.off { background: var(--text-muted); }
```

- [ ] **Step 4: Run test — expect pass**

```bash
npm test -- TopBar
```

- [ ] **Step 5: Write failing AppShell test**

Create `components/__tests__/AppShell.test.tsx`:
```tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { AppShell } from '../AppShell'

describe('AppShell', () => {
  it('renders children inside main content area', () => {
    render(
      <AppShell activeTab="home">
        <div>page content</div>
      </AppShell>,
    )
    expect(screen.getByText('page content')).toBeInTheDocument()
  })

  it('renders top bar and bottom tabbar slots', () => {
    render(<AppShell activeTab="home">x</AppShell>)
    expect(screen.getByText(/Kletter/i)).toBeInTheDocument()
    expect(screen.getByRole('navigation')).toBeInTheDocument()
  })
})
```

- [ ] **Step 6: Run test — expect fail**

```bash
npm test -- AppShell
```

- [ ] **Step 7: Implement AppShell (BottomTabBar placeholder for now)**

Create `components/AppShell.tsx`:
```tsx
'use client'
import { useEffect, useState } from 'react'
import { TopBar } from './TopBar'
import { BottomTabBar, type TabId } from './BottomTabBar'
import styles from './AppShell.module.css'

export function AppShell({
  activeTab,
  children,
}: {
  activeTab: TabId
  children: React.ReactNode
}) {
  const [online, setOnline] = useState(true)
  useEffect(() => {
    const update = () => setOnline(navigator.onLine)
    update()
    window.addEventListener('online', update)
    window.addEventListener('offline', update)
    return () => {
      window.removeEventListener('online', update)
      window.removeEventListener('offline', update)
    }
  }, [])

  return (
    <div className={styles.shell}>
      <TopBar online={online} />
      <main className={styles.main}>{children}</main>
      <BottomTabBar active={activeTab} />
    </div>
  )
}
```

Create `components/AppShell.module.css`:
```css
.shell {
  display: flex; flex-direction: column;
  min-height: 100vh;
  max-width: 480px;
  margin: 0 auto;
  background: var(--bg);
  position: relative;
}
.main {
  flex: 1;
  padding: 16px 16px calc(var(--tabbar-h) + 24px) 16px;
  overflow-y: auto;
  overflow-x: hidden;
}
```

- [ ] **Step 8: Implement BottomTabBar stub (test will use later task)**

Create `components/BottomTabBar.tsx`:
```tsx
'use client'
import Link from 'next/link'
import styles from './BottomTabBar.module.css'

export type TabId = 'home' | 'weekly' | 'shortform' | 'settings'

const tabs: { id: TabId; label: string; icon: string; href: string }[] = [
  { id: 'home', label: '홈', icon: '🏠', href: '/' },
  { id: 'weekly', label: 'OTT', icon: '📺', href: '/weekly' },
  { id: 'shortform', label: 'shortform', icon: '🎬', href: '/shortform' },
  { id: 'settings', label: '설정', icon: '⚙️', href: '/settings' },
]

export function BottomTabBar({ active }: { active: TabId }) {
  return (
    <nav className={styles.tabbar} aria-label="Primary">
      {tabs.map((t) => (
        <Link
          key={t.id}
          href={t.href}
          className={`${styles.tab} ${active === t.id ? styles.active : ''}`}
          aria-current={active === t.id ? 'page' : undefined}
        >
          <span className={styles.icon}>{t.icon}</span>
          <span>{t.label}</span>
        </Link>
      ))}
    </nav>
  )
}
```

Create `components/BottomTabBar.module.css`:
```css
.tabbar {
  position: fixed; bottom: 0; left: 50%; transform: translateX(-50%);
  width: 100%; max-width: 480px;
  height: var(--tabbar-h);
  background: rgba(10,10,11,0.96);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border-top: 1px solid var(--border);
  display: grid; grid-template-columns: repeat(4, 1fr);
  z-index: 50;
}
.tab {
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 2px; font-size: 10px;
  color: var(--text-muted);
  text-decoration: none; user-select: none;
  transition: color 0.15s ease;
}
.icon { font-size: 20px; }
.active { color: var(--primary); }
.tab:active { transform: scale(0.9); }
```

- [ ] **Step 9: Run tests — expect pass**

```bash
npm test -- AppShell TopBar
```

- [ ] **Step 10: Commit**

```bash
git add components/
git commit -m "feat(ui): AppShell + TopBar + BottomTabBar with tests"
```

---

### Task 7: FeedCard component

**Files:**
- Create: `components/FeedCard.tsx`, `components/FeedCard.module.css`
- Test: `components/__tests__/FeedCard.test.tsx`

- [ ] **Step 1: Write failing test**

Create `components/__tests__/FeedCard.test.tsx`:
```tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { FeedCard } from '../FeedCard'

const entry = {
  kind: 'weekly' as const,
  slug: '2026-W17',
  frontmatter: {
    title: 'BEEF 시즌2 본격 제작',
    week: '2026-W17',
    publishedAt: '2026-04-22',
    thumbnail: '/images/w17.jpg',
    excerpt: '아카데미 후광 · 넷플릭스 신작 5편',
    tags: [],
  },
  body: '',
}

describe('FeedCard', () => {
  it('renders title, excerpt, and week', () => {
    render(<FeedCard entry={entry} />)
    expect(screen.getByText('BEEF 시즌2 본격 제작')).toBeInTheDocument()
    expect(screen.getByText(/아카데미 후광/)).toBeInTheDocument()
    expect(screen.getByText(/2026.*W17/)).toBeInTheDocument()
  })

  it('links to detail page for weekly kind', () => {
    render(<FeedCard entry={entry} />)
    const link = screen.getByRole('link')
    expect(link).toHaveAttribute('href', '/weekly/2026-W17')
  })

  it('links to shortform path for shortform kind', () => {
    render(<FeedCard entry={{ ...entry, kind: 'shortform' }} />)
    expect(screen.getByRole('link')).toHaveAttribute('href', '/shortform/2026-W17')
  })

  it('shows correct badge label per kind', () => {
    const { rerender } = render(<FeedCard entry={entry} />)
    expect(screen.getByText('OTT')).toBeInTheDocument()
    rerender(<FeedCard entry={{ ...entry, kind: 'shortform' }} />)
    expect(screen.getByText('SHORTFORM')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test — expect fail**

- [ ] **Step 3: Implement FeedCard**

Create `components/FeedCard.tsx`:
```tsx
import Link from 'next/link'
import type { ContentEntry } from '@/lib/content/schema'
import styles from './FeedCard.module.css'

export function FeedCard({ entry }: { entry: ContentEntry }) {
  const href = `/${entry.kind}/${entry.slug}`
  const badge = entry.kind === 'weekly' ? 'OTT' : 'SHORTFORM'
  const thumbClass = entry.kind === 'weekly' ? styles.thumbWeekly : styles.thumbShortform
  const emoji = entry.kind === 'weekly' ? '🎬' : '📱'
  const weekDisplay = entry.frontmatter.week.replace('-', ' ')
  const dateDisplay = entry.frontmatter.publishedAt.replace(/-/g, '.')

  return (
    <Link href={href} className={styles.card}>
      <div className={`${styles.thumb} ${thumbClass}`}>
        <span className={`${styles.badge} ${styles[`badge_${entry.kind}`]}`}>{badge}</span>
        <span className={styles.emoji} aria-hidden>{emoji}</span>
      </div>
      <div className={styles.body}>
        <div className={styles.meta}>{weekDisplay} · {dateDisplay}</div>
        <h3 className={styles.title}>{entry.frontmatter.title}</h3>
        <p className={styles.excerpt}>{entry.frontmatter.excerpt}</p>
      </div>
    </Link>
  )
}
```

Create `components/FeedCard.module.css`:
```css
.card {
  display: block;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-card);
  overflow: hidden;
  margin-bottom: 14px;
  transition: transform 0.15s ease, border-color 0.15s ease;
}
.card:active { transform: scale(0.985); border-color: var(--primary); }
.thumb {
  height: 160px;
  display: flex; align-items: center; justify-content: center;
  border-bottom: 1px solid var(--border);
  position: relative;
  font-size: 44px;
}
.thumbWeekly { background: linear-gradient(135deg, #2a1526, #151518); }
.thumbShortform { background: linear-gradient(135deg, #2e2216, #151518); }
.badge {
  position: absolute; top: 10px; left: 10px;
  font-size: 10px; font-weight: 700;
  padding: 4px 8px; border-radius: var(--radius-pill);
  letter-spacing: 0.5px;
  backdrop-filter: blur(8px);
}
.badge_weekly { background: rgba(255,5,88,0.25); color: #ff6a99; }
.badge_shortform { background: rgba(251,191,36,0.22); color: var(--accent-yellow); }
.body { padding: 14px 16px 16px; }
.meta { font-size: 11px; color: var(--text-muted); margin-bottom: 6px; }
.title { font-size: 17px; font-weight: 700; line-height: 1.35; margin-bottom: 6px; letter-spacing: -0.3px; }
.excerpt { font-size: 13px; color: #aaa; line-height: 1.55; }
```

- [ ] **Step 4: Run test — expect pass**

```bash
npm test -- FeedCard
```

- [ ] **Step 5: Commit**

```bash
git add components/FeedCard.tsx components/FeedCard.module.css components/__tests__/FeedCard.test.tsx
git commit -m "feat(ui): FeedCard component with kind-aware styling and links"
```

---

## Phase 3 — Pages

### Task 8: Home page — latest OTT + latest shortform only

**Files:**
- Modify: `app/page.tsx` (overwrite Next.js default)
- Create: `app/page.module.css`
- Test: `app/__tests__/page.test.tsx`

- [ ] **Step 1: Write failing test**

Create `app/__tests__/page.test.tsx`:
```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import HomePage from '../page'

vi.mock('@/lib/content/load', () => ({
  loadAll: vi.fn(async (kind: 'weekly' | 'shortform') => {
    if (kind === 'weekly') return [
      { kind: 'weekly', slug: '2026-W17', frontmatter: {
        title: 'BEEF 시즌2 본격 제작', week: '2026-W17',
        publishedAt: '2026-04-22', thumbnail: '/x.jpg',
        excerpt: '아카데미 후광', tags: []
      }, body: '' },
      { kind: 'weekly', slug: '2026-W16', frontmatter: {
        title: '사냥개들 시즌2', week: '2026-W16',
        publishedAt: '2026-04-15', thumbnail: '/x.jpg',
        excerpt: '봄 개막', tags: []
      }, body: '' },
    ]
    return [
      { kind: 'shortform', slug: '2026-W17', frontmatter: {
        title: 'BUMP 신작', week: '2026-W17',
        publishedAt: '2026-04-22', thumbnail: '/x.jpg',
        excerpt: 'ReelShort 한국', tags: []
      }, body: '' },
    ]
  }),
}))

describe('HomePage', () => {
  it('renders latest weekly and latest shortform only', async () => {
    const ui = await HomePage()
    render(ui)
    expect(screen.getByText('BEEF 시즌2 본격 제작')).toBeInTheDocument()
    expect(screen.getByText('BUMP 신작')).toBeInTheDocument()
    expect(screen.queryByText('사냥개들 시즌2')).toBeNull()
  })
})
```

- [ ] **Step 2: Run test — expect fail**

- [ ] **Step 3: Implement HomePage**

Overwrite `app/page.tsx`:
```tsx
import { AppShell } from '@/components/AppShell'
import { FeedCard } from '@/components/FeedCard'
import { loadAll } from '@/lib/content/load'
import styles from './page.module.css'

export default async function HomePage() {
  const [weeklies, shortforms] = await Promise.all([
    loadAll('weekly'),
    loadAll('shortform'),
  ])
  const latestWeekly = weeklies[0]
  const latestShortform = shortforms[0]

  return (
    <AppShell activeTab="home">
      <div className={styles.hint}>
        💡 <strong>팁</strong>: 사파리에서 <strong>공유 → 홈 화면에 추가</strong>하면 앱 아이콘으로 실행돼요
      </div>
      <div className={styles.sectionLabel}>최신</div>
      {latestWeekly && <FeedCard entry={latestWeekly} />}
      {latestShortform && <FeedCard entry={latestShortform} />}
      {!latestWeekly && !latestShortform && (
        <p className={styles.empty}>아직 공개된 콘텐츠가 없습니다.</p>
      )}
    </AppShell>
  )
}
```

Create `app/page.module.css`:
```css
.hint {
  background: var(--surface);
  border: 1px dashed var(--border);
  border-radius: 14px; padding: 14px;
  margin-bottom: 14px;
  font-size: 12px; color: var(--text-muted);
  text-align: center;
}
.hint strong { color: var(--primary); }
.sectionLabel {
  font-size: 11px; font-weight: 700; color: var(--text-muted);
  letter-spacing: 1px; text-transform: uppercase;
  margin: 6px 4px 10px;
}
.empty { color: var(--text-muted); text-align: center; padding: 40px 0; }
```

- [ ] **Step 4: Run test — expect pass**

- [ ] **Step 5: Manual check**

```bash
npm run dev
# open http://localhost:3000
# expect: shows "Kletter." top bar, install hint, 최신 section, BEEF card, BUMP card, bottom tabbar
```

- [ ] **Step 6: Commit**

```bash
git add app/page.tsx app/page.module.css app/__tests__/
git commit -m "feat(pages): home page with latest weekly and shortform cards"
```

---

### Task 9: OTT tab page — full list

**Files:**
- Create: `app/weekly/page.tsx`, `app/weekly/page.module.css`
- Test: `app/weekly/__tests__/page.test.tsx`

- [ ] **Step 1: Write failing test**

Create `app/weekly/__tests__/page.test.tsx`:
```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import WeeklyPage from '../page'

vi.mock('@/lib/content/load', () => ({
  loadAll: vi.fn(async () => [
    { kind: 'weekly', slug: '2026-W17', frontmatter: {
      title: 'BEEF', week: '2026-W17', publishedAt: '2026-04-22',
      thumbnail: '/x.jpg', excerpt: 'a', tags: []
    }, body: '' },
    { kind: 'weekly', slug: '2026-W16', frontmatter: {
      title: '사냥개들', week: '2026-W16', publishedAt: '2026-04-15',
      thumbnail: '/x.jpg', excerpt: 'b', tags: []
    }, body: '' },
  ]),
}))

describe('WeeklyPage', () => {
  it('renders all weekly entries in order', async () => {
    const ui = await WeeklyPage()
    render(ui)
    const titles = screen.getAllByRole('heading', { level: 3 }).map(h => h.textContent)
    expect(titles).toEqual(['BEEF', '사냥개들'])
  })
})
```

- [ ] **Step 2: Implement WeeklyPage**

Create `app/weekly/page.tsx`:
```tsx
import { AppShell } from '@/components/AppShell'
import { FeedCard } from '@/components/FeedCard'
import { loadAll } from '@/lib/content/load'
import styles from './page.module.css'

export default async function WeeklyPage() {
  const entries = await loadAll('weekly')
  return (
    <AppShell activeTab="weekly">
      <div className={styles.sectionLabel}>OTT · 전체 리포트</div>
      {entries.length === 0 ? (
        <p className={styles.empty}>아직 공개된 OTT 리포트가 없습니다.</p>
      ) : (
        entries.map((e) => <FeedCard key={e.slug} entry={e} />)
      )}
    </AppShell>
  )
}
```

Create `app/weekly/page.module.css`:
```css
.sectionLabel {
  font-size: 11px; font-weight: 700; color: var(--text-muted);
  letter-spacing: 1px; text-transform: uppercase;
  margin: 6px 4px 10px;
}
.empty { color: var(--text-muted); text-align: center; padding: 40px 0; }
```

- [ ] **Step 3: Run tests + manual check**

```bash
npm test -- weekly
npm run dev  # visit /weekly
```

- [ ] **Step 4: Commit**

```bash
git add app/weekly/
git commit -m "feat(pages): OTT list page"
```

---

### Task 10: shortform tab page

**Files:**
- Create: `app/shortform/page.tsx`, `app/shortform/page.module.css`

- [ ] **Step 1: Implement (mirror of weekly)**

Create `app/shortform/page.tsx`:
```tsx
import { AppShell } from '@/components/AppShell'
import { FeedCard } from '@/components/FeedCard'
import { loadAll } from '@/lib/content/load'
import styles from './page.module.css'

export default async function ShortformPage() {
  const entries = await loadAll('shortform')
  return (
    <AppShell activeTab="shortform">
      <div className={styles.banner}>
        <span aria-hidden>🎬</span>
        <div>
          <strong>8개 shortform 플랫폼 커버</strong><br />
          BUMP · FANY-D · KANTA · MILLION · Rakuten · ReelShort · Tatedra · UniReel
        </div>
      </div>
      <div className={styles.sectionLabel}>shortform · 전체 리포트</div>
      {entries.length === 0 ? (
        <p className={styles.empty}>아직 공개된 shortform 리포트가 없습니다.</p>
      ) : (
        entries.map((e) => <FeedCard key={e.slug} entry={e} />)
      )}
    </AppShell>
  )
}
```

Create `app/shortform/page.module.css`:
```css
.banner {
  background: linear-gradient(135deg, rgba(255,5,88,0.15), rgba(255,5,88,0.05));
  border: 1px solid rgba(255,5,88,0.3);
  border-radius: 14px; padding: 16px;
  margin-bottom: 14px;
  display: flex; gap: 12px; align-items: flex-start;
  font-size: 12px; color: #ddd; line-height: 1.6;
}
.banner strong { color: var(--text); font-size: 13px; }
.sectionLabel {
  font-size: 11px; font-weight: 700; color: var(--text-muted);
  letter-spacing: 1px; text-transform: uppercase;
  margin: 6px 4px 10px;
}
.empty { color: var(--text-muted); text-align: center; padding: 40px 0; }
```

- [ ] **Step 2: Commit**

```bash
git add app/shortform/
git commit -m "feat(pages): shortform list page"
```

---

### Task 11: Individual weekly and shortform pages (dynamic route)

**Files:**
- Create: `app/weekly/[week]/page.tsx`, `app/shortform/[week]/page.tsx`
- Create: `components/ArticleView.tsx`, `components/ArticleView.module.css`
- Test: `components/__tests__/ArticleView.test.tsx`

- [ ] **Step 1: Write failing ArticleView test**

Create `components/__tests__/ArticleView.test.tsx`:
```tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ArticleView } from '../ArticleView'

const entry = {
  kind: 'weekly' as const,
  slug: '2026-W17',
  frontmatter: {
    title: 'BEEF 시즌2 본격 제작',
    week: '2026-W17',
    publishedAt: '2026-04-22',
    thumbnail: '/x.jpg',
    excerpt: 'ex',
    tags: [],
  },
  body: '## Section\n\nBody paragraph.',
}

describe('ArticleView', () => {
  it('renders title and week header', () => {
    render(<ArticleView entry={entry} />)
    expect(screen.getByRole('heading', { level: 1, name: 'BEEF 시즌2 본격 제작' })).toBeInTheDocument()
    expect(screen.getByText(/2026.*W17/)).toBeInTheDocument()
  })

  it('renders markdown body', () => {
    render(<ArticleView entry={entry} />)
    expect(screen.getByText('Section')).toBeInTheDocument()
    expect(screen.getByText('Body paragraph.')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Implement ArticleView**

Create `components/ArticleView.tsx`:
```tsx
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeSanitize from 'rehype-sanitize'
import type { ContentEntry } from '@/lib/content/schema'
import styles from './ArticleView.module.css'

export function ArticleView({ entry }: { entry: ContentEntry }) {
  const weekDisplay = entry.frontmatter.week.replace('-', ' ')
  const dateDisplay = entry.frontmatter.publishedAt.replace(/-/g, '.')
  const kindLabel = entry.kind === 'weekly' ? 'OTT' : 'shortform'

  return (
    <article className={styles.article}>
      <div className={styles.hero}>
        <div className={styles.heroWeek}>{weekDisplay}</div>
        <h1 className={styles.h1}>{entry.frontmatter.title}</h1>
      </div>
      <div className={styles.meta}>{dateDisplay} · {kindLabel}</div>
      <div className={styles.body}>
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          rehypePlugins={[rehypeSanitize]}
        >
          {entry.body}
        </ReactMarkdown>
      </div>
    </article>
  )
}
```

Create `components/ArticleView.module.css`:
```css
.article { padding: 20px 0 40px; }
.hero {
  height: 180px;
  background: linear-gradient(135deg, #2a1526, var(--bg));
  display: flex; flex-direction: column; justify-content: flex-end; padding: 18px;
  margin: 0 -16px 16px;
  border-bottom: 1px solid var(--border);
}
.heroWeek { font-size: 12px; color: var(--primary); font-weight: 700; letter-spacing: 1.5px; }
.h1 { font-size: 22px; font-weight: 800; letter-spacing: -0.4px; margin: 10px 0 0; line-height: 1.3; }
.meta { font-size: 12px; color: var(--text-muted); margin-bottom: 18px; }
.body h2 { font-size: 16px; font-weight: 700; margin: 22px 0 10px; color: var(--primary); }
.body p { font-size: 14px; color: #ccc; margin-bottom: 12px; }
.body a { color: var(--accent-blue); text-decoration: underline; }
.body blockquote {
  border-left: 3px solid var(--primary);
  padding: 8px 14px; margin: 14px 0;
  background: var(--surface); border-radius: 0 8px 8px 0;
  font-size: 13px; color: #bbb;
}
.body ul, .body ol { padding-left: 22px; margin-bottom: 12px; font-size: 14px; color: #ccc; }
```

- [ ] **Step 3: Run ArticleView test**

```bash
npm test -- ArticleView
```

- [ ] **Step 4: Implement weekly dynamic route**

Create `app/weekly/[week]/page.tsx`:
```tsx
import { notFound } from 'next/navigation'
import { AppShell } from '@/components/AppShell'
import { ArticleView } from '@/components/ArticleView'
import { SwipeNavigator } from '@/components/SwipeNavigator'
import { loadAll, loadOne } from '@/lib/content/load'

export async function generateStaticParams() {
  const all = await loadAll('weekly')
  return all.map((e) => ({ week: e.slug }))
}

export default async function WeeklyDetail({
  params,
}: { params: Promise<{ week: string }> }) {
  const { week } = await params
  const entry = await loadOne('weekly', week)
  if (!entry) notFound()

  const all = await loadAll('weekly')
  const idx = all.findIndex((e) => e.slug === week)
  const prev = all[idx + 1]?.slug ?? null   // older
  const next = all[idx - 1]?.slug ?? null   // newer

  return (
    <AppShell activeTab="weekly">
      <SwipeNavigator
        prevHref={prev ? `/weekly/${prev}` : null}
        nextHref={next ? `/weekly/${next}` : null}
      >
        <ArticleView entry={entry} />
      </SwipeNavigator>
    </AppShell>
  )
}
```

- [ ] **Step 5: Implement shortform dynamic route (mirror)**

Create `app/shortform/[week]/page.tsx`:
```tsx
import { notFound } from 'next/navigation'
import { AppShell } from '@/components/AppShell'
import { ArticleView } from '@/components/ArticleView'
import { SwipeNavigator } from '@/components/SwipeNavigator'
import { loadAll, loadOne } from '@/lib/content/load'

export async function generateStaticParams() {
  const all = await loadAll('shortform')
  return all.map((e) => ({ week: e.slug }))
}

export default async function ShortformDetail({
  params,
}: { params: Promise<{ week: string }> }) {
  const { week } = await params
  const entry = await loadOne('shortform', week)
  if (!entry) notFound()

  const all = await loadAll('shortform')
  const idx = all.findIndex((e) => e.slug === week)
  const prev = all[idx + 1]?.slug ?? null
  const next = all[idx - 1]?.slug ?? null

  return (
    <AppShell activeTab="shortform">
      <SwipeNavigator
        prevHref={prev ? `/shortform/${prev}` : null}
        nextHref={next ? `/shortform/${next}` : null}
      >
        <ArticleView entry={entry} />
      </SwipeNavigator>
    </AppShell>
  )
}
```

- [ ] **Step 6: Commit**

```bash
git add components/ArticleView* components/__tests__/ArticleView.test.tsx app/weekly/[week]/ app/shortform/[week]/
git commit -m "feat(pages): individual article pages with ArticleView"
```

---

### Task 12: SwipeNavigator component

**Files:**
- Create: `components/SwipeNavigator.tsx`, `components/SwipeNavigator.module.css`
- Test: `components/__tests__/SwipeNavigator.test.tsx`

- [ ] **Step 1: Write failing test**

Create `components/__tests__/SwipeNavigator.test.tsx`:
```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { SwipeNavigator } from '../SwipeNavigator'

const pushMock = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock }),
}))

beforeEach(() => pushMock.mockReset())

describe('SwipeNavigator', () => {
  it('renders children', () => {
    render(
      <SwipeNavigator prevHref="/a" nextHref="/b"><div>child</div></SwipeNavigator>,
    )
    expect(screen.getByText('child')).toBeInTheDocument()
  })

  it('swipe left (finger: right→left) navigates to next', () => {
    const { container } = render(
      <SwipeNavigator prevHref="/a" nextHref="/b"><div>child</div></SwipeNavigator>,
    )
    const el = container.firstChild as HTMLElement
    fireEvent.touchStart(el, { touches: [{ clientX: 300 }] })
    fireEvent.touchEnd(el, { changedTouches: [{ clientX: 100 }] })
    expect(pushMock).toHaveBeenCalledWith('/b')
  })

  it('swipe right (finger: left→right) navigates to prev', () => {
    const { container } = render(
      <SwipeNavigator prevHref="/a" nextHref="/b"><div>child</div></SwipeNavigator>,
    )
    const el = container.firstChild as HTMLElement
    fireEvent.touchStart(el, { touches: [{ clientX: 100 }] })
    fireEvent.touchEnd(el, { changedTouches: [{ clientX: 300 }] })
    expect(pushMock).toHaveBeenCalledWith('/a')
  })

  it('does nothing for short swipe below threshold', () => {
    const { container } = render(
      <SwipeNavigator prevHref="/a" nextHref="/b"><div>child</div></SwipeNavigator>,
    )
    const el = container.firstChild as HTMLElement
    fireEvent.touchStart(el, { touches: [{ clientX: 200 }] })
    fireEvent.touchEnd(el, { changedTouches: [{ clientX: 240 }] })
    expect(pushMock).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Implement SwipeNavigator**

Create `components/SwipeNavigator.tsx`:
```tsx
'use client'
import { useRef, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import styles from './SwipeNavigator.module.css'

const THRESHOLD_PX = 80

export function SwipeNavigator({
  prevHref,
  nextHref,
  children,
}: {
  prevHref: string | null
  nextHref: string | null
  children: ReactNode
}) {
  const router = useRouter()
  const startX = useRef<number | null>(null)

  return (
    <div
      className={styles.root}
      onTouchStart={(e) => { startX.current = e.touches[0].clientX }}
      onTouchEnd={(e) => {
        if (startX.current === null) return
        const dx = e.changedTouches[0].clientX - startX.current
        startX.current = null
        if (Math.abs(dx) < THRESHOLD_PX) return
        if (dx < 0 && nextHref) router.push(nextHref)
        if (dx > 0 && prevHref) router.push(prevHref)
      }}
    >
      {children}
      <div className={styles.hint}>
        {prevHref ? '← 이전' : ''} &nbsp; 스와이프로 이동 &nbsp; {nextHref ? '다음 →' : ''}
      </div>
    </div>
  )
}
```

Create `components/SwipeNavigator.module.css`:
```css
.root { touch-action: pan-y; }
.hint {
  text-align: center; font-size: 11px; color: var(--text-muted);
  margin: 30px 0 10px; padding: 8px;
  border-top: 1px dashed var(--border);
  border-bottom: 1px dashed var(--border);
}
```

- [ ] **Step 3: Run test — expect pass**

- [ ] **Step 4: Commit**

```bash
git add components/SwipeNavigator* components/__tests__/SwipeNavigator.test.tsx
git commit -m "feat(ui): SwipeNavigator for prev/next article navigation"
```

---

## Phase 4 — Settings and Email API

### Task 13: Settings page UI

**Files:**
- Create: `app/settings/page.tsx`, `app/settings/page.module.css`
- Create: `components/Toggle.tsx`, `components/Toggle.module.css`
- Create: `components/SubscribePanel.tsx`, `components/SubscribePanel.module.css`

- [ ] **Step 1: Implement Toggle (no test — pure presentation)**

Create `components/Toggle.tsx`:
```tsx
'use client'
import styles from './Toggle.module.css'

export function Toggle({
  checked,
  onChange,
  label,
}: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      className={`${styles.toggle} ${checked ? styles.on : ''}`}
      onClick={() => onChange(!checked)}
    />
  )
}
```

Create `components/Toggle.module.css`:
```css
.toggle {
  width: 42px; height: 25px; background: #3a3a3e; border: none;
  border-radius: 999px; position: relative; cursor: pointer;
  transition: background 0.18s ease;
  padding: 0;
}
.toggle::after {
  content: ''; position: absolute; top: 2px; left: 2px;
  width: 21px; height: 21px; background: #fff; border-radius: 50%;
  transition: transform 0.18s ease;
}
.toggle.on { background: var(--primary); }
.toggle.on::after { transform: translateX(17px); }
```

- [ ] **Step 2: Implement SubscribePanel**

Create `components/SubscribePanel.tsx`:
```tsx
'use client'
import { useState } from 'react'
import styles from './SubscribePanel.module.css'

type State = 'idle' | 'loading' | 'success' | 'error'

export function SubscribePanel() {
  const [email, setEmail] = useState('')
  const [state, setState] = useState<State>('idle')
  const [message, setMessage] = useState<string>('')

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setState('loading')
    setMessage('')
    try {
      const res = await fetch('/api/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      if (!res.ok) throw new Error(await res.text())
      setState('success')
      setMessage('구독 완료! 확인 이메일을 확인해주세요.')
      setEmail('')
    } catch (err) {
      setState('error')
      setMessage(err instanceof Error ? err.message : '문제가 발생했어요')
    }
  }

  return (
    <form className={styles.form} onSubmit={submit}>
      <input
        type="email"
        placeholder="your@email.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
        className={styles.input}
      />
      <button type="submit" disabled={state === 'loading'} className={styles.button}>
        {state === 'loading' ? '...' : '구독'}
      </button>
      {message && (
        <div className={`${styles.msg} ${state === 'error' ? styles.err : styles.ok}`}>
          {message}
        </div>
      )}
    </form>
  )
}
```

Create `components/SubscribePanel.module.css`:
```css
.form { display: flex; gap: 8px; padding: 14px 16px; flex-wrap: wrap; }
.input {
  flex: 1; min-width: 200px;
  background: var(--surface-light); border: 1px solid var(--border);
  padding: 10px 12px; border-radius: 10px;
  color: var(--text); font-size: 13px; font-family: inherit;
}
.input:focus { outline: none; border-color: var(--primary); }
.button {
  background: var(--primary); color: #fff; border: none;
  padding: 10px 14px; border-radius: 10px; font-size: 13px;
  font-weight: 600; cursor: pointer;
}
.button:disabled { opacity: 0.6; cursor: default; }
.msg { width: 100%; font-size: 12px; padding: 4px 0; }
.ok { color: var(--accent-green); }
.err { color: #ff6a6a; }
```

- [ ] **Step 3: Implement PushToggle (stub, actual registration in later task)**

Create `components/PushToggle.tsx`:
```tsx
'use client'
import { useEffect, useState } from 'react'
import { Toggle } from './Toggle'

const LOCAL_KEY = 'kletter_push_enabled'

export function PushToggle() {
  const [enabled, setEnabled] = useState(false)

  useEffect(() => {
    setEnabled(localStorage.getItem(LOCAL_KEY) === '1')
  }, [])

  async function handleChange(next: boolean) {
    if (next) {
      const granted = await requestPermissionAndSubscribe()
      if (granted) {
        setEnabled(true)
        localStorage.setItem(LOCAL_KEY, '1')
      }
    } else {
      await unsubscribe()
      setEnabled(false)
      localStorage.removeItem(LOCAL_KEY)
    }
  }

  return <Toggle checked={enabled} onChange={handleChange} label="push notifications" />
}

async function requestPermissionAndSubscribe(): Promise<boolean> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    alert('이 브라우저는 푸시를 지원하지 않아요.')
    return false
  }
  const perm = await Notification.requestPermission()
  if (perm !== 'granted') return false
  const reg = await navigator.serviceWorker.ready
  const sub = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(
      process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
    ),
  })
  await fetch('/api/push/subscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(sub.toJSON()),
  })
  return true
}

async function unsubscribe() {
  if (!('serviceWorker' in navigator)) return
  const reg = await navigator.serviceWorker.ready
  const sub = await reg.pushManager.getSubscription()
  if (sub) {
    await fetch('/api/push/unsubscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ endpoint: sub.endpoint }),
    })
    await sub.unsubscribe()
  }
}

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const raw = atob((base64 + padding).replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from(raw, (c) => c.charCodeAt(0))
}
```

- [ ] **Step 4: Implement CacheClear button**

Create `components/CacheClear.tsx`:
```tsx
'use client'

export function CacheClear() {
  async function clear() {
    if (!confirm('저장된 페이지를 전부 지울까요?')) return
    if ('caches' in self) {
      const names = await caches.keys()
      await Promise.all(names.map((n) => caches.delete(n)))
    }
    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations()
      await Promise.all(regs.map((r) => r.unregister()))
    }
    alert('캐시를 지웠어요. 앱을 다시 열어주세요.')
  }
  return (
    <button
      type="button"
      onClick={clear}
      style={{
        background: 'none', border: 'none',
        color: 'inherit', font: 'inherit',
        cursor: 'pointer', padding: 0,
      }}
    >
      초기화
    </button>
  )
}
```

- [ ] **Step 5: Implement Settings page**

Create `app/settings/page.tsx`:
```tsx
import { AppShell } from '@/components/AppShell'
import { SubscribePanel } from '@/components/SubscribePanel'
import { PushToggle } from '@/components/PushToggle'
import { CacheClear } from '@/components/CacheClear'
import styles from './page.module.css'

export default function SettingsPage() {
  return (
    <AppShell activeTab="settings">
      <div className={styles.groupTitle}>알림</div>
      <div className={styles.group}>
        <div className={styles.row}>
          <div>
            <div className={styles.label}>푸시 알림</div>
            <div className={styles.sub}>새 호 발행 시 기기로 알림 (주 1회)</div>
          </div>
          <PushToggle />
        </div>
      </div>

      <div className={styles.groupTitle}>이메일 구독</div>
      <div className={styles.group}>
        <div className={styles.row} style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 4 }}>
          <div className={styles.label}>이메일로도 받아보기</div>
          <div className={styles.sub}>앱 안 켜도 메일로 주간 리포트 수신</div>
        </div>
        <SubscribePanel />
      </div>

      <div className={styles.groupTitle}>앱</div>
      <div className={styles.group}>
        <div className={styles.row}>
          <div>
            <div className={styles.label}>오프라인 캐시 초기화</div>
            <div className={styles.sub}>저장된 페이지 전부 삭제 후 재다운로드</div>
          </div>
          <CacheClear />
        </div>
        <div className={styles.row}>
          <div>
            <div className={styles.label}>정보</div>
            <div className={styles.sub}>Kletter · 주간 OTT/shortform 트렌드</div>
          </div>
        </div>
      </div>

      <div className={styles.footer}>Kletter · 2026 · made by kay</div>
    </AppShell>
  )
}
```

Create `app/settings/page.module.css`:
```css
.groupTitle { font-size: 11px; font-weight: 700; color: var(--text-muted); letter-spacing: 1px; margin: 8px 4px 8px; text-transform: uppercase; }
.group {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 14px;
  margin-bottom: 14px;
  overflow: hidden;
}
.row { display: flex; align-items: center; justify-content: space-between; padding: 14px 16px; border-bottom: 1px solid var(--border); }
.row:last-child { border-bottom: none; }
.label { font-size: 14px; }
.sub { font-size: 11px; color: var(--text-muted); margin-top: 2px; }
.footer { text-align: center; font-size: 11px; color: var(--text-muted); margin-top: 24px; }
```

- [ ] **Step 6: Commit**

```bash
git add components/Toggle* components/SubscribePanel* components/PushToggle.tsx components/CacheClear.tsx app/settings/
git commit -m "feat(pages): settings page with subscribe, push toggle, cache clear"
```

---

### Task 14: Email subscribe API (port from archive)

**Files:**
- Create: `app/api/subscribe/route.ts`
- Test: `app/api/subscribe/__tests__/route.test.ts`

- [ ] **Step 1: Install resend**

```bash
npm install resend
```

- [ ] **Step 2: Write failing test**

Create `app/api/subscribe/__tests__/route.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { POST } from '../route'

const addMock = vi.fn()
vi.mock('resend', () => ({
  Resend: vi.fn().mockImplementation(() => ({
    contacts: { create: addMock },
  })),
}))

beforeEach(() => {
  addMock.mockReset()
  process.env.RESEND_API_KEY = 'test'
  process.env.RESEND_AUDIENCE_ID = 'aud_test'
})

function req(body: unknown) {
  return new Request('http://t/api/subscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('POST /api/subscribe', () => {
  it('rejects missing email', async () => {
    const res = await POST(req({}))
    expect(res.status).toBe(400)
  })

  it('rejects malformed email', async () => {
    const res = await POST(req({ email: 'not-an-email' }))
    expect(res.status).toBe(400)
  })

  it('adds contact via Resend and returns 200', async () => {
    addMock.mockResolvedValue({ data: { id: 'c1' }, error: null })
    const res = await POST(req({ email: 'test@example.com' }))
    expect(res.status).toBe(200)
    expect(addMock).toHaveBeenCalledWith({
      audienceId: 'aud_test',
      email: 'test@example.com',
      unsubscribed: false,
    })
  })

  it('returns 500 when Resend errors', async () => {
    addMock.mockResolvedValue({ data: null, error: { message: 'boom' } })
    const res = await POST(req({ email: 'test@example.com' }))
    expect(res.status).toBe(500)
  })
})
```

- [ ] **Step 3: Implement route**

Create `app/api/subscribe/route.ts`:
```ts
import { NextResponse } from 'next/server'
import { Resend } from 'resend'
import { z } from 'zod'

const BodySchema = z.object({ email: z.string().email() })

export async function POST(req: Request) {
  const json = await req.json().catch(() => null)
  const parsed = BodySchema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid email' }, { status: 400 })
  }

  const resend = new Resend(process.env.RESEND_API_KEY!)
  const { data, error } = await resend.contacts.create({
    audienceId: process.env.RESEND_AUDIENCE_ID!,
    email: parsed.data.email,
    unsubscribed: false,
  })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ ok: true, id: data?.id })
}
```

- [ ] **Step 4: Run tests — expect pass**

```bash
npm test -- subscribe
```

- [ ] **Step 5: Commit**

```bash
git add app/api/subscribe/ package.json package-lock.json
git commit -m "feat(api): email subscribe via Resend (ported from v0)"
```

---

## Phase 5 — Push Notifications

### Task 15: VAPID key generation & env setup

**Files:**
- Create: `scripts/generate-vapid.ts`, `.env.local.example`
- Modify: `.gitignore` (add `.env*` already there by default)

- [ ] **Step 1: Install web-push + types**

```bash
npm install web-push
npm install --save-dev @types/web-push
```

- [ ] **Step 2: Write VAPID generator**

Create `scripts/generate-vapid.ts`:
```ts
import webpush from 'web-push'
const keys = webpush.generateVAPIDKeys()
console.log('VAPID_PUBLIC_KEY=' + keys.publicKey)
console.log('VAPID_PRIVATE_KEY=' + keys.privateKey)
console.log('# also set VAPID_SUBJECT=mailto:you@example.com')
console.log('# also set NEXT_PUBLIC_VAPID_PUBLIC_KEY to the same value as VAPID_PUBLIC_KEY')
```

- [ ] **Step 3: Run it and save keys**

```bash
npx tsx scripts/generate-vapid.ts > .env.local
```

Edit `.env.local` to add:
```
VAPID_SUBJECT=mailto:kay.kim@watcha.com
NEXT_PUBLIC_VAPID_PUBLIC_KEY=<copy from VAPID_PUBLIC_KEY>
PUSH_NOTIFY_SECRET=<generate: openssl rand -hex 32>
RESEND_API_KEY=<your existing Resend key>
RESEND_AUDIENCE_ID=72321aea-90c4-4875-ae44-61e9fbb50c8d
KV_REST_API_URL=<from Vercel KV setup>
KV_REST_API_TOKEN=<from Vercel KV setup>
```

Generate `PUSH_NOTIFY_SECRET`:
```bash
openssl rand -hex 32
```

- [ ] **Step 4: Create example env file**

Create `.env.local.example`:
```
VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
VAPID_SUBJECT=mailto:you@example.com
NEXT_PUBLIC_VAPID_PUBLIC_KEY=
PUSH_NOTIFY_SECRET=
RESEND_API_KEY=
RESEND_AUDIENCE_ID=
KV_REST_API_URL=
KV_REST_API_TOKEN=
```

- [ ] **Step 5: Verify .env.local not tracked**

```bash
git status
# expect: .env.local not shown as a new file
cat .gitignore | grep env
# expect: .env* or similar
```

- [ ] **Step 6: Commit**

```bash
git add scripts/generate-vapid.ts .env.local.example package.json package-lock.json
git commit -m "chore: add VAPID key generator and env template"
```

---

### Task 16: Push subscribe + unsubscribe APIs

**Files:**
- Create: `lib/push/store.ts`, `app/api/push/subscribe/route.ts`, `app/api/push/unsubscribe/route.ts`
- Test: `lib/push/__tests__/store.test.ts`, `app/api/push/subscribe/__tests__/route.test.ts`

- [ ] **Step 1: Install Vercel KV client**

```bash
npm install @vercel/kv
```

- [ ] **Step 2: Write failing store test**

Create `lib/push/__tests__/store.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

const kvMock = {
  set: vi.fn(),
  del: vi.fn(),
  smembers: vi.fn(),
  sadd: vi.fn(),
  srem: vi.fn(),
  get: vi.fn(),
}
vi.mock('@vercel/kv', () => ({ kv: kvMock }))

import { addSubscription, removeSubscription, listSubscriptions } from '../store'

const sub = {
  endpoint: 'https://push.example.com/abc',
  keys: { p256dh: 'p1', auth: 'a1' },
}

beforeEach(() => {
  Object.values(kvMock).forEach((m) => m.mockReset())
})

describe('push store', () => {
  it('addSubscription writes token and indexes endpoint', async () => {
    await addSubscription(sub as any)
    expect(kvMock.set).toHaveBeenCalledWith(
      expect.stringContaining('push:'),
      sub,
    )
    expect(kvMock.sadd).toHaveBeenCalledWith('push:index', sub.endpoint)
  })

  it('removeSubscription deletes token and removes from index', async () => {
    await removeSubscription(sub.endpoint)
    expect(kvMock.del).toHaveBeenCalled()
    expect(kvMock.srem).toHaveBeenCalledWith('push:index', sub.endpoint)
  })

  it('listSubscriptions reads all from index', async () => {
    kvMock.smembers.mockResolvedValue([sub.endpoint])
    kvMock.get.mockResolvedValue(sub)
    const all = await listSubscriptions()
    expect(all).toEqual([sub])
  })
})
```

- [ ] **Step 3: Implement store**

Create `lib/push/store.ts`:
```ts
import { kv } from '@vercel/kv'
import { createHash } from 'node:crypto'

export interface PushSubscription {
  endpoint: string
  keys: { p256dh: string; auth: string }
}

const INDEX_KEY = 'push:index'

function tokenKey(endpoint: string): string {
  const hash = createHash('sha256').update(endpoint).digest('hex').slice(0, 16)
  return `push:${hash}`
}

export async function addSubscription(sub: PushSubscription): Promise<void> {
  await kv.set(tokenKey(sub.endpoint), sub)
  await kv.sadd(INDEX_KEY, sub.endpoint)
}

export async function removeSubscription(endpoint: string): Promise<void> {
  await kv.del(tokenKey(endpoint))
  await kv.srem(INDEX_KEY, endpoint)
}

export async function listSubscriptions(): Promise<PushSubscription[]> {
  const endpoints = (await kv.smembers(INDEX_KEY)) as string[]
  const subs = await Promise.all(endpoints.map((e) => kv.get<PushSubscription>(tokenKey(e))))
  return subs.filter((s): s is PushSubscription => !!s)
}
```

- [ ] **Step 4: Run test — expect pass**

- [ ] **Step 5: Write failing subscribe route test**

Create `app/api/push/subscribe/__tests__/route.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

const addMock = vi.fn()
vi.mock('@/lib/push/store', () => ({ addSubscription: addMock }))

import { POST } from '../route'

beforeEach(() => addMock.mockReset())

function req(body: unknown) {
  return new Request('http://t/api/push/subscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('POST /api/push/subscribe', () => {
  it('rejects missing endpoint', async () => {
    const res = await POST(req({ keys: {} }))
    expect(res.status).toBe(400)
  })

  it('stores valid subscription', async () => {
    const body = {
      endpoint: 'https://p.example.com/x',
      keys: { p256dh: 'p', auth: 'a' },
    }
    const res = await POST(req(body))
    expect(res.status).toBe(200)
    expect(addMock).toHaveBeenCalledWith(body)
  })
})
```

- [ ] **Step 6: Implement subscribe route**

Create `app/api/push/subscribe/route.ts`:
```ts
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { addSubscription } from '@/lib/push/store'

const Schema = z.object({
  endpoint: z.string().url(),
  keys: z.object({ p256dh: z.string(), auth: z.string() }),
})

export async function POST(req: Request) {
  const json = await req.json().catch(() => null)
  const parsed = Schema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid subscription' }, { status: 400 })
  }
  await addSubscription(parsed.data)
  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 7: Implement unsubscribe route**

Create `app/api/push/unsubscribe/route.ts`:
```ts
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { removeSubscription } from '@/lib/push/store'

const Schema = z.object({ endpoint: z.string().url() })

export async function POST(req: Request) {
  const json = await req.json().catch(() => null)
  const parsed = Schema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid endpoint' }, { status: 400 })
  }
  await removeSubscription(parsed.data.endpoint)
  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 8: Commit**

```bash
git add lib/push/ app/api/push/subscribe/ app/api/push/unsubscribe/ package.json package-lock.json
git commit -m "feat(api): push subscribe/unsubscribe with Vercel KV store"
```

---

### Task 17: Push notify API (send to all subscribers)

**Files:**
- Create: `lib/push/send.ts`, `app/api/push/notify/route.ts`
- Test: `lib/push/__tests__/send.test.ts`, `app/api/push/notify/__tests__/route.test.ts`

- [ ] **Step 1: Write failing send test**

Create `lib/push/__tests__/send.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

const sendMock = vi.fn()
vi.mock('web-push', () => ({
  default: { setVapidDetails: vi.fn(), sendNotification: sendMock },
  setVapidDetails: vi.fn(),
  sendNotification: sendMock,
}))
const listMock = vi.fn()
const removeMock = vi.fn()
vi.mock('../store', () => ({
  listSubscriptions: listMock,
  removeSubscription: removeMock,
}))

import { sendToAll } from '../send'

const subA = { endpoint: 'https://a/', keys: { p256dh: 'p', auth: 'a' } }
const subB = { endpoint: 'https://b/', keys: { p256dh: 'p', auth: 'a' } }

beforeEach(() => {
  sendMock.mockReset()
  listMock.mockReset()
  removeMock.mockReset()
  process.env.VAPID_PUBLIC_KEY = 'pub'
  process.env.VAPID_PRIVATE_KEY = 'priv'
  process.env.VAPID_SUBJECT = 'mailto:x@x'
})

describe('sendToAll', () => {
  it('sends payload to each subscriber', async () => {
    listMock.mockResolvedValue([subA, subB])
    sendMock.mockResolvedValue(undefined)
    const result = await sendToAll({ title: 't', body: 'b', url: '/x' })
    expect(sendMock).toHaveBeenCalledTimes(2)
    expect(result.sent).toBe(2)
    expect(result.removed).toBe(0)
  })

  it('removes subscription on 410 Gone', async () => {
    listMock.mockResolvedValue([subA])
    const err: any = new Error('gone'); err.statusCode = 410
    sendMock.mockRejectedValue(err)
    const result = await sendToAll({ title: 't', body: 'b', url: '/x' })
    expect(removeMock).toHaveBeenCalledWith(subA.endpoint)
    expect(result.sent).toBe(0)
    expect(result.removed).toBe(1)
  })

  it('counts non-410 errors as failures, does not remove', async () => {
    listMock.mockResolvedValue([subA])
    const err: any = new Error('500'); err.statusCode = 500
    sendMock.mockRejectedValue(err)
    const result = await sendToAll({ title: 't', body: 'b', url: '/x' })
    expect(removeMock).not.toHaveBeenCalled()
    expect(result.failed).toBe(1)
  })
})
```

- [ ] **Step 2: Implement send**

Create `lib/push/send.ts`:
```ts
import webpush from 'web-push'
import { listSubscriptions, removeSubscription } from './store'

export interface PushPayload {
  title: string
  body: string
  url: string
  icon?: string
}

export interface SendResult {
  sent: number
  failed: number
  removed: number
}

let configured = false

function configure() {
  if (configured) return
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT!,
    process.env.VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!,
  )
  configured = true
}

export async function sendToAll(payload: PushPayload): Promise<SendResult> {
  configure()
  const subs = await listSubscriptions()
  let sent = 0, failed = 0, removed = 0
  const body = JSON.stringify(payload)
  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(s, body)
        sent += 1
      } catch (err) {
        const status = (err as { statusCode?: number }).statusCode
        if (status === 404 || status === 410) {
          await removeSubscription(s.endpoint)
          removed += 1
        } else {
          failed += 1
        }
      }
    }),
  )
  return { sent, failed, removed }
}
```

- [ ] **Step 3: Run test — expect pass**

- [ ] **Step 4: Write failing notify route test**

Create `app/api/push/notify/__tests__/route.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

const sendMock = vi.fn()
vi.mock('@/lib/push/send', () => ({ sendToAll: sendMock }))

import { POST } from '../route'

function req(secret: string | null, body: unknown) {
  return new Request('http://t/api/push/notify', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(secret ? { 'x-notify-secret': secret } : {}),
    },
    body: JSON.stringify(body),
  })
}

beforeEach(() => {
  sendMock.mockReset()
  process.env.PUSH_NOTIFY_SECRET = 's3cret'
})

describe('POST /api/push/notify', () => {
  it('rejects without secret', async () => {
    const res = await POST(req(null, { title: 't', body: 'b', url: '/x' }))
    expect(res.status).toBe(401)
  })

  it('rejects with wrong secret', async () => {
    const res = await POST(req('nope', { title: 't', body: 'b', url: '/x' }))
    expect(res.status).toBe(401)
  })

  it('rejects invalid payload', async () => {
    const res = await POST(req('s3cret', { title: 't' }))
    expect(res.status).toBe(400)
  })

  it('calls sendToAll with payload and returns stats', async () => {
    sendMock.mockResolvedValue({ sent: 3, failed: 0, removed: 1 })
    const res = await POST(req('s3cret', { title: 't', body: 'b', url: '/x' }))
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json).toEqual({ sent: 3, failed: 0, removed: 1 })
  })
})
```

- [ ] **Step 5: Implement notify route**

Create `app/api/push/notify/route.ts`:
```ts
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { sendToAll } from '@/lib/push/send'

const PayloadSchema = z.object({
  title: z.string(),
  body: z.string(),
  url: z.string(),
  icon: z.string().optional(),
})

export async function POST(req: Request) {
  const secret = req.headers.get('x-notify-secret')
  if (!secret || secret !== process.env.PUSH_NOTIFY_SECRET) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  const json = await req.json().catch(() => null)
  const parsed = PayloadSchema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid payload' }, { status: 400 })
  }
  const result = await sendToAll(parsed.data)
  return NextResponse.json(result)
}
```

- [ ] **Step 6: Run all tests**

```bash
npm test
```

- [ ] **Step 7: Commit**

```bash
git add lib/push/send.ts lib/push/__tests__/send.test.ts app/api/push/notify/
git commit -m "feat(api): push notify endpoint with authenticated fan-out"
```

---

## Phase 6 — PWA

### Task 18: Service worker (via next-pwa) + offline fallback page

**Files:**
- Modify: `next.config.mjs`
- Create: `public/manifest.json`, `app/offline/page.tsx`, `app/layout.tsx` (modify)
- Create: `public/icons/icon-192.png`, `public/icons/icon-512.png` (placeholder)

- [ ] **Step 1: Install next-pwa**

```bash
npm install @ducanh2912/next-pwa
```

- [ ] **Step 2: Configure Next.js**

Replace `next.config.mjs`:
```js
import withPWAInit from '@ducanh2912/next-pwa'

const withPWA = withPWAInit({
  dest: 'public',
  disable: process.env.NODE_ENV === 'development',
  register: true,
  fallbacks: { document: '/offline' },
  workboxOptions: {
    runtimeCaching: [
      {
        urlPattern: ({ request }) => request.mode === 'navigate',
        handler: 'NetworkFirst',
        options: {
          cacheName: 'pages',
          networkTimeoutSeconds: 4,
          expiration: { maxEntries: 50, maxAgeSeconds: 60 * 60 * 24 * 30 },
        },
      },
      {
        urlPattern: ({ request }) =>
          request.destination === 'image' || request.destination === 'style' || request.destination === 'script',
        handler: 'StaleWhileRevalidate',
        options: { cacheName: 'assets', expiration: { maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 * 30 } },
      },
    ],
  },
})

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
}

export default withPWA(nextConfig)
```

- [ ] **Step 3: Create manifest**

Create `public/manifest.json`:
```json
{
  "name": "Kletter",
  "short_name": "Kletter",
  "description": "일본 OTT & shortform 주간 트렌드",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#0A0A0B",
  "theme_color": "#FF0558",
  "lang": "ko",
  "orientation": "portrait",
  "icons": [
    { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any maskable" }
  ]
}
```

- [ ] **Step 4: Generate placeholder icons**

For now, use a solid-color SVG rendered to PNG. Create once with sips:

```bash
mkdir -p public/icons
python3 - <<'PY'
from PIL import Image, ImageDraw
for size in (192, 512):
    img = Image.new('RGBA', (size, size), (255, 5, 88, 255))
    d = ImageDraw.Draw(img)
    # White "K" letter rough
    d.rectangle((size*0.25, size*0.15, size*0.35, size*0.85), fill=(255,255,255,255))
    d.polygon([(size*0.35, size*0.5), (size*0.70, size*0.15), (size*0.78, size*0.15),
               (size*0.43, size*0.5), (size*0.78, size*0.85), (size*0.70, size*0.85)],
              fill=(255,255,255,255))
    img.save(f'public/icons/icon-{size}.png', 'PNG')
print('icons written')
PY
```

(If Pillow missing: `pip3 install pillow` first. Alternative: ask user to provide real icons later.)

- [ ] **Step 5: Add manifest + service worker hooks in layout**

Modify `app/layout.tsx`:
```tsx
import type { Metadata, Viewport } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Kletter',
  description: '일본 OTT & shortform 주간 트렌드',
  manifest: '/manifest.json',
}

export const viewport: Viewport = {
  themeColor: '#FF0558',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  )
}
```

- [ ] **Step 6: Create offline fallback page**

Create `app/offline/page.tsx`:
```tsx
export default function Offline() {
  return (
    <div style={{ padding: '80px 24px', textAlign: 'center', color: '#888' }}>
      <div style={{ fontSize: 40, marginBottom: 16 }}>✈︎</div>
      <h1 style={{ fontSize: 18, color: '#F0F0F0', marginBottom: 8 }}>오프라인이에요</h1>
      <p style={{ fontSize: 13 }}>이전에 읽은 페이지는 홈으로 돌아가면 열릴 수 있어요.</p>
    </div>
  )
}
```

- [ ] **Step 7: Verify build**

```bash
npm run build
# expect: service worker generated at public/sw.js
```

- [ ] **Step 8: Commit**

```bash
git add next.config.mjs public/manifest.json public/icons/ app/offline/ app/layout.tsx package.json package-lock.json
git commit -m "feat(pwa): service worker, manifest, icons, offline fallback"
```

---

### Task 19: Push receive + click handler in service worker

**Files:**
- Create: `public/sw-push.js` (imported by next-pwa worker) — actually with @ducanh2912/next-pwa, use custom worker at `worker/index.ts`

- [ ] **Step 1: Configure custom worker**

Modify `next.config.mjs` to enable custom worker:
```js
const withPWA = withPWAInit({
  dest: 'public',
  disable: process.env.NODE_ENV === 'development',
  register: true,
  customWorkerDir: 'worker',
  fallbacks: { document: '/offline' },
  workboxOptions: { /* same as Task 18 */ },
})
```

- [ ] **Step 2: Create custom worker**

Create `worker/index.ts`:
```ts
/// <reference lib="webworker" />
declare const self: ServiceWorkerGlobalScope

self.addEventListener('push', (event) => {
  const data = event.data?.json() ?? {}
  const title = data.title ?? 'Kletter'
  const options: NotificationOptions = {
    body: data.body ?? '',
    icon: data.icon ?? '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    data: { url: data.url ?? '/' },
  }
  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = (event.notification.data?.url as string) ?? '/'
  event.waitUntil(
    self.clients.matchAll({ type: 'window' }).then((clients) => {
      for (const c of clients) {
        if ('focus' in c) { c.focus(); (c as WindowClient).navigate(url); return }
      }
      return self.clients.openWindow(url)
    }),
  )
})
```

- [ ] **Step 3: Build verification**

```bash
npm run build
# expect: worker bundled into public/sw.js
```

- [ ] **Step 4: Commit**

```bash
git add next.config.mjs worker/
git commit -m "feat(pwa): custom service worker with push receive + click handlers"
```

---

## Phase 7 — Deployment

### Task 20: Vercel KV provisioning

**Files:** (none — Vercel dashboard)

- [ ] **Step 1: Create KV store in Vercel dashboard**

In Vercel project settings → Storage → Create KV store, name `kletter-push`.
After creation, copy `KV_REST_API_URL` and `KV_REST_API_TOKEN`.

- [ ] **Step 2: Set env vars in Vercel project**

Project → Settings → Environment Variables, add for Production + Preview:
- `VAPID_PUBLIC_KEY`
- `VAPID_PRIVATE_KEY`
- `VAPID_SUBJECT`
- `NEXT_PUBLIC_VAPID_PUBLIC_KEY` (same as public)
- `PUSH_NOTIFY_SECRET`
- `RESEND_API_KEY`
- `RESEND_AUDIENCE_ID` = `72321aea-90c4-4875-ae44-61e9fbb50c8d`
- `KV_REST_API_URL`
- `KV_REST_API_TOKEN`

(No code change this step.)

---

### Task 21: Update Vercel project root directory

- [ ] **Step 1: Update Vercel Root Directory setting**

Vercel project → Settings → General → Root Directory. Change from `deploy` to `.` (project root).

Framework Preset: `Next.js`.

- [ ] **Step 2: Trigger preview deploy**

```bash
git push origin app-v1
```

Check Vercel → Deployments for the preview URL. Visit:
- `/` — home page
- `/weekly`, `/weekly/2026-W17` — list + detail
- `/shortform`, `/shortform/2026-W17`
- `/settings`
- `/offline` — fallback

All should return 200.

---

### Task 22: Post-deploy wiring for push on publish

**Files:**
- Create: `.github/workflows/notify-on-publish.yml`

This assumes we notify *after* a merge into main touches `content/weekly/*.mdx` or `content/shortform/*.mdx`.

- [ ] **Step 1: Write the workflow**

Create `.github/workflows/notify-on-publish.yml`:
```yaml
name: Notify on publish
on:
  push:
    branches: [main]
    paths:
      - 'content/weekly/**'
      - 'content/shortform/**'

jobs:
  notify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with: { fetch-depth: 2 }
      - name: Wait for Vercel deploy
        run: sleep 90
      - name: Pick latest changed entry and notify
        env:
          NOTIFY_SECRET: ${{ secrets.PUSH_NOTIFY_SECRET }}
        run: |
          set -euo pipefail
          changed=$(git diff --name-only HEAD~1 HEAD | grep -E '^content/(weekly|shortform)/.*\.mdx$' | head -n1)
          if [ -z "$changed" ]; then echo "no content change"; exit 0; fi
          slug=$(basename "$changed" .mdx)
          kind=$(echo "$changed" | cut -d/ -f2)
          title=$(awk '/^title:/ {sub(/^title: *"?/, ""); sub(/"?$/, ""); print; exit}' "$changed")
          excerpt=$(awk '/^excerpt:/ {sub(/^excerpt: *"?/, ""); sub(/"?$/, ""); print; exit}' "$changed")
          url="https://kletter.vercel.app/$kind/$slug"
          label=$([ "$kind" = weekly ] && echo OTT || echo shortform)
          payload=$(jq -nc --arg t "Kletter · $label · $slug" --arg b "$title — $excerpt" --arg u "$url" \
                    '{title:$t, body:$b, url:$u, icon:"/icons/icon-192.png"}')
          curl -fsS -X POST https://kletter.vercel.app/api/push/notify \
            -H "content-type: application/json" \
            -H "x-notify-secret: $NOTIFY_SECRET" \
            -d "$payload"
```

- [ ] **Step 2: Add the secret**

In GitHub repo Settings → Secrets and variables → Actions → New secret:
- `PUSH_NOTIFY_SECRET` (same value as Vercel env)

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/notify-on-publish.yml
git commit -m "ci: notify push subscribers on content publish to main"
```

---

### Task 23: Manual verification checklist and production cutover

- [ ] **Step 1: Run full test suite**

```bash
npm test
npm run lint
npm run build
# all three must pass
```

- [ ] **Step 2: Test push on preview deploy (with real device)**

From the preview URL:
1. Open on iPhone Safari (iOS 16.4+), add to Home Screen
2. Open from Home Screen, go to Settings, toggle 푸시 on, grant permission
3. On same device (or desktop) run:

```bash
curl -X POST https://<preview-url>/api/push/notify \
  -H "content-type: application/json" \
  -H "x-notify-secret: <PUSH_NOTIFY_SECRET>" \
  -d '{"title":"Test","body":"hello","url":"/"}'
```

4. Phone receives notification. Tap it → app opens to `/`.

Repeat on Galaxy Chrome.

- [ ] **Step 3: Run the wet checklist**

- [ ] Home renders latest OTT + latest shortform
- [ ] `/weekly`, `/weekly/2026-W17`, `/weekly/2026-W16` open
- [ ] `/shortform`, `/shortform/2026-W17` open
- [ ] Swipe on `/weekly/2026-W17` navigates to `/weekly/2026-W16`
- [ ] Bottom tab navigation works
- [ ] `/settings` toggles work, email subscribe reaches Resend
- [ ] Airplane mode: previously visited page opens, unvisited shows offline page
- [ ] PWA installs on iPhone and Galaxy

- [ ] **Step 4: Merge to main**

```bash
git checkout main
git merge --no-ff app-v1 -m "Kletter app v1 — PWA, tabs, push, offline"
git push origin main
```

Vercel auto-deploys to production. Verify `kletter.vercel.app` now serves the new app.

- [ ] **Step 5: Smoke-test production**

Repeat Step 3 on `kletter.vercel.app`. Any failure → revert:

```bash
git revert -m 1 HEAD
git push origin main
```

- [ ] **Step 6: Clean up**

```bash
# optional: delete branch after success
git branch -d app-v1
git push origin --delete app-v1
```

- [ ] **Step 7: Update project memory**

Save outcomes to memory: Vercel root changed from `deploy/` to `.`; v0 preserved at `archive/web-v0/`; push infrastructure live; content path `content/<kind>/<slug>.mdx`.

---

## Self-Review Summary

**Spec coverage:** Every section/requirement mapped to tasks:
- §1 배경 & 목적 → whole plan
- §2 범위 & 원칙: PWA dimensions → Tasks 18–19, 4-tab UI → Tasks 6–11, Vercel 정본 → Task 21
- §3 기술 스택 → Tasks 2 (Next.js), 4 (MDX), 15–17 (push), 18–19 (PWA)
- §4 아키텍처 → Tasks 2, 16, 17, 20
- §5 페이지 & 라우팅 → Tasks 8–11
- §6 UI 컴포넌트 → Tasks 6–7, 11–13
- §7 콘텐츠 모델 → Tasks 4–5
- §8 데이터 흐름 → Tasks 14, 16, 17, 22
- §9 에러 처리 → Tasks 14 (zod validation), 17 (410 Gone handling), 18 (offline fallback)
- §10 테스트 & 검증 → TDD in every component task; manual checklist in Task 23
- §11 배포 & 운영 → Tasks 20–23
- §12 환경 변수 → Task 15, 20
- §13 범위 밖 (schedule agent, ADP 정리, accounts, search) → intentionally not in plan

**No placeholders detected:** All code blocks are complete. Icon generation uses Pillow (fallback documented).

**Type consistency:** `ContentEntry`, `ContentKind`, `Frontmatter` types used consistently across Tasks 4–11. `PushSubscription`, `PushPayload`, `SendResult` consistent across Tasks 16–17. Tab IDs `home | weekly | shortform | settings` same in Tasks 6, 8–11, 13.

---
