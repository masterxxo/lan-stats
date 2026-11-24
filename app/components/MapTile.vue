<script setup lang="ts">
import { MAP_IMAGES } from '~/utils/map-images.generated'

const props = defineProps<{ mapName: string, small?: boolean }>()
const { baseURL } = useRuntimeConfig().app
const label = computed(() => mapLabel(props.mapName))

/** Local screenshot (public/maps/<map>.webp) if we have one, otherwise the gradient tile. */
const image = computed(() => {
  const base = (props.mapName.split('/').at(-1) ?? props.mapName).toLowerCase()
  return MAP_IMAGES.has(base) ? `${baseURL}maps/${base}.webp` : null
})
const background = computed(() =>
  image.value
    ? `linear-gradient(to top, rgba(0, 0, 0, 0.75) 0%, rgba(0, 0, 0, 0.1) 55%), url(${image.value}) center / cover no-repeat`
    : mapGradient(props.mapName),
)
</script>

<template>
  <div class="tile" :class="{ small, photo: image }" :style="{ background }" :title="mapName">
    <span>{{ label }}</span>
  </div>
</template>

<style scoped>
.tile {
  position: relative;
  width: 8.5rem;
  height: 4.8rem;
  border-radius: 6px;
  display: flex;
  align-items: flex-end;
  padding: 0.35rem 0.55rem;
  overflow: hidden;
  flex-shrink: 0;
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.08);
}
.tile:not(.photo)::after {
  /* subtle diagonal texture on gradient tiles */
  content: '';
  position: absolute;
  inset: 0;
  background: repeating-linear-gradient(-45deg, rgba(255, 255, 255, 0.04) 0 2px, transparent 2px 9px);
}
.tile span {
  position: relative;
  z-index: 1;
  font-weight: 800;
  font-size: 1rem;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.8);
}
.tile.small { width: 6.5rem; height: 3.65rem; }
.tile.small span { font-size: 0.82rem; }
@media (max-width: 640px) {
  .tile { width: 5.8rem; height: 3.3rem; }
  .tile span { font-size: 0.78rem; }
}
</style>
