<script setup lang="ts">
import type { LeaderboardRow } from '~~/shared/types'

useHead({ title: 'Leaderboard · CS2 LAN Stats' })

const { colorOf } = useTeamColors()

interface Col {
  key: string
  label: string
  title?: string
  value: (r: LeaderboardRow) => number
  format: (r: LeaderboardRow) => string
  /** Lower is better (deaths). */
  lowerIsBetter?: boolean
  /** Not a performance stat – don't highlight the leader. */
  noLead?: boolean
  cls?: (r: LeaderboardRow) => string
}

const n = (f: (r: LeaderboardRow) => number) => (r: LeaderboardRow) => String(f(r))

const columns: Col[] = [
  { key: 'maps', label: 'Maps', value: r => r.maps, format: n(r => r.maps), noLead: true },
  { key: 'wins', label: 'Wins', value: r => r.wins, format: n(r => r.wins) },
  { key: 'winPct', label: 'Win%', value: r => r.winPct, format: r => `${r.winPct.toFixed(0)}%` },
  { key: 'kills', label: 'K', title: 'Kills', value: r => r.kills, format: n(r => r.kills) },
  { key: 'deaths', label: 'D', title: 'Deaths', value: r => r.deaths, format: n(r => r.deaths), lowerIsBetter: true },
  { key: 'assists', label: 'A', title: 'Assists', value: r => r.assists, format: n(r => r.assists) },
  { key: 'diff', label: '+/-', title: 'Kills − Deaths', value: r => r.diff, format: r => signed(r.diff), cls: r => diffClass(r.diff) },
  { key: 'kd', label: 'K/D', value: r => r.kd, format: r => r.kd.toFixed(2) },
  { key: 'adr', label: 'ADR', title: 'Total damage / total rounds', value: r => r.adr, format: r => r.adr.toFixed(1) },
  { key: 'hsPct', label: 'HS%', value: r => r.hsPct, format: r => `${r.hsPct.toFixed(0)}%` },
  { key: 'matchMvps', label: 'MVPs', title: 'Times map MVP (highest rating on the map)', value: r => r.matchMvps, format: n(r => r.matchMvps) },
  { key: 'k2', label: '2K', value: r => r.k2, format: n(r => r.k2) },
  { key: 'k3', label: '3K', value: r => r.k3, format: n(r => r.k3) },
  { key: 'k4', label: '4K', value: r => r.k4, format: n(r => r.k4) },
  { key: 'k5', label: '5K', value: r => r.k5, format: n(r => r.k5) },
  { key: 'clutch', label: 'Clutches', title: '1vX won / attempted (1v1 + 1v2)', value: r => r.clutchWins, format: r => `${r.clutchWins}/${r.clutchAttempts}` },
  { key: 'entry', label: 'Entry', title: 'Opening duels won / attempted', value: r => r.entryWins, format: r => `${r.entryWins}/${r.entryAttempts}` },
  { key: 'ud', label: 'UD', title: 'Utility damage', value: r => r.utilityDamage, format: n(r => r.utilityDamage) },
  { key: 'rating', label: 'Rating', title: 'HLTV Rating 1.0, computed from totals', value: r => r.rating, format: r => r.rating.toFixed(2), cls: r => `rating ${ratingClass(r.rating)}` },
]

const sortKey = ref('rating')
const sortDesc = ref(true)

function sortBy(key: string) {
  if (sortKey.value === key) sortDesc.value = !sortDesc.value
  else {
    sortKey.value = key
    sortDesc.value = !columns.find(c => c.key === key)?.lowerIsBetter
  }
}

const rows = computed(() => {
  const list = [...(stats.players)]
  if (sortKey.value === 'name') {
    list.sort((a, b) => a.name.localeCompare(b.name) * (sortDesc.value ? -1 : 1))
  } else if (sortKey.value === 'team') {
    list.sort((a, b) => a.team.localeCompare(b.team) * (sortDesc.value ? -1 : 1) || b.rating - a.rating)
  } else {
    const col = columns.find(c => c.key === sortKey.value)!
    // Ties keep the server order (rating desc).
    list.sort((a, b) => (col.value(b) - col.value(a)) * (sortDesc.value ? 1 : -1))
  }
  return list
})

/** Best value per column (highlighted). No highlight if everyone is at 0 or there's only one player. */
const leaders = computed(() => {
  const players = stats.players
  const out: Record<string, number | null> = {}
  for (const c of columns) {
    if (players.length < 2 || c.noLead) { out[c.key] = null; continue }
    const vals = players.map(c.value)
    const best = c.lowerIsBetter ? Math.min(...vals) : Math.max(...vals)
    out[c.key] = vals.every(v => v === best) ? null : best
  }
  return out
})
const isLeader = (c: Col, r: LeaderboardRow) => leaders.value[c.key] !== null && c.value(r) === leaders.value[c.key]

const arrow = (key: string) => (sortKey.value === key ? (sortDesc.value ? '▾' : '▴') : '')
</script>

<template>
  <div>


    <div class="board">
      <div class="table-scroll">
        <table class="stats">
          <thead>
            <tr>
              <th>#</th>
              <th class="left player-cell sortable" @click="sortBy('name')">Player {{ arrow('name') }}</th>
              <th class="left sortable" @click="sortBy('team')">Team {{ arrow('team') }}</th>
              <th
                v-for="c in columns"
                :key="c.key"
                class="sortable"
                :class="{ sorted: sortKey === c.key }"
                :title="c.title"
                @click="sortBy(c.key)"
              >
                {{ c.label }} {{ arrow(c.key) }}
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(r, i) in rows" :key="r.steamId">
              <td class="rank">{{ i + 1 }}</td>
              <td class="player-cell">{{ r.name }}</td>
              <td class="left">
                <span
                  class="badge"
                  :style="{ color: colorOf(r.team) }"
                  :title="r.teams.length > 1 ? `Played for: ${r.teams.join(', ')}` : undefined"
                >
                  {{ r.team }}<span v-if="r.teams.length > 1" class="more">+{{ r.teams.length - 1 }}</span>
                </span>
              </td>
              <td
                v-for="c in columns"
                :key="c.key"
                :class="[c.cls?.(r), { lead: isLeader(c, r) }]"
              >
                {{ c.format(r) }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <p class="foot muted">
        Finished maps only. ADR, HS%, K/D and Rating are computed from totals (not averaged per map).
        Highlighted cell = column leader.
      </p>
    </div>
  </div>
</template>

<style scoped>
.board {
  background: var(--bg-2);
  border: 1px solid var(--line);
  border-radius: 8px;
  overflow: hidden;
}
.sortable { cursor: pointer; user-select: none; }
.sortable:hover { color: var(--text); }
.sorted { color: var(--accent); }
.rank { color: var(--dim); }
.lead { background: var(--lead); box-shadow: inset 0 -2px 0 var(--accent); }
.rating { font-weight: 700; }
.more { opacity: 0.8; font-size: 0.7rem; }
.foot { font-size: 0.78rem; padding: 0.6rem 0.75rem; margin: 0; }
</style>
