export interface Config {
  phoneNumber: string
  password: string
  deviceFingerprint: string
  serverId: string
  targetQualities: string[]
  intervalSeconds: number
  friends: FriendInfo[]
  accessToken: string
  // 抢招策略配置
  snipeConfig: SnipeConfig
}

export interface SnipeConfig {
  // 提前量(ms)：在保护期结束前多少毫秒发起请求（补偿网络延迟）
  advanceMs: number
  // 最大重试次数
  maxRetries: number
  // 重试间隔(ms)
  retryIntervalMs: number
  // 预查询时间：保护期结束前多少秒重新查询一次获取最新数据
  preQuerySeconds: number
  // 是否启用自动抢招
  autoSnipe: boolean
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

export interface HeroCandidate {
  name: string
  quality: string
  star: number
  available: boolean
}

export interface FriendTavernStatus {
  friend: FriendInfo
  status: 'pending' | 'scanning' | 'done' | 'error' | 'watching' | 'sniping' | 'sniped'
  candidates: TavernCandidate[]
  lastScan: string
  // 抢招相关
  protectionEndsAt?: string       // 保护期结束时间(服务器时间)
  snipeState?: SnipeState         // 抢招状态
}

export interface TavernCandidate {
  candidateId: string
  name: string
  quality: string
  star: number
  version: number
  available: boolean
  copperCost: number
  unavailableReason?: string
}

export interface SnipeState {
  phase: 'idle' | 'watching' | 'preparing' | 'ready' | 'firing' | 'success' | 'failed' | 'protected'
  targetHero?: string
  countdown?: number              // 倒计时(秒)
  serverOffset?: number           // 服务器时间偏移量(ms)
  attempts?: number               // 已尝试次数
  lastResult?: string             // 最近一次结果
  firedAt?: string                // 发起时间
}

export interface LogEntry {
  id: number
  timestamp: string
  message: string
  type: 'info' | 'success' | 'error' | 'warning'
}
