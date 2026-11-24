// Pure stat computations. No I/O – everything here is unit-tested (tests/stats.test.ts).
import type {
  DerivedStats,
  LeaderboardRow,
  MapDetailResponse,
  MapStatus,
  MapSummary,
  PlayerLine,
  SeriesSummary,
  StatTotals,
} from '../../shared/types'

// ---------------------------------------------------------------------------
// Raw rows, exactly as read from matchzy.db (see server/utils/matchzy.ts)
// ---------------------------------------------------------------------------

export interface RawMatch {
  matchid: number
  start_time: string
  end_time: string | null
  winner: string
  series_type: string
  team1_name: string
  team1_score: number
  team2_name: string
  team2_score: number
}

export interface RawMap {
  matchid: number
  mapnumber: number
  start_time: string
  end_time: string | null
  winner: string
  mapname: string
  team1_score: number
  team2_score: number
}

export interface RawPlayer {
  matchid: number
  mapnumber: number
  /** Read as TEXT – SteamID64 does not fit in a JS number. */
  steamid64: string
  team: string
  name: string
  kills: number
  deaths: number
  assists: number
  damage: number
  enemy5ks: number
  enemy4ks: number
  enemy3ks: number
  enemy2ks: number
  utility_damage: number
  v1_count: number
  v1_wins: number
  v2_count: number
  v2_wins: number
  entry_count: number
  entry_wins: number
  head_shot_kills: number
}

export interface RawData {
  matches: RawMatch[]
  maps: RawMap[]
  players: RawPlayer[]
}

// ---------------------------------------------------------------------------
// Basic helpers
// ---------------------------------------------------------------------------

const round = (v: number, digits: number): number => {
  const f = 10 ** digits
  return Math.round((v + Number.EPSILON) * f) / f
}

export const mapKey = (matchId: number, mapNumber: number): string => `${matchId}-${mapNumber}`

/** MatchZy stores SQLite timestamps via datetime('now') → "YYYY-MM-DD HH:MM:SS" in UTC. */
export function toIso(ts: string | null | undefined): string | null {
  if (!ts) return null
  let s = ts.trim().replace(' ', 'T')
  if (!/[zZ]|[+-]\d\d:?\d\d$/.test(s)) s += 'Z'
  const d = new Date(s)
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}

export function emptyTotals(): StatTotals {
  return {
    rounds: 0, kills: 0, deaths: 0, assists: 0, damage: 0, headshotKills: 0,
    k2: 0, k3: 0, k4: 0, k5: 0, clutchWins: 0, clutchAttempts: 0,
    entryWins: 0, entryAttempts: 0, utilityDamage: 0,
  }
}

/** Converts one raw player row (+ rounds played on that map) into StatTotals. */
export function totalsFromRaw(p: RawPlayer, rounds: number): StatTotals {
  return {
    rounds,
    kills: p.kills,
    deaths: p.deaths,
    assists: p.assists,
    damage: p.damage,
    headshotKills: p.head_shot_kills,
    k2: p.enemy2ks,
    k3: p.enemy3ks,
    k4: p.enemy4ks,
    k5: p.enemy5ks,
    // MatchZy's schema only tracks 1v1 and 1v2 situations.
    clutchWins: p.v1_wins + p.v2_wins,
    clutchAttempts: p.v1_count + p.v2_count,
    entryWins: p.entry_wins,
    entryAttempts: p.entry_count,
    utilityDamage: p.utility_damage,
  }
}

export function addTotals(a: StatTotals, b: StatTotals): StatTotals {
  const out = { ...a }
  for (const k of Object.keys(out) as Array<keyof StatTotals>) out[k] += b[k]
  return out
}

export function sumTotals(list: StatTotals[]): StatTotals {
  return list.reduce(addTotals, emptyTotals())
}

