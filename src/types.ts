export interface Config {
  phoneNumber: string
  password: string
  deviceFingerprint: string
  serverId: string
  targetQualities: string[]
  intervalSeconds: number
  friends: FriendInfo[]
  accessToken: string
}

export interface FriendInfo {
  playerId: string
  shortId: string
  displayName: string
  level: number
  avatarKey?: string
}

export interface PlayerSearchResult {
  playerId: string
  shortId: string
  displayName: string
  avatarKey: string
  level: number
  commercialTier: number
}

export interface LogEntry {
  id: number
  timestamp: string
  message: string
  type: 'info' | 'success' | 'error' | 'warning'
}

export interface HeroCandidate {
  name: string
  quality: string
  star: number
  available: boolean
}

export interface FriendTavernStatus {
  friend: FriendInfo
  status: 'pending' | 'scanning' | 'done' | 'error'
  candidates: HeroCandidate[]
  lastScan: string
}
