// Types shared between the Nitro API (server/) and the Vue frontend (app/).

/** "finished" = map has end_time; "live" = in progress; "abandoned" = no end_time but a newer match exists (server crash / restart). */
export type MapStatus = 'finished' | 'live' | 'abandoned'

/** Counting stats summed over one or more maps. All values are raw sums. */
export interface StatTotals {
  rounds: number
  kills: number
  deaths: number
  assists: number
  damage: number
  headshotKills: number
  k2: number
  k3: number
  k4: number
  k5: number
  clutchWins: number
  clutchAttempts: number
  entryWins: number
  entryAttempts: number
  utilityDamage: number
}

/** Derived stats computed from StatTotals. */
export interface DerivedStats {
  /** K − D */
  diff: number
  /** K / max(D, 1), rounded to 2 decimals */
  kd: number
  /** damage / rounds, 1 decimal */
  adr: number
  /** headshot kills / kills × 100, 1 decimal (0 when no kills) */
  hsPct: number
  /** Simplified HLTV Rating 1.0, 2 decimals */
  rating: number
}

export interface PlayerLine extends StatTotals, DerivedStats {
  steamId: string
  /** Nickname from the player's most recent map. */
  name: string
  team: string
  isMatchMvp: boolean
}

export interface TeamSide {
  name: string
  score: number
}

export interface MapSummary {
  /** `${matchId}-${mapNumber}` – used in the URL (?match=) */
  key: string
  matchId: number
  /** 0-based, as stored by MatchZy */
  mapNumber: number
  mapName: string
  team1: TeamSide
  team2: TeamSide
  /** Winning team name, or null (live / cancelled / no winner recorded) */
  winner: string | null
  status: MapStatus
  /** ISO 8601 UTC */
  startTime: string
  /** ISO 8601 UTC, null while live */
  endTime: string | null
  /** Map duration (or elapsed time while live), seconds */
  durationSec: number | null
  /** True when player rows exist for this map */
  hasStats: boolean
  mvp: { steamId: string, name: string } | null
}

export interface SeriesSummary {
  matchId: number
  /** e.g. "BO1", "BO3" */
  seriesType: string
  team1: TeamSide
  team2: TeamSide
  winner: string | null
  /** Show a series header (BO3 etc.) instead of a lone map row. */
  isMultiMap: boolean
  /** Ordered by mapNumber ascending */
  maps: MapSummary[]
}

/** team name → CSS color. Assigned in order of first appearance, so colors never change mid-event. */
export type TeamColors = Record<string, string>

export interface MatchesResponse {
  /** Newest first */
  series: SeriesSummary[]
  teamColors: TeamColors
  generatedAt: string
}

export interface MapDetailResponse {
  map: MapSummary
  /** Two team tables; winner first. Sorted by rating desc. */
  teams: Array<{ name: string, score: number, won: boolean, players: PlayerLine[] }>
  /** Players whose team field matched neither team name (rare). */
  unassigned: PlayerLine[]
}

export interface LeaderboardRow extends StatTotals, DerivedStats {
  steamId: string
  name: string
  /** Team from the player's most recent map */
  team: string
  /** All teams this player has played for (most recent first) */
  teams: string[]
  maps: number
  wins: number
  /** 1 decimal */
  winPct: number
  matchMvps: number
}

export interface LeaderboardResponse {
  players: LeaderboardRow[]
  teamColors: TeamColors
  generatedAt: string
}