/**
 * Simplified HLTV Rating 1.0.
 *   1K = kills − 2·2K − 3·3K − 4·4K − 5·5K
 *   killRating      = K / R / 0.679
 *   survivalRating  = (R − D) / R / 0.317
 *   multiKillRating = (1K + 4·2K + 9·3K + 16·4K + 25·5K) / R / 1.277
 *   rating          = (killRating + 0.7·survivalRating + multiKillRating) / 2.7
 * Unrounded. Returns 0 when no rounds were played.
 */
export function hltvRating1(t: Pick<StatTotals, 'rounds' | 'kills' | 'deaths' | 'k2' | 'k3' | 'k4' | 'k5'>): number {
  const R = t.rounds
  if (R <= 0) return 0
  const k1 = t.kills - 2 * t.k2 - 3 * t.k3 - 4 * t.k4 - 5 * t.k5
  const killRating = t.kills / R / 0.679
  const survivalRating = (R - t.deaths) / R / 0.317
  const multiKillRating = (k1 + 4 * t.k2 + 9 * t.k3 + 16 * t.k4 + 25 * t.k5) / R / 1.277
  return (killRating + 0.7 * survivalRating + multiKillRating) / 2.7
}

/** Derived stats, always computed from sums (never averages of averages). */
export function derive(t: StatTotals): DerivedStats {
  return {
    diff: t.kills - t.deaths,
    kd: round(t.kills / Math.max(t.deaths, 1), 2),
    adr: t.rounds > 0 ? round(t.damage / t.rounds, 1) : 0,
    hsPct: t.kills > 0 ? round((t.headshotKills / t.kills) * 100, 1) : 0,
    rating: round(hltvRating1(t), 2),
  }
}

/**
 * Match MVP = highest rating; ties broken by ADR, then kills, then steamId (deterministic).
 * Rating is compared at display precision (2 decimals), so two players both showing
 * "1.23" are tied and the ADR tie-break applies – matching what people see on screen.
 */
export function pickMvp<T extends StatTotals & { steamId: string }>(players: T[]): T | null {
  let best: T | null = null
  let bestKey: [number, number, number] = [-Infinity, -Infinity, -Infinity]
  for (const p of players) {
    const key: [number, number, number] = [
      round(hltvRating1(p), 2),
      p.rounds > 0 ? round(p.damage / p.rounds, 1) : 0,
      p.kills,
    ]
    const cmp = key[0] - bestKey[0] || key[1] - bestKey[1] || key[2] - bestKey[2]
      || (best ? best.steamId.localeCompare(p.steamId) : 1)
    if (cmp > 0) {
      best = p
      bestKey = key
    }
  }
  return best
}

// ---------------------------------------------------------------------------
// Assembly
// ---------------------------------------------------------------------------

const compareMapOrder = (a: { matchid: number, mapnumber: number }, b: { matchid: number, mapnumber: number }) =>
  a.matchid - b.matchid || a.mapnumber - b.mapnumber

/** steamId → nickname from the most recent map the player appeared in. */
export function latestNames(players: RawPlayer[]): Map<string, string> {
  const names = new Map<string, string>()
  for (const p of [...players].sort(compareMapOrder)) names.set(p.steamid64, p.name)
  return names
}

interface Context {
  data: RawData
  now: Date
  names: Map<string, string>
  matchById: Map<number, RawMatch>
  playersByMap: Map<string, RawPlayer[]>
  latestMap: RawMap | undefined
  maxMatchId: number
}

function buildContext(data: RawData, now: Date): Context {
  const playersByMap = new Map<string, RawPlayer[]>()
  for (const p of data.players) {
    const k = mapKey(p.matchid, p.mapnumber)
    const list = playersByMap.get(k)
    if (list) list.push(p)
    else playersByMap.set(k, [p])
  }
  const sortedMaps = [...data.maps].sort(compareMapOrder)
  return {
    data,
    now,
    names: latestNames(data.players),
    matchById: new Map(data.matches.map(m => [m.matchid, m])),
    playersByMap,
    latestMap: sortedMaps.at(-1),
    maxMatchId: Math.max(0, ...data.matches.map(m => m.matchid), ...data.maps.map(m => m.matchid)),
  }
}

