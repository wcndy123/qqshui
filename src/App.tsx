import { useState, useCallback, useRef, useEffect } from 'react'
import ConfigPanel from './components/ConfigPanel'
import LogPanel from './components/LogPanel'
import StatusPanel from './components/StatusPanel'
import FlowDiagram from './components/FlowDiagram'
import ScriptViewer from './components/ScriptViewer'
import FriendInspector from './components/FriendInspector'
import SnipePanel from './components/SnipePanel'
import type { Config, LogEntry, FriendTavernStatus, TavernCandidate, SnipeState, FriendInfo } from './types'

const DEFAULT_CONFIG: Config = {
  phoneNumber: '',
  password: '',
  deviceFingerprint: '',
  serverId: 'recharge-s1',
  targetQualities: ['PURPLE', 'ORANGE'],
  intervalSeconds: 60,
  friends: [],
  accessToken: '',
  snipeConfig: {
    advanceMs: 50,
    maxRetries: 3,
    retryIntervalMs: 200,
    preQuerySeconds: 5,
    autoSnipe: true,
  },
}

// 模拟数据
const HERO_POOL = [
  { heroCode: 'HERO_RUAN_XIAO_QI', name: '阮小七', troopType: 'BOW' },
  { heroCode: 'HERO_SEAT_100', name: '孙新', troopType: 'SPEAR' },
  { heroCode: 'HERO_LI_KUI', name: '李逵', troopType: 'SWORD' },
  { heroCode: 'HERO_WU_SONG', name: '武松', troopType: 'SWORD' },
  { heroCode: 'HERO_LIN_CHONG', name: '林冲', troopType: 'SPEAR' },
  { heroCode: 'HERO_LU_ZHI_SHEN', name: '鲁智深', troopType: 'SWORD' },
  { heroCode: 'HERO_SONG_JIANG', name: '宋江', troopType: 'BOW' },
  { heroCode: 'HERO_WU_YONG', name: '吴用', troopType: 'BOW' },
  { heroCode: 'HERO_GONGSUN_SHENG', name: '公孙胜', troopType: 'BOW' },
  { heroCode: 'HERO_GUAN_SHENG', name: '关胜', troopType: 'SWORD' },
]

const QUALITIES = ['WHITE', 'BLUE', 'PURPLE', 'ORANGE']

function randomHero(): TavernCandidate {
  const hero = HERO_POOL[Math.floor(Math.random() * HERO_POOL.length)]
  const quality = QUALITIES[Math.floor(Math.random() * QUALITIES.length)]
  const available = Math.random() > 0.4
  return {
    candidateId: crypto.randomUUID(),
    name: hero.name,
    quality,
    star: Math.floor(Math.random() * 5) + 1,
    version: Math.floor(Math.random() * 3),
    available,
    copperCost: quality === 'ORANGE' ? 10000 : quality === 'PURPLE' ? 6000 : quality === 'BLUE' ? 2000 : 500,
    unavailableReason: !available ? 'CANDIDATE_PROTECTED' : undefined,
  }
}

