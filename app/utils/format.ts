// Display helpers (auto-imported by Nuxt in app/).

const MAP_COLORS: Record<string, [string, string]> = {
  mirage: ['#c98a3e', '#6b3d1c'],
  inferno: ['#b5462f', '#4a1c14'],
  nuke: ['#2f8f8a', '#1b3440'],
  ancient: ['#4f8a3c', '#1d3a22'],
  anubis: ['#3b6fb5', '#6b5420'],
  dust2: ['#d1a865', '#7a5428'],
  vertigo: ['#6aa3d8', '#2f3d55'],
  overpass: ['#6c8f6a', '#2d3b3a'],
  train: ['#7d8794', '#2d333d'],
  office: ['#8fb0c9', '#2c3a4a'],
  italy: ['#c8743f', '#5a2f22'],
  cache: ['#9aa35a', '#3d3f22'],
}

/** "de_mirage" → "mirage" (also strips workshop paths like "workshop/123/de_x"). */
export function mapSlug(mapName: string): string {
  const base = mapName.split('/').at(-1) ?? mapName
  return base.replace(/^(de|cs|ar|aim|awp|fy|gd|dz)_/i, '').toLowerCase()
}

/** "de_mirage" → "Mirage", "ar_pool_day" → "Pool Day" */
export function mapLabel(mapName: string): string {
  const slug = mapSlug(mapName)
  if (slug === 'dust2') return 'Dust II'
  return slug.split('_').filter(Boolean).map(w => w[0]!.toUpperCase() + w.slice(1)).join(' ') || mapName
}

function hashHue(s: string): number {
  let h = 0
  for (const ch of s) h = (h * 31 + ch.codePointAt(0)!) >>> 0
  return h % 360
}

export function mapGradient(mapName: string): string {
  const slug = mapSlug(mapName)
  const known = MAP_COLORS[slug]
  const [a, b] = known ?? [`hsl(${hashHue(slug)} 45% 45%)`, `hsl(${(hashHue(slug) + 40) % 360} 40% 18%)`]
  return `linear-gradient(135deg, ${a} 0%, ${b} 100%)`
}

/** Stable color per team name. */
export function teamColor(name: string): string {
  return `hsl(${hashHue(name)} 60% 55%)`
}

const dateFmt = new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
const timeFmt = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit' })

export function formatDate(iso: string): string {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? iso : dateFmt.format(d)
}

export function formatTime(iso: string): string {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '' : timeFmt.format(d)
}

export function formatDuration(sec: number | null): string {
  if (sec === null) return ''
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  return h > 0 ? `${h}h ${String(m).padStart(2, '0')}m` : `${m}m`
}

export const fixed = (v: number, d: number) => v.toFixed(d)
export const signed = (v: number) => (v > 0 ? `+${v}` : String(v))

export function ratingClass(r: number): string {
  if (r >= 1.1) return 'pos'
  if (r <= 0.9) return 'neg'
  return ''
}

export const diffClass = (v: number) => (v > 0 ? 'pos' : v < 0 ? 'neg' : '')

/** "5K: 1 · 4K: 2" – only non-zero entries. */
export function multiKills(p: { k2: number, k3: number, k4: number, k5: number }): string {
  return ([['5K', p.k5], ['4K', p.k4], ['3K', p.k3], ['2K', p.k2]] as const)
    .filter(([, n]) => n > 0)
    .map(([l, n]) => `${l}: ${n}`)
    .join(' · ')
}