function mapStatus(ctx: Context, m: RawMap): MapStatus {
  if (m.end_time) return 'finished'
  // Only the newest map can be live. An unfinished map followed by newer
  // matches/maps was abandoned (server restart, crash, .endmatch on old builds…).
  const isLatest = ctx.latestMap === m && m.matchid === ctx.maxMatchId
  return isLatest ? 'live' : 'abandoned'
}

function linesForMap(ctx: Context, m: RawMap, status: MapStatus): PlayerLine[] {
  const rounds = m.team1_score + m.team2_score
  const lines: PlayerLine[] = (ctx.playersByMap.get(mapKey(m.matchid, m.mapnumber)) ?? []).map((p) => {
    const t = totalsFromRaw(p, rounds)
    return {
      steamId: p.steamid64,
      name: ctx.names.get(p.steamid64) ?? p.name,
      team: p.team,
      ...t,
      ...derive(t),
      isMatchMvp: false,
    }
  })
  // No MVP for maps nobody actually played (e.g. a test map ended right after warmup).
  if (status === 'finished' && lines.some(l => l.kills > 0)) {
    const mvp = pickMvp(lines)
    if (mvp) mvp.isMatchMvp = true
  }
  return lines
}

function summarizeMap(ctx: Context, m: RawMap): { summary: MapSummary, lines: PlayerLine[] } {
  const match = ctx.matchById.get(m.matchid)
  const status = mapStatus(ctx, m)
  const lines = linesForMap(ctx, m, status)
  const start = toIso(m.start_time)
  const end = toIso(m.end_time)
  let durationSec: number | null = null
  if (start) {
    const endMs = end ? Date.parse(end) : status === 'live' ? ctx.now.getTime() : NaN
    const d = Math.round((endMs - Date.parse(start)) / 1000)
    durationSec = Number.isFinite(d) && d >= 0 ? d : null
  }
  const mvp = lines.find(l => l.isMatchMvp)
  return {
    summary: {
      key: mapKey(m.matchid, m.mapnumber),
      matchId: m.matchid,
      mapNumber: m.mapnumber,
      mapName: m.mapname,
      team1: { name: match?.team1_name ?? 'Team 1', score: m.team1_score },
      team2: { name: match?.team2_name ?? 'Team 2', score: m.team2_score },
      winner: status === 'finished' && m.winner ? m.winner : null,
      status,
      startTime: start ?? m.start_time,
      endTime: end,
      durationSec,
      hasStats: lines.length > 0,
      mvp: mvp ? { steamId: mvp.steamId, name: mvp.name } : null,
    },
    lines,
  }
}

const byRatingDesc = (a: PlayerLine, b: PlayerLine) =>
  hltvRating1(b) - hltvRating1(a) || b.adr - a.adr || b.kills - a.kills

/** GET /api/matches – series newest first, maps inside a series in play order. */
export function buildMatchList(data: RawData, now = new Date()): SeriesSummary[] {
  const ctx = buildContext(data, now)
  const bySeries = new Map<number, MapSummary[]>()
  for (const m of [...data.maps].sort(compareMapOrder)) {
    const list = bySeries.get(m.matchid) ?? []
    list.push(summarizeMap(ctx, m).summary)
    bySeries.set(m.matchid, list)
  }
  const series: SeriesSummary[] = []
  for (const [matchId, maps] of bySeries) {
    const match = ctx.matchById.get(matchId)
    const seriesType = match?.series_type || 'BO1'
    const bestOf = Number(/^bo(\d+)$/i.exec(seriesType)?.[1] ?? 1)
    series.push({
      matchId,
      seriesType,
      team1: { name: match?.team1_name ?? maps[0]!.team1.name, score: match?.team1_score ?? 0 },
      team2: { name: match?.team2_name ?? maps[0]!.team2.name, score: match?.team2_score ?? 0 },
      winner: match?.winner || null,
      isMultiMap: maps.length > 1 || bestOf > 1,
      maps,
    })
  }
  // Newest first: by latest map start time, then matchid.
  const lastStart = (s: SeriesSummary) => Math.max(...s.maps.map(m => Date.parse(m.startTime) || 0))
  return series.sort((a, b) => lastStart(b) - lastStart(a) || b.matchId - a.matchId)
}

