// One-off export: matchzy.db → data/stats.json (committed; the site never needs the DB).
// Usage: MATCHZY_DB_PATH=/path/to/matchzy.db node scripts/export-data.ts
// Keep the -wal and -shm files next to the DB: most results may still live in the WAL.
import { writeFileSync } from 'node:fs'
import { readMatchzy } from './lib/matchzy.ts'
import { assignTeamColors, buildLeaderboard, buildMapDetail, buildMatchList, mapKey } from './lib/stats.ts'

const data = readMatchzy()
if (data.maps.length === 0) throw new Error('No maps found – check MATCHZY_DB_PATH')

const details = Object.fromEntries(data.maps.map(m =>
  [mapKey(m.matchid, m.mapnumber), buildMapDetail(data, m.matchid, m.mapnumber)]))

// Publish neutral ids instead of SteamID64 (the UI only uses them as keys). Computed last, so
// tie-breaks and sorting match the original portal.
const ids = [...new Set(data.players.map(p => p.steamid64))].sort()
let json = JSON.stringify({
  series: buildMatchList(data),
  players: buildLeaderboard(data),
  details,
  teamColors: assignTeamColors(data),
}, null, 1)
ids.forEach((id, i) => { json = json.replaceAll(`"${id}"`, `"p${i + 1}"`) })
if (/7656119\d{10}/.test(json)) throw new Error('A SteamID64 leaked into the export')

writeFileSync(new URL('../data/stats.json', import.meta.url), json + '\n')
console.log(`Exported ${data.maps.length} maps, ${ids.length} players`)
