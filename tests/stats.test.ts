import { describe, expect, it } from 'vitest'
import {
  assignTeamColors,
  buildLeaderboard,
  buildMapDetail,
  buildMatchList,
  derive,
  hltvRating1,
  pickMvp,
  sumTotals,
  toIso,
  totalsFromRaw,
  type RawData,
  type RawMap,
  type RawMatch,
  type RawPlayer,
} from '../scripts/lib/stats'

// --- fixtures -------------------------------------------------------------------------
const match = (o: Partial<RawMatch> & Pick<RawMatch, 'matchid'>): RawMatch => ({
  start_time: '2026-11-21 10:00:00', end_time: '2026-11-21 11:00:00', winner: 'A', series_type: 'BO1',
  team1_name: 'A', team1_score: 1, team2_name: 'B', team2_score: 0, ...o,
})
const map = (o: Partial<RawMap> & Pick<RawMap, 'matchid'>): RawMap => ({
  mapnumber: 0, start_time: '2026-11-21 10:00:00', end_time: '2026-11-21 10:40:00', winner: 'A',
  mapname: 'de_mirage', team1_score: 13, team2_score: 7, ...o,
})
const player = (o: Partial<RawPlayer> & Pick<RawPlayer, 'matchid' | 'steamid64' | 'team'>): RawPlayer => ({
  mapnumber: 0, name: `p${o.steamid64}`, kills: 0, deaths: 0, assists: 0, damage: 0,
  enemy5ks: 0, enemy4ks: 0, enemy3ks: 0, enemy2ks: 0, utility_damage: 0,
  v1_count: 0, v1_wins: 0, v2_count: 0, v2_wins: 0, entry_count: 0, entry_wins: 0, head_shot_kills: 0, ...o,
})

// --- basic stats ----------------------------------------------------------------------
describe('derived stats', () => {
  it('ADR = damage / rounds, where rounds = team1_score + team2_score', () => {
    const t = totalsFromRaw(player({ matchid: 1, steamid64: '1', team: 'A', damage: 1850 }), 13 + 7)
    expect(t.rounds).toBe(20)
    expect(derive(t).adr).toBe(92.5)
  })

  it('ADR is 0 when no rounds were played', () => {
    expect(derive(totalsFromRaw(player({ matchid: 1, steamid64: '1', team: 'A', damage: 50 }), 0)).adr).toBe(0)
  })

  it('K/D uses max(D, 1) so zero deaths does not divide by zero', () => {
    const t = totalsFromRaw(player({ matchid: 1, steamid64: '1', team: 'A', kills: 7, deaths: 0 }), 10)
    expect(derive(t).kd).toBe(7)
    expect(derive(t).diff).toBe(7)
  })

  it('K/D is rounded to 2 decimals', () => {
    const t = totalsFromRaw(player({ matchid: 1, steamid64: '1', team: 'A', kills: 10, deaths: 3 }), 10)
    expect(derive(t).kd).toBe(3.33)
  })

  it('HS% = head_shot_kills / kills × 100, 0 with no kills', () => {
    expect(derive(totalsFromRaw(player({ matchid: 1, steamid64: '1', team: 'A', kills: 8, head_shot_kills: 3 }), 10)).hsPct).toBe(37.5)
    expect(derive(totalsFromRaw(player({ matchid: 1, steamid64: '1', team: 'A', kills: 0 }), 10)).hsPct).toBe(0)
  })

  it('clutches sum v1 and v2 (the only clutch columns MatchZy has)', () => {
    const t = totalsFromRaw(player({ matchid: 1, steamid64: '1', team: 'A', v1_count: 3, v1_wins: 2, v2_count: 2, v2_wins: 1 }), 10)
    expect(t.clutchWins).toBe(3)
    expect(t.clutchAttempts).toBe(5)
  })
})

describe('HLTV Rating 1.0', () => {
  // Hand calculation: K=20, D=15, R=24, 2K=3, 3K=1
  //   1K = 20 − 6 − 3 = 11
  //   kill     = 20/24/0.679           = 1.227295
  //   survival = (24−15)/24/0.317      = 1.182965
  //   multi    = (11 + 12 + 9)/24/1.277 = 1.044114
  //   rating   = (1.227295 + 0.7·1.182965 + 1.044114) / 2.7 = 1.147957
  const t = { rounds: 24, kills: 20, deaths: 15, k2: 3, k3: 1, k4: 0, k5: 0 }

  it('matches a hand-calculated example', () => {
    expect(hltvRating1(t)).toBeCloseTo(1.147957, 5)
  })

  it('is rounded to 2 decimals in derived stats', () => {
    const totals = { ...sumTotals([]), ...t }
    expect(derive(totals).rating).toBe(1.15)
  })

  it('is 0 with no rounds', () => {
    expect(hltvRating1({ ...t, rounds: 0 })).toBe(0)
  })
})

