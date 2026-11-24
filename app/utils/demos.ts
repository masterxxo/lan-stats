import raw from '~~/data/demos.json'

/** Map key ("11-0") → demo archive, hosted as a GitHub Release asset. */
export const demos = raw as Record<string, { file: string, size: number } | undefined>

export const formatSize = (bytes: number) => `${Math.round(bytes / 1e6)} MB`
