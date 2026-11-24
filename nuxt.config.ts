const base = process.env.NUXT_APP_BASE_URL || '/'

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2026-11-01',
  devtools: { enabled: false },
  telemetry: false,
  css: ['@fontsource-variable/inter', '@fontsource-variable/jetbrains-mono', '~/assets/css/main.css'],
  typescript: { strict: true, typeCheck: false },
  app: {
    head: {
      htmlAttrs: { lang: 'en' },
      title: 'CS2 LAN Stats',
      meta: [
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        { name: 'color-scheme', content: 'dark' },
      ],
      link: [{ rel: 'icon', type: 'image/svg+xml', href: `${base}favicon.svg` }],
    },
  },
  runtimeConfig: {
    // NUXT_PUBLIC_DEMO_BASE_URL; empty = demo links hidden
    public: { demoBaseUrl: '' },
  },
  nitro: {
    preset: 'github-pages',
    prerender: { routes: ['/', '/leaderboard'] },
  },
})