// --- aggregation ----------------------------------------------------------------------
describe('aggregation from sums', () => {
  // Player 1: map A – 30 kills / 2000 dmg in 30 rounds; map B – 2 kills / 100 dmg in 10 rounds.
  const data: RawData = {
    matches: [match({ matchid: 1 }), match({ matchid: 2 })],
    maps: [
      map({ matchid: 1, team1_score: 16, team2_score: 14 }),
      map({ matchid: 2, team1_score: 5, team2_score: 5, winner: 'B', start_time: '2026-11-21 12:00:00', end_time: '2026-11-21 12:30:00' }),
    ],
    players: [
      player({ matchid: 1, steamid64: '1', team: 'A', kills: 30, deaths: 20, damage: 2000, head_shot_kills: 15 }),
      player({ matchid: 2, steamid64: '1', team: 'A', kills: 2, deaths: 8, damage: 100, head_shot_kills: 0 }),
    ],
  }

  it('ADR / HS% / K/D / Rating come from totals, not from averaging per-map values', () => {
    const [row] = buildLeaderboard(data)
    expect(row!.rounds).toBe(40)
    expect(row!.kills).toBe(32)
    expect(row!.adr).toBe(52.5) // 2100/40 – average of per-map ADRs would be (66.7+10)/2 = 38.3
    expect(row!.hsPct).toBe(46.9) // 15/32 – average of HS% would be 25
    expect(row!.kd).toBe(1.14) // 32/28
    expect(row!.rating).toBe(derive(row!).rating)
    expect(row!.rating).toBe(Math.round(hltvRating1({ rounds: 40, kills: 32, deaths: 28, k2: 0, k3: 0, k4: 0, k5: 0 }) * 100) / 100)
  })

  it('counts maps, wins and win%', () => {
    const [row] = buildLeaderboard(data)
    expect(row!.maps).toBe(2)
    expect(row!.wins).toBe(1)
    expect(row!.winPct).toBe(50)
  })

  it('ignores live maps', () => {
    const live: RawData = {
      ...data,
      matches: [...data.matches, match({ matchid: 3, end_time: null, winner: '' })],
      maps: [...data.maps, map({ matchid: 3, end_time: null, winner: '', start_time: '2026-11-21 13:00:00' })],
      players: [...data.players, player({ matchid: 3, steamid64: '1', team: 'A', kills: 50 })],
    }
    expect(buildLeaderboard(live)[0]!.kills).toBe(32)
  })
})

describe('match MVP', () => {
  it('is the highest rating on the map', () => {
    const lines = [
      { ...sumTotals([]), steamId: 'a', rounds: 20, kills: 10, deaths: 10, damage: 1500 },
      { ...sumTotals([]), steamId: 'b', rounds: 20, kills: 25, deaths: 10, damage: 1500 },
    ]
    expect(pickMvp(lines)!.steamId).toBe('b')
  })

  it('breaks a rating tie by ADR', () => {
    // Identical K/D/multi-kills → identical rating; b has more damage.
    const base = { ...sumTotals([]), rounds: 20, kills: 15, deaths: 12 }
    const lines = [
      { ...base, steamId: 'a', damage: 1600 },
      { ...base, steamId: 'b', damage: 1900 },
      { ...base, steamId: 'c', damage: 1700 },
    ]
    expect(hltvRating1(lines[0]!)).toBe(hltvRating1(lines[1]!))
    expect(pickMvp(lines)!.steamId).toBe('b')
  })

  it('is flagged in map detail and counted in the leaderboard', () => {
    const data: RawData = {
      matches: [match({ matchid: 1 })],
      maps: [map({ matchid: 1 })],
      players: [
        player({ matchid: 1, steamid64: '1', team: 'A', kills: 10, deaths: 10, damage: 1000 }),
        player({ matchid: 1, steamid64: '2', team: 'B', kills: 10, deaths: 10, damage: 1200 }),
      ],
    }
    const detail = buildMapDetail(data, 1, 0)!
    const all = detail.teams.flatMap(t => t.players)
    expect(all.filter(p => p.isMatchMvp).map(p => p.steamId)).toEqual(['2'])
    expect(detail.map.mvp?.steamId).toBe('2')
    expect(buildLeaderboard(data).find(r => r.steamId === '2')!.matchMvps).toBe(1)
  })
})

describe('match MVP on an empty map', () => {
  it('is not awarded when nobody got a kill (test map ended in warmup)', () => {
    const data: RawData = {
      matches: [match({ matchid: 1 })],
      maps: [map({ matchid: 1, team1_score: 1, team2_score: 0, winner: '' })],
      players: [player({ matchid: 1, steamid64: '1', team: 'A' }), player({ matchid: 1, steamid64: '2', team: 'B' })],
    }
    expect(buildMapDetail(data, 1, 0)!.map.mvp).toBeNull()
    expect(buildLeaderboard(data).every(r => r.matchMvps === 0)).toBe(true)
  })
})

