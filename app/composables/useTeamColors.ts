export function useTeamColors() {
  const colorOf = (name: string) => stats.teamColors[name] ?? teamColor(name)
  return { colorOf }
}