/** GET /api/matches/:matchId/:mapNumber */
export function buildMapDetail(data: RawData, matchId: number, mapNumber: number, now = new Date()): MapDetailResponse | null {
  const ctx = buildContext(data, now)
  const raw = data.maps.find(m => m.matchid === matchId && m.mapnumber === mapNumber)
  if (!raw) return null
  const { summary, lines } = summarizeMap(ctx, raw)
  const sides = [summary.team1, summary.team2].map(side => ({
    name: side.name,
    score: side.score,
    won: summary.winner !== null && summary.winner === side.name,
    players: lines.filter(l => l.team === side.name).sort(byRatingDesc),
  }))
  const known = new Set(sides.map(s => s.name))
  // Winner on top; if no winner, keep team1 first unless team2 has more rounds.
  const teams = sides[1]!.won || (!sides[0]!.won && sides[1]!.score > sides[0]!.score) ? [sides[1]!, sides[0]!] : sides
  return {
    map: summary,
    teams,
    unassigned: lines.filter(l => !known.has(l.team)).sort(byRatingDesc),
  }
}

/** Distinct, readable-on-dark colors; teams beyond 12 wrap around. */
export const TEAM_PALETTE = [
  '#4ea1ff', '#ff8a3d', '#5fd17a', '#e05cd6', '#f2d24b', '#3fd6d0',
  '#ff5f6d', '#a78bfa', '#9ccc65', '#ffab91', '#80cbc4', '#c5a3ff',
] as const

/** team name → color, in order of first appearance (matchid asc, team1 before team2). */
export function assignTeamColors(data: RawData): Record<string, string> {
  const names: string[] = []
  const add = (n: string) => { if (n && !names.includes(n)) names.push(n) }
  for (const m of [...data.matches].sort((a, b) => a.matchid - b.matchid)) { add(m.team1_name); add(m.team2_name) }
  for (const p of [...data.players].sort(compareMapOrder)) add(p.team)
  return Object.fromEntries(names.map((n, i) => [n, TEAM_PALETTE[i % TEAM_PALETTE.length]!]))
}

/** GET /api/leaderboard – aggregated over finished maps only, from sums. */
export function buildLeaderboard(data: RawData): LeaderboardRow[] {
  const ctx = buildContext(data, new Date(0))
  interface Acc { totals: StatTotals, maps: number, wins: number, mvps: number, teams: string[] }
  const acc = new Map<string, Acc>()

  // Most recent first, so the first team seen is the latest one.
  for (const m of [...data.maps].sort((a, b) => compareMapOrder(b, a))) {
    if (mapStatus(ctx, m) !== 'finished') continue
    const winner = m.winner || null
    for (const line of linesForMap(ctx, m, 'finished')) {
      const a = acc.get(line.steamId) ?? { totals: emptyTotals(), maps: 0, wins: 0, mvps: 0, teams: [] }
      a.totals = addTotals(a.totals, line)
      a.maps += 1
      if (winner !== null && line.team === winner) a.wins += 1
      if (line.isMatchMvp) a.mvps += 1
      if (line.team && !a.teams.includes(line.team)) a.teams.push(line.team)
      acc.set(line.steamId, a)
    }
  }

  const rows: LeaderboardRow[] = []
  for (const [steamId, a] of acc) {
    const totals = a.totals
    rows.push({
      steamId,
      name: ctx.names.get(steamId) ?? steamId,
      team: a.teams[0] ?? '',
      teams: a.teams,
      maps: a.maps,
      wins: a.wins,
      winPct: a.maps > 0 ? round((a.wins / a.maps) * 100, 1) : 0,
      matchMvps: a.mvps,
      ...totals,
      ...derive(totals),
    })
  }
  return rows.sort((x, y) => hltvRating1(y) - hltvRating1(x) || y.adr - x.adr || x.name.localeCompare(y.name))
}