describe('player on two teams', () => {
  const data: RawData = {
    matches: [
      match({ matchid: 1, team1_name: 'Bravo', team2_name: 'Alpha', winner: 'Bravo' }),
      match({ matchid: 2, team1_name: 'Delta', team2_name: 'Charlie', winner: 'Charlie' }),
    ],
    maps: [
      map({ matchid: 1, winner: 'Bravo' }),
      map({ matchid: 2, winner: 'Charlie', start_time: '2026-11-21 12:00:00', end_time: '2026-11-21 12:40:00' }),
    ],
    players: [
      player({ matchid: 1, steamid64: '76561198000000204', team: 'Bravo', name: 'oldNick', kills: 20 }),
      player({ matchid: 2, steamid64: '76561198000000204', team: 'Delta', name: 'newNick', kills: 5 }),
    ],
  }

  it('is one leaderboard row, keyed by steamid64, with the latest team and nickname', () => {
    const rows = buildLeaderboard(data)
    expect(rows).toHaveLength(1)
    expect(rows[0]!.steamId).toBe('76561198000000204')
    expect(rows[0]!.name).toBe('newNick')
    expect(rows[0]!.team).toBe('Delta')
    expect(rows[0]!.teams).toEqual(['Delta', 'Bravo'])
    expect(rows[0]!.kills).toBe(25)
    expect(rows[0]!.wins).toBe(1) // won with Bravo, lost with Delta
  })

  it('appears under the right team in each map, using the latest nickname', () => {
    const d1 = buildMapDetail(data, 1, 0)!
    expect(d1.teams[0]!.name).toBe('Bravo')
    expect(d1.teams[0]!.players[0]!.name).toBe('newNick')
    const d2 = buildMapDetail(data, 2, 0)!
    expect(d2.teams.find(t => t.name === 'Delta')!.players).toHaveLength(1)
  })
})

describe('match list', () => {
  const data: RawData = {
    matches: [
      match({ matchid: 1 }),
      match({ matchid: 2, series_type: 'BO3', team1_score: 2, team2_score: 1, end_time: '2026-11-21 15:00:00' }),
      match({ matchid: 3, end_time: null, winner: '', team1_score: 0, team2_score: 0 }),
    ],
    maps: [
      map({ matchid: 1 }),
      map({ matchid: 2, mapnumber: 0, start_time: '2026-11-21 12:00:00', end_time: '2026-11-21 12:40:00' }),
      map({ matchid: 2, mapnumber: 1, start_time: '2026-11-21 13:00:00', end_time: '2026-11-21 13:40:00', winner: 'B' }),
      map({ matchid: 2, mapnumber: 2, start_time: '2026-11-21 14:00:00', end_time: '2026-11-21 14:50:00' }),
      map({ matchid: 3, start_time: '2026-11-21 16:00:00', end_time: null, winner: '', team1_score: 4, team2_score: 2 }),
    ],
    players: [],
  }

  it('is newest first, groups BO3 maps under one series', () => {
    const list = buildMatchList(data, new Date('2026-11-21T16:10:00Z'))
    expect(list.map(s => s.matchId)).toEqual([3, 2, 1])
    expect(list[1]!.isMultiMap).toBe(true)
    expect(list[1]!.maps.map(m => m.mapNumber)).toEqual([0, 1, 2])
    expect(list[2]!.isMultiMap).toBe(false)
  })

  it('marks the newest unfinished map as live, with elapsed time and live score', () => {
    const live = buildMatchList(data, new Date('2026-11-21T16:10:00Z'))[0]!.maps[0]!
    expect(live.status).toBe('live')
    expect(live.winner).toBeNull()
    expect(live.durationSec).toBe(600)
    expect(live.team1.score).toBe(4)
    expect(live.hasStats).toBe(false)
  })

  it('marks an older unfinished map as abandoned, not live', () => {
    const d: RawData = { ...data, matches: [...data.matches, match({ matchid: 4 })], maps: [...data.maps, map({ matchid: 4, start_time: '2026-11-21 17:00:00' })] }
    const m3 = buildMatchList(d).find(s => s.matchId === 3)!.maps[0]!
    expect(m3.status).toBe('abandoned')
  })

  it('treats MatchZy timestamps as UTC', () => {
    expect(toIso('2026-11-21 16:00:00')).toBe('2026-11-21T16:00:00.000Z')
    const m = buildMatchList(data)[2]!.maps[0]!
    expect(m.durationSec).toBe(40 * 60)
  })
})

describe('team colors', () => {
  it('are assigned in order of first appearance and stay stable when new teams appear', () => {
    const before: RawData = { matches: [match({ matchid: 1, team1_name: 'Zeta', team2_name: 'Alpha' })], maps: [], players: [] }
    const after: RawData = { ...before, matches: [...before.matches, match({ matchid: 2, team1_name: 'Beta', team2_name: 'Zeta' })] }
    const c1 = assignTeamColors(before)
    const c2 = assignTeamColors(after)
    expect(c2.Zeta).toBe(c1.Zeta)
    expect(c2.Alpha).toBe(c1.Alpha)
    expect(new Set(Object.values(c2)).size).toBe(3)
  })
})
