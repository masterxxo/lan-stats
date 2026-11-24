// Read-only access to MatchZy's SQLite database. Raw SQL only – we don't own this schema.
//
// Safety rules:
//  * the DB is opened with readOnly + PRAGMA query_only = ON, so nothing can ever be written;
//  * busy timeout 3000 ms, because the plugin writes during a match;
//  * a fresh connection per request (the DB is tiny), so we never hold locks or stale snapshots.
//
// WAL caveat: matchzy.db runs in WAL mode. A read-only connection needs the -wal/-shm files to
// exist, because it can't create them (we have no write access to the plugin directory). They
// exist while the CS2 server is running. After a clean shutdown SQLite deletes them; then we fall
// back to `immutable=1`, which is safe only because no writer is active (and there's no WAL
// content to miss). The next request opens a fresh connection and goes back to normal mode as
// soon as the server creates the -wal file again.
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { DatabaseSync } from 'node:sqlite'
import type { RawData, RawMap, RawMatch, RawPlayer } from './stats'

const BUSY_TIMEOUT_MS = 3000

/** Optional: hide matches with a lower matchid (e.g. test games played before the LAN). */
export function minMatchId(): number {
  const v = Number(process.env.MATCHZY_MIN_MATCH_ID ?? 0)
  return Number.isInteger(v) && v > 0 ? v : 0
}

export function dbPath(): string {
  const fromEnv = process.env.MATCHZY_DB_PATH
  if (fromEnv) return resolve(fromEnv)
  if (import.meta.dev || process.env.NODE_ENV === 'test') return resolve('dev/matchzy.fake.db')
  throw new Error('MATCHZY_DB_PATH is not set')
}

function open(path: string, immutable: boolean): DatabaseSync {
  const location = immutable ? `${pathToFileURL(path).href}?mode=ro&immutable=1` : path
  const db = new DatabaseSync(location, { readOnly: true, timeout: BUSY_TIMEOUT_MS })
  try {
    db.exec('PRAGMA query_only = ON')
    // Forces the schema/WAL to be read now, so a WAL problem surfaces here and not mid-query.
    db.prepare('SELECT count(*) FROM sqlite_master').get()
  } catch (e) {
    db.close()
    throw e
  }
  return db
}

function openReadOnly(path: string): DatabaseSync {
  try {
    return open(path, false)
  } catch (e) {
    // WAL DB with no -wal/-shm and no permission to create them → server is stopped.
    if (!existsSync(`${path}-wal`)) return open(path, true)
    throw e
  }
}

let warned = false

/** Reads all MatchZy stats tables. Returns empty data if the DB or its tables don't exist yet. */
export function readMatchzy(): RawData {
  const empty: RawData = { matches: [], maps: [], players: [] }
  const path = dbPath()
  if (!existsSync(path)) {
    if (!warned) console.warn(`[matchzy] database not found at ${path} – showing empty state`)
    warned = true
    return empty
  }
  warned = false

  const db = openReadOnly(path)
  try {
    const tables = new Set(
      (db.prepare(`SELECT name FROM sqlite_master WHERE type = 'table' AND name LIKE 'matchzy_stats_%'`).all() as Array<{ name: string }>)
        .map(r => r.name),
    )
    if (!tables.has('matchzy_stats_maps') || !tables.has('matchzy_stats_matches')) return empty

    const min = minMatchId()
    // One read transaction → a consistent snapshot across the three tables.
    db.exec('BEGIN')
    try {
      const matches = db.prepare(`
        SELECT matchid, start_time, end_time, winner, series_type,
               team1_name, team1_score, team2_name, team2_score
        FROM matchzy_stats_matches WHERE matchid >= ?`).all(min) as unknown as RawMatch[]
      const maps = db.prepare(`
        SELECT matchid, mapnumber, start_time, end_time, winner, mapname, team1_score, team2_score
        FROM matchzy_stats_maps WHERE matchid >= ?`).all(min) as unknown as RawMap[]
      const players = tables.has('matchzy_stats_players')
        ? db.prepare(`
            SELECT matchid, mapnumber, CAST(steamid64 AS TEXT) AS steamid64, team, name,
                   kills, deaths, assists, damage,
                   enemy5ks, enemy4ks, enemy3ks, enemy2ks,
                   utility_damage, v1_count, v1_wins, v2_count, v2_wins,
                   entry_count, entry_wins, head_shot_kills
            FROM matchzy_stats_players WHERE matchid >= ?`).all(min) as unknown as RawPlayer[]
        : []
      return { matches, maps, players }
    } finally {
      db.exec('COMMIT')
    }
  } finally {
    db.close()
  }
}
