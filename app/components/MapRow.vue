<script setup lang="ts">
import type { MapSummary } from '~~/shared/types'

const props = defineProps<{ map: MapSummary, expanded: boolean, label?: string }>()
defineEmits<{ toggle: [] }>()

const sideClass = (name: string) => {
  if (!props.map.winner) return ''
  return props.map.winner === name ? 'win' : 'loss'
}
</script>

<template>
  <div class="row-wrap" :class="{ expanded, live: map.status === 'live' }">
    <button
      class="row"
      type="button"
      :aria-expanded="expanded"
      :aria-controls="`map-${map.key}`"
      @click="$emit('toggle')"
    >
      <MapTile :map-name="map.mapName" />

      <div class="score">
        <span class="team t1" :class="sideClass(map.team1.name)">{{ map.team1.name }}</span>
        <span class="num s" :class="sideClass(map.team1.name)">{{ map.team1.score }}</span>
        <span class="colon">:</span>
        <span class="num s" :class="sideClass(map.team2.name)">{{ map.team2.score }}</span>
        <span class="team t2" :class="sideClass(map.team2.name)">{{ map.team2.name }}</span>
      </div>

      <div class="meta">
        <span v-if="label" class="map-label">{{ label }}</span>
        <ClientOnly>
          <span>{{ formatDate(map.startTime) }} · {{ formatTime(map.startTime) }}</span>
        </ClientOnly>
        <span v-if="map.durationSec !== null" class="dim">{{ formatDuration(map.durationSec) }}</span>
      </div>

      <div class="status">
        <span v-if="map.status === 'live'" class="badge live-badge"><span class="live-dot" /> Live</span>
        <span v-else-if="map.status === 'abandoned'" class="badge dim">Unfinished</span>
        <span v-else class="badge done">Finished</span>
        <span v-if="map.mvp" class="mvp" title="Match MVP"><span class="star">⭐</span> {{ map.mvp.name }}</span>
      </div>

      <span class="chev" aria-hidden="true">▾</span>
    </button>
    <div v-if="expanded" :id="`map-${map.key}`">
      <MapDetail :map="map" />
    </div>
  </div>
</template>

<style scoped>
.row-wrap {
  background: var(--bg-2);
  border: 1px solid var(--line);
  border-radius: 8px;
  overflow: hidden;
}
.row-wrap.live { border-color: rgba(255, 70, 85, 0.45); }
.row {
  all: unset;
  box-sizing: border-box;
  width: 100%;
  cursor: pointer;
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto auto auto;
  align-items: center;
  gap: 1.25rem;
  padding: 0.55rem 0.9rem 0.55rem 0.55rem;
}
.row:hover { background: var(--row-hover); }
.row:focus-visible { outline: 2px solid var(--accent); outline-offset: -2px; }

.score {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto auto auto minmax(0, 1fr);
  align-items: center;
  gap: 0.6rem;
  font-weight: 700;
}
.team { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 1.05rem; }
.t1 { text-align: right; }
.s { font-size: 1.6rem; min-width: 2ch; text-align: center; }
.colon { color: var(--dim); font-size: 1.3rem; }
.win { color: var(--win); }
.loss { color: var(--muted); opacity: 0.75; }
.s.loss { color: var(--loss); opacity: 1; }

.meta {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  font-size: 0.82rem;
  color: var(--muted);
  gap: 0.1rem;
  min-width: 8.5rem;
}
.map-label { color: var(--accent); font-weight: 700; font-size: 0.72rem; letter-spacing: 0.08em; text-transform: uppercase; }

.status { display: flex; flex-direction: column; align-items: flex-end; gap: 0.25rem; min-width: 7.5rem; }
.done { color: var(--muted); }
.live-badge { color: var(--live); }
.mvp { font-size: 0.8rem; color: var(--muted); white-space: nowrap; }

.chev { color: var(--dim); transition: transform 0.15s; }
.expanded .chev { transform: rotate(180deg); }

@media (max-width: 760px) {
  .row {
    grid-template-columns: auto minmax(0, 1fr) auto;
    gap: 0.6rem;
  }
  .meta { grid-column: 2; grid-row: 2; flex-direction: row; gap: 0.5rem; align-items: center; min-width: 0; }
  .status { grid-column: 3; grid-row: 2; flex-direction: row; min-width: 0; }
  .mvp { display: none; }
  .chev { grid-column: 3; grid-row: 1; }
  .team { font-size: 0.9rem; }
  .s { font-size: 1.25rem; }
}
</style>
