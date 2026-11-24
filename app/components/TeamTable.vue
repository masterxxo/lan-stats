<script setup lang="ts">
import type { PlayerLine } from '~~/shared/types'

defineProps<{ name: string, score: number, won: boolean, decided: boolean, players: PlayerLine[] }>()
const { colorOf } = useTeamColors()
</script>

<template>
  <div class="team" :class="{ won, lost: decided && !won }">
    <div class="team-head">
      <span class="swatch" :style="{ background: colorOf(name) }" />
      <span class="team-name">{{ name }}</span>
      <span class="team-score num">{{ score }}</span>
      <span v-if="decided" class="result">{{ won ? 'WIN' : 'LOSS' }}</span>
    </div>
    <div class="table-scroll">
      <table class="stats">
        <thead>
          <tr>
            <th class="left player-cell">Player</th>
            <th title="Kills">K</th>
            <th title="Assists">A</th>
            <th title="Deaths">D</th>
            <th title="Kills − Deaths">+/-</th>
            <th>K/D</th>
            <th title="Average damage per round">ADR</th>
            <th title="Headshot kill %">HS%</th>
            <th class="left" title="Rounds with 2/3/4/5 kills">Multi-kills</th>
            <th title="1vX clutches won / attempted (MatchZy tracks 1v1 and 1v2)">Clutches</th>
            <th title="Opening duels won / attempted">Entry</th>
            <th title="Utility damage">UD</th>
            <th title="HLTV Rating 1.0">Rating</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="p in players" :key="p.steamId">
            <td class="player-cell">
              {{ p.name }}
              <span v-if="p.isMatchMvp" class="star" title="Match MVP (highest rating)">⭐</span>
            </td>
            <td>{{ p.kills }}</td>
            <td>{{ p.assists }}</td>
            <td>{{ p.deaths }}</td>
            <td :class="diffClass(p.diff)">{{ signed(p.diff) }}</td>
            <td>{{ fixed(p.kd, 2) }}</td>
            <td>{{ fixed(p.adr, 1) }}</td>
            <td>{{ fixed(p.hsPct, 0) }}%</td>
            <td class="left multi">{{ multiKills(p) || '–' }}</td>
            <td>{{ p.clutchWins }}/{{ p.clutchAttempts }}</td>
            <td>{{ p.entryWins }}/{{ p.entryAttempts }}</td>
            <td>{{ p.utilityDamage }}</td>
            <td class="rating" :class="ratingClass(p.rating)">{{ fixed(p.rating, 2) }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<style scoped>
.team {
  background: var(--bg-2);
  border: 1px solid var(--line);
  border-radius: 8px;
  overflow: hidden;
  border-left: 3px solid var(--line);
}
.team.won { border-left-color: var(--win); }
.team.lost { border-left-color: var(--loss); }
.team-head {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding: 0.55rem 0.75rem;
  background: var(--bg-3);
  font-weight: 700;
}
.swatch { width: 0.7rem; height: 0.7rem; border-radius: 2px; }
.team-name { font-size: 1.05rem; }
.team-score { margin-left: auto; font-size: 1.2rem; }
.result { font-size: 0.72rem; letter-spacing: 0.1em; padding: 0.1rem 0.45rem; border-radius: 4px; }
.won .result { color: var(--win); background: rgba(95, 209, 122, 0.12); }
.lost .result { color: var(--loss); background: rgba(229, 83, 75, 0.12); }
.lost .team-name, .lost .team-score { color: var(--muted); }
.multi { font-size: 0.82rem; color: var(--muted); }
.rating { font-weight: 700; }
</style>
