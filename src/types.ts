export interface Config {
  phoneNumber: string
  password: string
  deviceFingerprint: string
  serverId: string
  targetQualities: string[]
  intervalSeconds: number
  friendIds: string[]
  accessToken: string
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
  friendId: string
  status: 'pending' | 'scanning' | 'done' | 'error'
  candidates: HeroCandidate[]
  lastScan: string
}
