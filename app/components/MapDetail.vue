<script setup lang="ts">
import type { MapSummary } from '~~/shared/types'

const props = defineProps<{ map: MapSummary }>()

const data = computed(() => stats.details[props.map.key])
const decided = computed(() => data.value?.map.winner != null)

const { demoBaseUrl } = useRuntimeConfig().public
const demo = computed(() => (demoBaseUrl ? demos[props.map.key] : undefined))
</script>

<template>
  <div class="detail">
    <template v-if="data">
      <p v-if="!data.map.hasStats" class="notice">
        <template v-if="data.map.status === 'live'">Stats available after the map ends.</template>
        <template v-else>No player stats were recorded for this map.</template>
      </p>
      <template v-else>
        <p v-if="data.map.status === 'live'" class="notice">Live – stats so far, the match MVP is picked when the map ends.</p>
        <TeamTable
          v-for="t in data.teams"
          :key="t.name"
          :name="t.name"
          :score="t.score"
          :won="t.won"
          :decided="decided"
          :players="t.players"
        />
        <TeamTable
          v-if="data.unassigned.length"
          name="Other players"
          :score="0"
          :won="false"
          :decided="false"
          :players="data.unassigned"
        />
      </template>
    </template>
    <a v-if="demo" class="demo" :href="`${demoBaseUrl}/${demo.file}`">
      ⬇ Download demo (.zip, {{ formatSize(demo.size) }})
    </a>
  </div>
</template>

<style scoped>
.detail {
  display: grid;
  gap: 0.75rem;
  padding: 0.75rem;
  background: var(--bg);
  border-top: 1px solid var(--line);
}
.notice {
  margin: 0;
  padding: 1rem;
  text-align: center;
  color: var(--muted);
  background: var(--bg-2);
  border-radius: 6px;
}
.demo {
  justify-self: end;
  padding: 0.45rem 0.8rem;
  border: 1px solid var(--line);
  border-radius: 6px;
  background: var(--bg-2);
  color: var(--text);
  font-size: 0.85rem;
  font-weight: 600;
  text-decoration: none;
}
.demo:hover { border-color: var(--accent); }
</style>
