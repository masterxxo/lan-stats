<script setup lang="ts">
const route = useRoute()
// GitHub Pages redirects /leaderboard to /leaderboard/
const path = computed(() => route.path.replace(/\/+$/, '') || '/')
const tabs = [
  { to: '/', label: 'Matches' },
  { to: '/leaderboard', label: 'Leaderboard' },
]
</script>

<template>
  <div>
    <header class="topbar">
      <div class="container topbar-inner">
        <div class="brand">
          <span class="logo">CS2</span>
          <span>LAN Stats</span>
        </div>
        <nav class="tabs">
          <NuxtLink
            v-for="t in tabs"
            :key="t.to"
            :to="t.to"
            class="tab"
            :class="{ active: path === t.to }"
          >
            {{ t.label }}
          </NuxtLink>
        </nav>
      </div>
    </header>
    <main class="container">
      <NuxtPage />
    </main>
  </div>
</template>

<style scoped>
.topbar {
  position: sticky;
  top: 0;
  z-index: 10;
  background: rgba(13, 16, 21, 0.88);
  backdrop-filter: blur(8px);
  border-bottom: 1px solid var(--line);
  margin-bottom: 1.25rem;
}
.topbar-inner {
  display: flex;
  align-items: center;
  gap: 2rem;
  padding-bottom: 0;
  height: 3.4rem;
}
.brand {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  font-weight: 700;
  letter-spacing: 0.02em;
}
.logo {
  background: var(--accent);
  color: #111;
  padding: 0.1rem 0.4rem;
  border-radius: 4px;
  font-size: 0.85rem;
  font-weight: 800;
}
.tabs { display: flex; height: 100%; }
.tab {
  display: flex;
  align-items: center;
  padding: 0 1.1rem;
  text-decoration: none;
  color: var(--muted);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  font-size: 0.85rem;
  border-bottom: 2px solid transparent;
}
.tab:hover { color: var(--text); }
.tab.active {
  color: var(--text);
  border-bottom-color: var(--accent);
}
@media (max-width: 520px) {
  .topbar-inner { gap: 0.75rem; }
  .brand span:last-child { display: none; }
  .tab { padding: 0 0.7rem; }
}
</style>