export default function App() {
  const [config, setConfig] = useState<Config>(DEFAULT_CONFIG)
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [isRunning, setIsRunning] = useState(false)
  const [currentStep, setCurrentStep] = useState<string>('idle')
  const [tavernStatuses, setTavernStatuses] = useState<FriendTavernStatus[]>([])
  const [stats, setStats] = useState({ totalScanned: 0, totalRecruited: 0, totalSkipped: 0, totalSnipeAttempts: 0 })
  const [activeTab, setActiveTab] = useState<'dashboard' | 'config' | 'script' | 'flow'>('dashboard')
  const [serverOffset, setServerOffset] = useState(0)
  const intervalRef = useRef<number | null>(null)
  const logEndRef = useRef<HTMLDivElement>(null!)
  const isRunningRef = useRef(false)

  // 保持 isRunningRef 同步
  useEffect(() => {
    isRunningRef.current = isRunning
  }, [isRunning])

  const addLog = useCallback((message: string, type: LogEntry['type'] = 'info') => {
    const now = new Date()
    const timestamp = now.toLocaleTimeString('zh-CN', { hour12: false }) + '.' + String(now.getMilliseconds()).padStart(3, '0')
    setLogs(prev => [...prev.slice(-500), {
      id: Date.now() + Math.random(),
      timestamp,
      message,
      type,
    }])
  }, [])

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [logs])

  const sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms))

  // 模拟API请求延迟
  const simulateRequest = async (label: string, minMs = 30, maxMs = 80) => {
    const delay = minMs + Math.random() * (maxMs - minMs)
    await sleep(delay)
    return delay
  }

  // 模拟时间校准
  const calibrateTime = useCallback(async () => {
    addLog('[HTTP] GET /api/v1/tavern (时间校准)', 'info')
    const latency = await simulateRequest('校准')
    const offset = (Math.random() * 40 - 20) // 模拟±20ms偏差
    setServerOffset(offset)
    const serverTime = new Date(Date.now() + offset).toISOString()
    addLog(`[RESP] 200 OK (${latency.toFixed(0)}ms) serverTime=${serverTime}`, 'info')
    addLog(`[CALC] 本地时间偏移量: ${offset >= 0 ? '+' : ''}${offset.toFixed(1)}ms`, 'info')
    return offset
  }, [addLog])

  // 模拟搜索玩家（短ID/昵称 → UUID）
  const simulatePlayerSearch = async (query: string): Promise<FriendInfo | null> => {
    const isNumeric = /^\d+$/.test(query.trim())
    const searchTypes = isNumeric ? ['SHORT_ID', 'NAME'] : ['NAME']

    for (const searchType of searchTypes) {
      addLog(`[HTTP] GET /api/v1/player-search?type=${searchType}&query=${encodeURIComponent(query)}&limit=20`, 'info')
      const latency = await simulateRequest('搜索')

      // 模拟搜索结果
      const found = Math.random() > 0.1 // 90%概率找到
      if (found) {
        const playerId = crypto.randomUUID()
        const displayName = isNumeric ? `玩家${query}` : query
        const shortId = isNumeric ? query : String(Math.floor(Math.random() * 900000) + 100000)
        const level = Math.floor(Math.random() * 50) + 1

        addLog(`[RESP] 200 OK (${latency.toFixed(0)}ms)`, 'info')
        addLog(`[DATA] 匹配到玩家: displayName="${displayName}" shortId="${shortId}" level=${level}`, 'success')
        addLog(`[DATA] 内部UUID: ${playerId}`, 'info')

        return { playerId, shortId, displayName, level }
      } else {
        addLog(`[RESP] 200 OK (${latency.toFixed(0)}ms) players=[] (无匹配)`, 'warning')
      }
    }
    return null
  }

  // 模拟巡查酒馆
  const simulateTavernInspect = async (friend: FriendInfo): Promise<{
    candidates: TavernCandidate[]
    protectionEndsAt: string
    serverTime: string
  } | null> => {
    const url = `/api/v1/friend-cities/${friend.playerId}/tavern`
    addLog(`[HTTP] GET ${url}`, 'info')
    const latency = await simulateRequest('巡查')

    // 模拟返回
    const numHeroes = Math.floor(Math.random() * 3) + 1
    const candidates = Array.from({ length: numHeroes }, () => randomHero())
    const now = Date.now() + serverOffset
    const protectionDuration = Math.floor(Math.random() * 30 * 60 * 1000) // 0-30分钟
    const protectionEndsAt = new Date(now + protectionDuration).toISOString()
    const serverTime = new Date(now).toISOString()

    addLog(`[RESP] 200 OK (${latency.toFixed(0)}ms)`, 'info')
    addLog(`[DATA] serverTime=${serverTime}`, 'info')
    addLog(`[DATA] protectionEndsAt=${protectionEndsAt}`, 'info')
    addLog(`[DATA] 候选武将数量: ${candidates.length}`, 'info')

    // 更新服务器时间偏移
    const newOffset = now - Date.now()
    setServerOffset(newOffset)

    return { candidates, protectionEndsAt, serverTime }
  }

  // 模拟招募请求
  const simulateRecruit = async (friend: FriendInfo, candidate: TavernCandidate): Promise<{
    success: boolean
    code: string
    message: string
  }> => {
    const url = `/api/v1/friend-cities/${friend.playerId}/tavern/recruitments`
    const payload = {
      operationId: crypto.randomUUID(),
      candidateId: candidate.candidateId,
      expectedCandidateVersion: candidate.version,
    }
    addLog(`[HTTP] POST ${url}`, 'warning')
    addLog(`[BODY] ${JSON.stringify(payload)}`, 'info')

    const latency = await simulateRequest('招募', 20, 60)

    // 模拟结果
    const rand = Math.random()
    let code: string
    let message: string
    let success: boolean

    if (rand > 0.4) {
      code = 'OK'
      message = 'success'
      success = true
    } else if (rand > 0.2) {
      code = 'CANDIDATE_PROTECTED'
      message = '候选武将仍在保护期内'
      success = false
    } else if (rand > 0.1) {
      code = 'CANDIDATE_NOT_AVAILABLE'
      message = '候选武将已被他人招募'
      success = false
    } else {
      code = 'HERO_CAPACITY_FULL'
      message = '武将背包已满'
      success = false
    }

    addLog(`[RESP] ${success ? '200' : '400'} ${code} (${latency.toFixed(0)}ms) ${message}`, success ? 'success' : 'error')
    return { success, code, message }
  }

  // 主巡查循环
  const patrolLoop = useCallback(async () => {
    if (!isRunningRef.current) return

    addLog('', 'info')
    addLog('═══════════════════════════════════════════════', 'info')
    addLog('  水浒Q传 · 好友酒馆自动巡查招募系统', 'success')
    addLog('═══════════════════════════════════════════════', 'info')
    addLog(`[CONFIG] 目标品质: ${config.targetQualities.join(', ')}`, 'info')
    addLog(`[CONFIG] 巡查间隔: ${config.intervalSeconds}秒`, 'info')
    addLog(`[CONFIG] 抢招模式: ${config.snipeConfig.autoSnipe ? '开启' : '关闭'}`, 'info')
    addLog(`[CONFIG] 提前量: ${config.snipeConfig.advanceMs}ms | 重试: ${config.snipeConfig.maxRetries}次`, 'info')
    addLog(`[CONFIG] 待巡查好友: ${config.friends.length}人`, 'info')
    addLog('', 'info')

    // ===== 阶段0: 解析好友ID =====
    setCurrentStep('login')
    addLog('━━━━━━━━━━ 阶段0: 好友ID解析 ━━━━━━━━━━', 'info')
    addLog('[TASK] 将用户输入的短ID/昵称解析为内部UUID...', 'info')
    addLog('', 'info')

    const resolvedFriends: FriendInfo[] = []

    for (let i = 0; i < config.friends.length; i++) {
      if (!isRunningRef.current) return
      const inputFriend = config.friends[i]
      addLog(`[${i + 1}/${config.friends.length}] 解析好友: "${inputFriend.displayName}" (#${inputFriend.shortId})`, 'info')

      // 如果已经有playerId（从搜索添加的），直接使用
      if (inputFriend.playerId && inputFriend.playerId.length > 20) {
        addLog(`[SKIP] 已有内部UUID: ${inputFriend.playerId}`, 'info')
        addLog(`[OK] 解析完成 → UUID: ${inputFriend.playerId.substring(0, 8)}...`, 'success')
        resolvedFriends.push(inputFriend)
      } else {
        // 需要调用搜索API解析
        const query = inputFriend.shortId !== 'N/A' ? inputFriend.shortId : inputFriend.displayName
        addLog(`[TASK] 调用 player-search 解析 "${query}"...`, 'info')
        const resolved = await simulatePlayerSearch(query)

        if (resolved) {
          addLog(`[OK] 解析成功: ${resolved.displayName} → ${resolved.playerId.substring(0, 8)}...`, 'success')
          resolvedFriends.push(resolved)
        } else {
          addLog(`[FAIL] 无法解析 "${query}"，跳过此好友`, 'error')
        }
      }
      addLog('', 'info')
      await sleep(200)
    }

    if (resolvedFriends.length === 0) {
      addLog('[ERROR] 没有成功解析任何好友，请检查配置', 'error')
      setCurrentStep('idle')
      return
    }

    addLog(`[RESULT] 成功解析 ${resolvedFriends.length}/${config.friends.length} 个好友`, 'success')
    addLog('', 'info')

    // ===== 阶段1: 时间校准 =====
    addLog('━━━━━━━━━━ 阶段1: 服务器时间校准 ━━━━━━━━━━', 'info')
    await calibrateTime()
    addLog('', 'info')

    // ===== 阶段2: 巡查酒馆 =====
    addLog('━━━━━━━━━━ 阶段2: 巡查好友酒馆 ━━━━━━━━━━', 'info')
    setCurrentStep('patrol')

    interface SnipeTarget {
      friend: FriendInfo
      candidate: TavernCandidate
      protectionEndsAt: string
    }
    const snipeTargets: SnipeTarget[] = []

    for (let i = 0; i < resolvedFriends.length; i++) {
      if (!isRunningRef.current) return
      const friend = resolvedFriends[i]
      addLog('', 'info')
      addLog(`────────── [${i + 1}/${resolvedFriends.length}] 巡查【${friend.displayName}】#${friend.shortId} ──────────`, 'info')
      addLog(`[INFO] 内部UUID: ${friend.playerId}`, 'info')

      // 更新状态
      setTavernStatuses(prev => {
        const existing = prev.find(s => s.friend.playerId === friend.playerId)
        if (existing) {
          return prev.map(s => s.friend.playerId === friend.playerId
            ? { ...s, status: 'scanning' as const, lastScan: new Date().toLocaleTimeString('zh-CN') }
            : s)
        }
        return [...prev, { friend, status: 'scanning' as const, candidates: [], lastScan: new Date().toLocaleTimeString('zh-CN') }]
      })

      // 请求酒馆数据
      const result = await simulateTavernInspect(friend)
      if (!result) {
        addLog('[FAIL] 巡查失败，跳过', 'error')
        continue
      }

      const { candidates, protectionEndsAt } = result
      const now = Date.now() + serverOffset
      const protectEnd = new Date(protectionEndsAt).getTime()
      const isProtected = protectEnd > now
      const remainSec = Math.max(0, (protectEnd - now) / 1000)

      // 更新状态
      setTavernStatuses(prev => prev.map(s =>
        s.friend.playerId === friend.playerId
          ? { ...s, status: 'done' as const, candidates, protectionEndsAt, lastScan: new Date().toLocaleTimeString('zh-CN') }
          : s
      ))
      setStats(prev => ({ ...prev, totalScanned: prev.totalScanned + 1 }))

      // 展示所有候选武将
      addLog('[DATA] 候选武将列表:', 'info')
      candidates.forEach((c, idx) => {
        const qEmoji = c.quality === 'ORANGE' ? '🟠' : c.quality === 'PURPLE' ? '🟣' : c.quality === 'BLUE' ? '🔵' : '⬜'
        const status = c.available ? '可招募' : `被保护(${c.unavailableReason})`
        const isTarget = config.targetQualities.includes(c.quality)
        addLog(`  [${idx}] ${qEmoji} ${c.name} | ${c.quality} ${c.star}星 | v${c.version} | ${c.copperCost}铜 | ${status}${isTarget ? ' ← 目标!' : ''}`, isTarget ? 'warning' : 'info')
      })

      // 筛选目标品质武将
      const targetCandidates = candidates.filter(c => config.targetQualities.includes(c.quality))

      if (targetCandidates.length === 0) {
        addLog('[DECISION] 无目标品质武将 → 跳过', 'info')
        setStats(prev => ({ ...prev, totalSkipped: prev.totalSkipped + 1 }))
      } else if (isProtected) {
        addLog(`[DECISION] 发现 ${targetCandidates.length} 个目标品质武将，但保护期内`, 'warning')
        addLog(`[DATA] protectionEndsAt=${protectionEndsAt}`, 'info')
        addLog(`[DATA] 保护期剩余: ${remainSec.toFixed(1)}秒 (${Math.floor(remainSec / 60)}分${Math.floor(remainSec % 60)}秒)`, 'warning')

        if (config.snipeConfig.autoSnipe) {
          // 选择最高品质目标
          const qualityOrder: Record<string, number> = { ORANGE: 2, PURPLE: 1 }
          const best = targetCandidates.sort((a, b) =>
            (qualityOrder[b.quality] || 0) - (qualityOrder[a.quality] || 0)
          )[0]
          addLog(`[DECISION] 加入抢招队列: ${best.name} (${best.quality} ${best.star}星)`, 'warning')
          addLog(`[PLAN] 将在保护期结束前${config.snipeConfig.preQuerySeconds}秒预查询，提前${config.snipeConfig.advanceMs}ms发射`, 'info')
          snipeTargets.push({ friend, candidate: best, protectionEndsAt })
        } else {
          addLog('[DECISION] 抢招模式关闭 → 跳过', 'info')
        }
      } else {
        addLog('[DECISION] 保护期已过，尝试直接招募', 'success')
        const available = targetCandidates.find(c => c.available)
        if (available) {
          addLog(`[TARGET] 选择目标: ${available.name} (${available.quality} ${available.star}星 v${available.version})`, 'success')
          const recruitResult = await simulateRecruit(friend, available)
          if (recruitResult.success) {
            addLog(`[RESULT] ✅ 成功偷取【${available.name}】！`, 'success')
            setStats(prev => ({ ...prev, totalRecruited: prev.totalRecruited + 1 }))
          } else {
            addLog(`[RESULT] ❌ 招募失败: ${recruitResult.message}`, 'error')
          }
        } else {
          addLog('[DECISION] 目标武将不可用(被保护) → 跳过', 'info')
          setStats(prev => ({ ...prev, totalSkipped: prev.totalSkipped + 1 }))
        }
      }

      await sleep(500) // 好友间间隔
    }

    // ===== 阶段3: 抢招 =====
    if (snipeTargets.length > 0 && config.snipeConfig.autoSnipe) {
      addLog('', 'info')
      addLog('━━━━━━━━━━ 阶段3: 精确抢招 ━━━━━━━━━━', 'warning')
      setCurrentStep('sniping')
      addLog(`[TASK] 共 ${snipeTargets.length} 个目标进入抢招队列`, 'warning')

      // 按保护期结束时间排序
      snipeTargets.sort((a, b) =>
        new Date(a.protectionEndsAt).getTime() - new Date(b.protectionEndsAt).getTime()
      )

      for (const target of snipeTargets) {
        if (!isRunningRef.current) return
        await executeSnipe(target.friend, target.candidate, target.protectionEndsAt)
        await sleep(1000)
      }
    }

    // 本轮结束
    addLog('', 'info')
    addLog('═══════════════════════════════════════════════', 'info')
    addLog(`[DONE] 本轮巡查结束`, 'success')
    addLog(`[STATS] 巡查:${stats.totalScanned + resolvedFriends.length} 招募:${stats.totalRecruited} 跳过:${stats.totalSkipped} 抢招尝试:${stats.totalSnipeAttempts}`, 'info')
    addLog(`[NEXT] ${config.intervalSeconds}秒后开始下一轮...`, 'info')
    addLog('═══════════════════════════════════════════════', 'info')
    setCurrentStep('waiting')
  }, [config, serverOffset, addLog, calibrateTime, stats])

  // 抢招执行
  const executeSnipe = async (friend: FriendInfo, candidate: TavernCandidate, protectionEndsAt: string) => {
    const { advanceMs, maxRetries, retryIntervalMs, preQuerySeconds } = config.snipeConfig
    const protectEnd = new Date(protectionEndsAt).getTime()
    const now = Date.now() + serverOffset
    const remainingMs = protectEnd - now
    const remainingSec = remainingMs / 1000

    addLog('', 'info')
    addLog(`────────── 抢招:【${candidate.name}】${candidate.quality} ${candidate.star}星 ──────────`, 'warning')
    addLog(`[INFO] 目标好友: ${friend.displayName} (${friend.playerId.substring(0, 8)}...)`, 'info')
    addLog(`[INFO] protectionEndsAt: ${protectionEndsAt}`, 'info')
    addLog(`[INFO] 保护期剩余: ${remainingSec.toFixed(1)}秒`, 'info')
    addLog(`[INFO] 服务器偏移: ${serverOffset.toFixed(1)}ms`, 'info')

    // 更新状态
    const snipeState: SnipeState = {
      phase: 'watching',
      targetHero: candidate.name,
      countdown: Math.ceil(remainingSec),
      serverOffset,
      attempts: 0,
    }
    setTavernStatuses(prev => prev.map(s =>
      s.friend.playerId === friend.playerId
        ? { ...s, status: 'watching' as const, snipeState }
        : s
    ))

    // 阶段A: 等待到预查询时间
    const preQueryWaitMs = remainingMs - (preQuerySeconds * 1000)
    if (preQueryWaitMs > 1000) {
      addLog(`[WAIT] 等待 ${preQuerySeconds}秒 后预查询...`, 'info')
      // 模拟等待（实际应该精确等待，这里缩短演示时间）
      await sleep(Math.min(preQueryWaitMs, 2000))
    }

    if (!isRunningRef.current) return

    // 阶段B: 预查询
    addLog(`[TASK] 预查询获取最新 candidateId + version...`, 'info')
    setTavernStatuses(prev => prev.map(s =>
      s.friend.playerId === friend.playerId
        ? { ...s, snipeState: { ...snipeState, phase: 'preparing' } }
        : s
    ))

    const preQueryResult = await simulateTavernInspect(friend)
    if (!preQueryResult) {
      addLog('[FAIL] 预查询失败，放弃抢招', 'error')
      return
    }

    // 找到目标武将最新数据
    let latestCandidate = preQueryResult.candidates.find(c => c.name === candidate.name)
    if (!latestCandidate) {
      latestCandidate = preQueryResult.candidates.find(c => config.targetQualities.includes(c.quality))
    }
    if (!latestCandidate) {
      addLog('[FAIL] 预查询未找到目标武将（可能已被主人招募）', 'error')
      setTavernStatuses(prev => prev.map(s =>
        s.friend.playerId === friend.playerId
          ? { ...s, snipeState: { ...snipeState, phase: 'failed', lastResult: '预查询未找到目标' } }
          : s
      ))
      return
    }

    addLog(`[DATA] 最新 candidateId: ${latestCandidate.candidateId.substring(0, 8)}...`, 'info')
    addLog(`[DATA] 最新 version: ${latestCandidate.version}`, 'info')

    // 阶段C: 等待到发射时间
    const fireTimeMs = protectEnd - advanceMs
    const currentMs = Date.now() + serverOffset
    const waitUntilFireMs = fireTimeMs - currentMs

    setTavernStatuses(prev => prev.map(s =>
      s.friend.playerId === friend.playerId
        ? { ...s, snipeState: { ...snipeState, phase: 'ready', countdown: Math.ceil(waitUntilFireMs / 1000) } }
        : s
    ))

    if (waitUntilFireMs > 0) {
      addLog(`[WAIT] 距离发射: ${(waitUntilFireMs / 1000).toFixed(3)}秒 (提前${advanceMs}ms补偿网络延迟)`, 'warning')
      await sleep(Math.min(waitUntilFireMs, 1500))
    }

    if (!isRunningRef.current) return

    // 阶段D: 发射！
    addLog(`[FIRE] ⚡⚡⚡ 发射抢招请求！⚡⚡⚡`, 'warning')

    let attempt = 0
    let success = false

    while (attempt < maxRetries && !success && isRunningRef.current) {
      attempt++
      setStats(prev => ({ ...prev, totalSnipeAttempts: prev.totalSnipeAttempts + 1 }))

      setTavernStatuses(prev => prev.map(s =>
        s.friend.playerId === friend.playerId
          ? { ...s, status: 'sniping' as const, snipeState: { ...snipeState, phase: 'firing', attempts: attempt } }
          : s
      ))

      const result = await simulateRecruit(friend, latestCandidate!)

      if (result.success) {
        success = true
        addLog(`[RESULT] ✅✅✅ 抢招成功！第${attempt}次尝试 ✅✅✅`, 'success')
        setStats(prev => ({ ...prev, totalRecruited: prev.totalRecruited + 1 }))
        setTavernStatuses(prev => prev.map(s =>
          s.friend.playerId === friend.playerId
            ? { ...s, status: 'sniped' as const, snipeState: { ...snipeState, phase: 'success', attempts: attempt, lastResult: `第${attempt}次成功!` } }
            : s
        ))
      } else if (result.code === 'CANDIDATE_PROTECTED') {
        addLog(`[RETRY] 仍在保护期内，${retryIntervalMs}ms后重试...`, 'warning')
        if (attempt < maxRetries) await sleep(retryIntervalMs)
      } else if (result.code === 'CANDIDATE_NOT_AVAILABLE') {
        addLog(`[FAIL] 已被他人抢先！停止重试`, 'error')
        break
      } else if (result.code === 'HERO_CAPACITY_FULL') {
        addLog(`[FAIL] 武将背包已满！`, 'error')
        break
      } else {
        addLog(`[RETRY] 失败(${result.message})，${retryIntervalMs}ms后重试...`, 'warning')
        if (attempt < maxRetries) await sleep(retryIntervalMs)
      }
    }

    if (!success) {
      addLog(`[FAIL] 抢招失败，共尝试${attempt}次`, 'error')
      setTavernStatuses(prev => prev.map(s =>
        s.friend.playerId === friend.playerId
          ? { ...s, status: 'done' as const, snipeState: { ...snipeState, phase: 'failed', attempts: attempt, lastResult: `失败(${attempt}次)` } }
          : s
      ))
    }
  }

  const handleStart = () => {
    setIsRunning(true)
    isRunningRef.current = true
    addLog('🚀 系统启动！', 'success')
    patrolLoop()
  }

  const handleStop = () => {
    setIsRunning(false)
    isRunningRef.current = false
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
    setCurrentStep('idle')
    addLog('⏹ 用户手动停止', 'warning')
  }

  const handleClearLogs = () => {
    setLogs([])
    setStats({ totalScanned: 0, totalRecruited: 0, totalSkipped: 0, totalSnipeAttempts: 0 })
    setTavernStatuses([])
  }

  const tabs = [
    { id: 'dashboard' as const, label: '📊 控制台', icon: 'fa-gauge-high' },
    { id: 'config' as const, label: '⚙️ 配置', icon: 'fa-gear' },
    { id: 'flow' as const, label: '🔄 流程图', icon: 'fa-diagram-project' },
    { id: 'script' as const, label: '📜 脚本', icon: 'fa-code' },
  ]

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-950 to-slate-900 text-white">
      {/* Header */}
      <header className="border-b border-white/10 bg-black/20 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-amber-500 to-red-600 flex items-center justify-center text-xl font-bold shadow-lg shadow-amber-500/30">
              水
            </div>
            <div>
              <h1 className="text-lg font-bold bg-gradient-to-r from-amber-300 to-orange-400 bg-clip-text text-transparent">
                好友酒馆自动巡查招募系统
              </h1>
              <p className="text-xs text-slate-400">水浒Q传 · 保护期倒计时 + 毫秒级抢招</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-1.5 text-xs text-slate-400 bg-white/5 px-2 py-1 rounded">
              <i className="fa-solid fa-clock text-amber-400" />
              偏移: <span className="text-amber-300 font-mono">{serverOffset.toFixed(0)}ms</span>
            </div>
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${isRunning ? 'bg-green-400 animate-pulse' : 'bg-slate-500'}`} />
              <span className="text-sm text-slate-300">
                {isRunning ? '运行中' : '已停止'}
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Navigation Tabs */}
      <nav className="border-b border-white/10 bg-black/10">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex gap-1">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-2.5 text-sm font-medium rounded-t-lg transition-all ${
                  activeTab === tab.id
                    ? 'bg-white/10 text-amber-300 border-b-2 border-amber-400'
                    : 'text-slate-400 hover:text-white hover:bg-white/5'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-6">
        {activeTab === 'dashboard' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Column */}
            <div className="lg:col-span-1 space-y-4">
              {/* Control Panel */}
              <div className="bg-white/5 rounded-xl border border-white/10 p-4 backdrop-blur-sm">
                <h2 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
                  <i className="fa-solid fa-play text-green-400" />
                  控制面板
                </h2>
                <div className="flex gap-2">
                  <button
                    onClick={isRunning ? handleStop : handleStart}
                    disabled={!config.accessToken && !isRunning}
                    className={`flex-1 py-2.5 px-4 rounded-lg font-medium text-sm transition-all ${
                      isRunning
                        ? 'bg-red-500/20 text-red-300 border border-red-500/30 hover:bg-red-500/30'
                        : 'bg-green-500/20 text-green-300 border border-green-500/30 hover:bg-green-500/30 disabled:opacity-40 disabled:cursor-not-allowed'
                    }`}
                  >
                    {isRunning ? '⏹ 停止' : '▶ 启动巡查'}
                  </button>
                  <button
                    onClick={handleClearLogs}
                    className="py-2.5 px-3 rounded-lg text-sm bg-slate-500/20 text-slate-300 border border-slate-500/30 hover:bg-slate-500/30 transition-all"
                    title="清空日志"
                  >
                    🗑
                  </button>
                </div>
                {!config.accessToken && (
                  <p className="mt-2 text-xs text-amber-400/80">
                    ⚠️ 请先在配置面板填入 AccessToken
                  </p>
                )}
              </div>

              {/* Stats */}
              <StatusPanel stats={stats} currentStep={currentStep} />

              {/* Snipe Panel */}
              <SnipePanel statuses={tavernStatuses} />

              {/* Friend Tavern Statuses */}
              <FriendInspector statuses={tavernStatuses} />
            </div>

            {/* Right Column - Logs */}
            <div className="lg:col-span-2">
              <LogPanel logs={logs} logEndRef={logEndRef} />
            </div>
          </div>
        )}

        {activeTab === 'config' && (
          <ConfigPanel config={config} setConfig={setConfig} />
        )}

        {activeTab === 'flow' && (
          <FlowDiagram />
        )}

        {activeTab === 'script' && (
          <ScriptViewer />
        )}
      </main>
    </div>
  )
}
