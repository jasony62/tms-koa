export type TmsDir = {
  name: string
  path: string
  publicUrl?: string
  birthtime?: number
  sub?: { files: number; dirs: number }
}

export type TmsFile = {
  name: string
  size: number
  birthtime?: number
  mtime: number
  path: string
  publicUrl?: string
}
