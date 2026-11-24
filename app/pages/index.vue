<script setup lang="ts">
import type { SeriesSummary } from '~~/shared/types'

useHead({ title: 'Matches · CS2 LAN Stats' })

const route = useRoute()
const router = useRouter()

// Prerendered HTML has no query string, so expand only after hydration.
const mounted = ref(false)
onMounted(() => { mounted.value = true })

/** Expanded map lives in the URL: /?match=<matchid>-<mapnumber> */
const expanded = computed(() => (mounted.value && typeof route.query.match === 'string' ? route.query.match : null))

function toggle(key: string) {
  const query = { ...route.query }
  if (expanded.value === key) delete query.match
  else query.match = key
  router.replace({ query })
}

const seriesHeader = (s: SeriesSummary) => {
  const w = s.winner
  return {
    t1: w ? (w === s.team1.name ? 'win' : 'loss') : '',
    t2: w ? (w === s.team2.name ? 'win' : 'loss') : '',
  }
}
</script>

<template>
  <div>
    <div class="list">
      <template v-for="s in stats.series" :key="s.matchId">
        <section v-if="s.isMultiMap" class="series">
          <header class="series-head">
            <span class="series-type">{{ s.seriesType }}</span>
            <span :class="seriesHeader(s).t1">{{ s.team1.name }}</span>
            <span class="num series-score">
              <span :class="seriesHeader(s).t1">{{ s.team1.score }}</span>
              <span class="dim"> : </span>
              <span :class="seriesHeader(s).t2">{{ s.team2.score }}</span>
            </span>
            <span :class="seriesHeader(s).t2">{{ s.team2.name }}</span>
            <span v-if="!s.winner" class="muted in-progress">in progress</span>
          </header>
          <div class="series-maps">
            <MapRow
              v-for="m in s.maps"
              :key="m.key"
              :map="m"
              :label="`Map ${m.mapNumber + 1}`"
              :expanded="expanded === m.key"
              @toggle="toggle(m.key)"
            />
          </div>
        </section>
        <MapRow
          v-else
          :map="s.maps[0]!"
          :expanded="expanded === s.maps[0]!.key"
          @toggle="toggle(s.maps[0]!.key)"
        />
      </template>
    </div>
  </div>
</template>

<style scoped>
.list { display: grid; gap: 0.6rem; }
.series {
  border: 1px solid var(--line);
  border-radius: 10px;
  background: rgba(27, 33, 44, 0.5);
  padding: 0.5rem;
}
.series-head {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.6rem;
  padding: 0.25rem 0.4rem 0.6rem;
  font-weight: 700;
}
.series-type {
  background: var(--accent);
  color: #111;
  font-size: 0.72rem;
  padding: 0.1rem 0.4rem;
  border-radius: 4px;
  letter-spacing: 0.06em;
}
.series-score { font-size: 1.15rem; }
.in-progress { font-weight: 500; font-size: 0.85rem; }
.win { color: var(--win); }
.loss { color: var(--muted); }
.series-maps { display: grid; gap: 0.45rem; }
</style>
