import type { LeaderboardRow, MapDetailResponse, SeriesSummary, TeamColors } from '~~/shared/types'
import raw from '~~/data/stats.json'

/** All stats, exported once from MatchZy by scripts/export-data.ts. */
export const stats = raw as unknown as {
  series: SeriesSummary[]
  players: LeaderboardRow[]
  details: Record<string, MapDetailResponse>
  teamColors: TeamColors
}
