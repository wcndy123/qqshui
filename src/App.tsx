import { useState, useCallback, useRef, useEffect } from 'react'
import ConfigPanel from './components/ConfigPanel'
import LogPanel from './components/LogPanel'
import StatusPanel from './components/StatusPanel'
import FlowDiagram from './components/FlowDiagram'
import ScriptViewer from './components/ScriptViewer'
import FriendInspector from './components/FriendInspector'
import SnipePanel from './components/SnipePanel'
import type { Config, LogEntry, FriendTavernStatus, TavernCandidate, SnipeState, FriendInfo, PlayerSearchResult } from './types'

const BASE_URL = 'https://service.qjsh.top'

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

export default function App() {
  const [config, setConfig] = useState<Config>(DEFAULT_CONFIG)
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [isRunning, setIsRunning] = useState(false)
  const [currentStep, setCurrentStep] = useState<string>('idle')
  const [tavernStatuses, setTavernStatuses] = useState<FriendTavernStatus[]>([])
  const [stats, setStats] = useState({ totalScanned: 0, totalRecruited: 0, totalSkipped: 0, totalSnipeAttempts: 0 })
  const [activeTab, setActiveTab] = useState<'dashboard' | 'config' | 'script' | 'flow'>('dashboard')
  const [serverOffset, setServerOffset] = useState(0)
  const logEndRef = useRef<HTMLDivElement>(null!)
  const isRunningRef = useRef(false)
  const serverOffsetRef = useRef(0)

  useEffect(() => { isRunningRef.current = isRunning }, [isRunning])
  useEffect(() => { serverOffsetRef.current = serverOffset }, [serverOffset])

  const addLog = useCallback((message: string, type: LogEntry['type'] = 'info') => {
    const now = new Date()
    const ms = String(now.getMilliseconds()).padStart(3, '0')
    const timestamp = now.toLocaleTimeString('zh-CN', { hour12: false }) + '.' + ms
    setLogs(prev => [...prev.slice(-1000), { id: Date.now() + Math.random(), timestamp, message, type }])
  }, [])

  useEffect(() => { logEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [logs])

  const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms))

  // ========== 真实HTTP请求封装 ==========
  const apiHeaders = useCallback(() => ({
    'accept': 'application/json',
    'content-type': 'application/json',
    'authorization': `Bearer ${config.accessToken}`,
    'origin': 'https://qjsh.top',
    'referer': 'https://qjsh.top/',
  }), [config.accessToken])

  // 通用请求函数
  const apiRequest = async (method: 'GET' | 'POST', url: string, body?: unknown) => {
    const fullUrl = url.startsWith('http') ? url : `${BASE_URL}${url}`
    const startTime = performance.now()

    addLog(`[HTTP] ${method} ${url.replace(BASE_URL, '')}`, 'info')
    if (body) {
      addLog(`[BODY] ${JSON.stringify(body)}`, 'info')
    }

    try {
      const resp = await fetch(fullUrl, {
        method,
        headers: apiHeaders(),
        body: body ? JSON.stringify(body) : undefined,
      })

      const latency = performance.now() - startTime
      const data = await resp.json()

      addLog(`[RESP] ${resp.status} code=${data.code || 'N/A'} (${latency.toFixed(0)}ms)`, data.code === 'OK' ? 'success' : 'error')

      // 更新时间偏移
      if (data.data?.serverTime) {
        const serverTime = new Date(data.data.serverTime).getTime()
        const localNow = Date.now()
        const offset = serverTime - localNow
        setServerOffset(offset)
        serverOffsetRef.current = offset
      }

      return { status: resp.status, data, latency }
    } catch (err: unknown) {
      const latency = performance.now() - startTime
      const errMsg = err instanceof Error ? err.message : String(err)
      addLog(`[ERROR] 请求失败 (${latency.toFixed(0)}ms): ${errMsg}`, 'error')
      throw err
    }
  }

  // ========== 真实API调用 ==========

  // 搜索玩家
  const searchPlayer = async (query: string): Promise<PlayerSearchResult[]> => {
    const isNumeric = /^\d+$/.test(query.trim())
    const searchTypes = isNumeric ? ['SHORT_ID', 'NAME'] : ['NAME']
    const allResults: PlayerSearchResult[] = []

    for (const searchType of searchTypes) {
      addLog(`[TASK] 搜索类型: ${searchType}, 关键词: "${query}"`, 'info')
      try {
        const { data } = await apiRequest('GET', `/api/v1/player-search?type=${searchType}&query=${encodeURIComponent(query)}&limit=20`)
        if (data.code === 'OK') {
          const players = data.data?.players || []
          addLog(`[DATA] 找到 ${players.length} 个匹配玩家`, players.length > 0 ? 'success' : 'warning')
          for (const p of players) {
            if (!allResults.find(r => r.playerId === p.playerId)) {
              addLog(`  → ${p.displayName} (ID:${p.shortId}, Lv.${p.level}) UUID:${p.playerId.substring(0, 8)}...`, 'info')
              allResults.push(p)
            }
          }
        } else {
          addLog(`[DATA] 搜索失败: ${data.message}`, 'warning')
        }
      } catch {
        // error already logged
      }
    }
    return allResults
  }

  // 巡查酒馆
  const inspectTavern = async (friendId: string) => {
    const { data } = await apiRequest('GET', `/api/v1/friend-cities/${friendId}/tavern`)
    if (data.code !== 'OK') {
      addLog(`[FAIL] 巡查失败: ${data.message}`, 'error')
      return null
    }
    return data.data
  }

  // 招募
  const recruit = async (friendId: string, candidateId: string, version: number) => {
    const payload = {
      operationId: crypto.randomUUID(),
      candidateId,
      expectedCandidateVersion: version,
    }
    const { data } = await apiRequest('POST', `/api/v1/friend-cities/${friendId}/tavern/recruitments`, payload)
    return data
  }

  // ========== 主巡查逻辑 ==========
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

    const resolvedFriends: FriendInfo[] = []

    for (let i = 0; i < config.friends.length; i++) {
      if (!isRunningRef.current) return
      const inputFriend = config.friends[i]
      addLog(`[${i + 1}/${config.friends.length}] 解析好友: "${inputFriend.displayName}" (#${inputFriend.shortId})`, 'info')

      if (inputFriend.playerId && inputFriend.playerId.length > 20) {
        addLog(`[SKIP] 已有UUID: ${inputFriend.playerId.substring(0, 8)}...`, 'info')
        resolvedFriends.push(inputFriend)
      } else {
        const query = inputFriend.shortId !== 'N/A' ? inputFriend.shortId : inputFriend.displayName
        addLog(`[TASK] 搜索解析 "${query}"...`, 'info')
        const results = await searchPlayer(query)
        if (results.length > 0) {
          const matched = results[0]
          addLog(`[OK] 解析成功: ${matched.displayName} → ${matched.playerId.substring(0, 8)}...`, 'success')
          resolvedFriends.push({
            playerId: matched.playerId,
            shortId: matched.shortId,
            displayName: matched.displayName,
            level: matched.level,
          })
        } else {
          addLog(`[FAIL] 无法解析 "${query}"`, 'error')
        }
      }
      await sleep(200)
    }

    if (resolvedFriends.length === 0) {
      addLog('[ERROR] 没有成功解析任何好友', 'error')
      setCurrentStep('idle')
      return
    }
    addLog(`[RESULT] 成功解析 ${resolvedFriends.length}/${config.friends.length} 个好友`, 'success')
    addLog('', 'info')

    // ===== 阶段1: 时间校准 =====
    addLog('━━━━━━━━━━ 阶段1: 服务器时间校准 ━━━━━━━━━━', 'info')
    try {
      await apiRequest('GET', '/api/v1/tavern')
      addLog(`[CALC] 服务器时间偏移: ${serverOffsetRef.current >= 0 ? '+' : ''}${serverOffsetRef.current.toFixed(1)}ms`, 'info')
    } catch {
      addLog('[WARN] 时间校准失败，使用本地时间', 'warning')
    }
    addLog('', 'info')

    // ===== 阶段2: 巡查酒馆 =====
    addLog('━━━━━━━━━━ 阶段2: 巡查好友酒馆 ━━━━━━━━━━', 'info')
    setCurrentStep('patrol')

    interface SnipeTarget { friend: FriendInfo; candidate: TavernCandidate; protectionEndsAt: string }
    const snipeTargets: SnipeTarget[] = []

    for (let i = 0; i < resolvedFriends.length; i++) {
      if (!isRunningRef.current) return
      const friend = resolvedFriends[i]
      addLog('', 'info')
      addLog(`────────── [${i + 1}/${resolvedFriends.length}] 巡查【${friend.displayName}】#${friend.shortId} ──────────`, 'info')
      addLog(`[INFO] UUID: ${friend.playerId}`, 'info')

      setTavernStatuses(prev => {
        const existing = prev.find(s => s.friend.playerId === friend.playerId)
        if (existing) {
          return prev.map(s => s.friend.playerId === friend.playerId ? { ...s, status: 'scanning' as const, lastScan: new Date().toLocaleTimeString('zh-CN') } : s)
        }
        return [...prev, { friend, status: 'scanning' as const, candidates: [], lastScan: new Date().toLocaleTimeString('zh-CN') }]
      })

      let tavernData
      try {
        tavernData = await inspectTavern(friend.playerId)
      } catch {
        addLog('[FAIL] 巡查请求异常，跳过', 'error')
        continue
      }
      if (!tavernData) continue

      const candidates: TavernCandidate[] = (tavernData.candidates || []).map((c: Record<string, unknown>) => ({
        candidateId: c.candidateId as string,
        name: c.name as string,
        quality: c.quality as string,
        star: c.star as number,
        version: (c.version as number) || 0,
        available: c.recruitmentAvailable as boolean,
        copperCost: (c.copperCost as number) || 0,
        unavailableReason: c.recruitmentUnavailableReason as string | undefined,
      }))

      const protectionEndsAt = tavernData.protectionEndsAt as string
      const now = Date.now() + serverOffsetRef.current
      const protectEnd = new Date(protectionEndsAt).getTime()
      const isProtected = protectEnd > now
      const remainSec = Math.max(0, (protectEnd - now) / 1000)

      setTavernStatuses(prev => prev.map(s =>
        s.friend.playerId === friend.playerId
          ? { ...s, status: 'done' as const, candidates, protectionEndsAt, lastScan: new Date().toLocaleTimeString('zh-CN') }
          : s
      ))
      setStats(prev => ({ ...prev, totalScanned: prev.totalScanned + 1 }))

      // 展示候选武将
      addLog('[DATA] 候选武将列表:', 'info')
      candidates.forEach((c, idx) => {
        const qEmoji = c.quality === 'ORANGE' ? '🟠' : c.quality === 'PURPLE' ? '🟣' : c.quality === 'BLUE' ? '🔵' : '⬜'
        const status = c.available ? '可招募' : `被保护(${c.unavailableReason || '未知'})`
        const isTarget = config.targetQualities.includes(c.quality)
        addLog(`  [${idx}] ${qEmoji} ${c.name} | ${c.quality} ${c.star}星 | v${c.version} | ${c.copperCost}铜 | ${status}${isTarget ? ' ← 目标!' : ''}`, isTarget ? 'warning' : 'info')
      })

      // 筛选目标
      const targetCandidates = candidates.filter(c => config.targetQualities.includes(c.quality))

      if (targetCandidates.length === 0) {
        addLog('[DECISION] 无目标品质武将 → 跳过', 'info')
        setStats(prev => ({ ...prev, totalSkipped: prev.totalSkipped + 1 }))
      } else if (isProtected) {
        addLog(`[DECISION] 发现 ${targetCandidates.length} 个目标，保护期内(剩余${remainSec.toFixed(0)}秒)`, 'warning')
        addLog(`[DATA] protectionEndsAt=${protectionEndsAt}`, 'info')
        if (config.snipeConfig.autoSnipe) {
          const qualityOrder: Record<string, number> = { ORANGE: 2, PURPLE: 1, BLUE: 0, WHITE: 0 }
          const best = targetCandidates.sort((a, b) => (qualityOrder[b.quality] || 0) - (qualityOrder[a.quality] || 0))[0]
          addLog(`[DECISION] 加入抢招队列: ${best.name} (${best.quality} ${best.star}星 v${best.version})`, 'warning')
          snipeTargets.push({ friend, candidate: best, protectionEndsAt })
        }
      } else {
        addLog('[DECISION] 保护期已过，直接招募', 'success')
        const available = targetCandidates.find(c => c.available)
        if (available) {
          addLog(`[TARGET] 选择: ${available.name} v${available.version}`, 'success')
          try {
            const result = await recruit(friend.playerId, available.candidateId, available.version)
            if (result.code === 'OK') {
              addLog(`[RESULT] ✅ 成功偷取【${available.name}】！花费铜钱: ${result.data?.copperCost || '?'}`, 'success')
              setStats(prev => ({ ...prev, totalRecruited: prev.totalRecruited + 1 }))
            } else {
              addLog(`[RESULT] ❌ 招募失败: ${result.code} - ${result.message}`, 'error')
            }
          } catch {
            addLog('[RESULT] ❌ 招募请求异常', 'error')
          }
        } else {
          addLog('[DECISION] 目标不可用 → 跳过', 'info')
          setStats(prev => ({ ...prev, totalSkipped: prev.totalSkipped + 1 }))
        }
      }

      await sleep(500)
    }

    // ===== 阶段3: 抢招 =====
    if (snipeTargets.length > 0 && config.snipeConfig.autoSnipe) {
      addLog('', 'info')
      addLog('━━━━━━━━━━ 阶段3: 精确抢招 ━━━━━━━━━━', 'warning')
      setCurrentStep('sniping')
      addLog(`[TASK] ${snipeTargets.length} 个目标进入抢招队列`, 'warning')

      snipeTargets.sort((a, b) => new Date(a.protectionEndsAt).getTime() - new Date(b.protectionEndsAt).getTime())

      for (const target of snipeTargets) {
        if (!isRunningRef.current) return
        await executeSnipe(target.friend, target.candidate, target.protectionEndsAt)
        await sleep(1000)
      }
    }

    addLog('', 'info')
    addLog('═══════════════════════════════════════════════', 'info')
    addLog(`[DONE] 本轮巡查结束`, 'success')
    addLog(`[NEXT] ${config.intervalSeconds}秒后下一轮...`, 'info')
    addLog('═══════════════════════════════════════════════', 'info')
    setCurrentStep('waiting')
  }, [config, addLog])

  // ========== 抢招执行 ==========
  const executeSnipe = async (friend: FriendInfo, candidate: TavernCandidate, protectionEndsAt: string) => {
    const { advanceMs, maxRetries, retryIntervalMs, preQuerySeconds } = config.snipeConfig
    const protectEnd = new Date(protectionEndsAt).getTime()
    const now = Date.now() + serverOffsetRef.current
    const remainingMs = protectEnd - now
    const remainingSec = remainingMs / 1000

    addLog('', 'info')
    addLog(`────────── 抢招:【${candidate.name}】${candidate.quality} ${candidate.star}星 ──────────`, 'warning')
    addLog(`[INFO] 好友: ${friend.displayName} (${friend.playerId.substring(0, 8)}...)`, 'info')
    addLog(`[INFO] protectionEndsAt: ${protectionEndsAt}`, 'info')
    addLog(`[INFO] 保护期剩余: ${remainingSec.toFixed(1)}秒`, 'info')
    addLog(`[INFO] 服务器偏移: ${serverOffsetRef.current.toFixed(1)}ms`, 'info')

    const snipeState: SnipeState = { phase: 'watching', targetHero: candidate.name, countdown: Math.ceil(remainingSec), serverOffset: serverOffsetRef.current, attempts: 0 }
    setTavernStatuses(prev => prev.map(s => s.friend.playerId === friend.playerId ? { ...s, status: 'watching' as const, snipeState } : s))

    // 等待到预查询时间
    const preQueryWaitMs = remainingMs - (preQuerySeconds * 1000)
    if (preQueryWaitMs > 1000) {
      addLog(`[WAIT] 等待${preQuerySeconds}秒后预查询 (实际等待${(preQueryWaitMs / 1000).toFixed(1)}秒)...`, 'info')
      // 分段等待，保持响应
      const waitStart = Date.now()
      while (Date.now() - waitStart < preQueryWaitMs - 100) {
        if (!isRunningRef.current) return
        const elapsed = Date.now() - waitStart
        const remaining = preQueryWaitMs - elapsed
        if (remaining > 5000) {
          snipeState.countdown = Math.ceil(remaining / 1000)
          setTavernStatuses(prev => prev.map(s => s.friend.playerId === friend.playerId ? { ...s, snipeState: { ...snipeState } } : s))
          await sleep(Math.min(5000, remaining - 100))
        } else {
          await sleep(Math.max(50, remaining - 100))
        }
      }
      // 忙等待最后100ms
      while (Date.now() - waitStart < preQueryWaitMs) { /* busy wait */ }
    }

    if (!isRunningRef.current) return

    // 预查询
    addLog(`[TASK] 预查询获取最新数据...`, 'info')
    setTavernStatuses(prev => prev.map(s => s.friend.playerId === friend.playerId ? { ...s, snipeState: { ...snipeState, phase: 'preparing' } } : s))

    let preQueryData
    try {
      preQueryData = await inspectTavern(friend.playerId)
    } catch {
      addLog('[FAIL] 预查询失败', 'error')
      return
    }
    if (!preQueryData) return

    const preCandidates: TavernCandidate[] = (preQueryData.candidates || []).map((c: Record<string, unknown>) => ({
      candidateId: c.candidateId as string,
      name: c.name as string,
      quality: c.quality as string,
      star: c.star as number,
      version: (c.version as number) || 0,
      available: c.recruitmentAvailable as boolean,
      copperCost: (c.copperCost as number) || 0,
      unavailableReason: c.recruitmentUnavailableReason as string | undefined,
    }))

    // 找目标武将最新数据
    let latest = preCandidates.find(c => c.name === candidate.name)
    if (!latest) latest = preCandidates.find(c => config.targetQualities.includes(c.quality))
    if (!latest) {
      addLog('[FAIL] 预查询未找到目标武将', 'error')
      setTavernStatuses(prev => prev.map(s => s.friend.playerId === friend.playerId ? { ...s, snipeState: { ...snipeState, phase: 'failed', lastResult: '预查询未找到' } } : s))
      return
    }

    addLog(`[DATA] 最新 candidateId: ${latest.candidateId.substring(0, 8)}... version: ${latest.version}`, 'info')

    // 等待到发射时间
    const fireTimeMs = protectEnd - advanceMs
    const currentMs = Date.now() + serverOffsetRef.current
    const waitUntilFireMs = fireTimeMs - currentMs

    setTavernStatuses(prev => prev.map(s => s.friend.playerId === friend.playerId ? { ...s, snipeState: { ...snipeState, phase: 'ready' } } : s))

    if (waitUntilFireMs > 0) {
      addLog(`[WAIT] 距离发射: ${(waitUntilFireMs / 1000).toFixed(3)}秒 (提前${advanceMs}ms)`, 'warning')
      const fireWaitStart = Date.now()
      while (Date.now() - fireWaitStart < waitUntilFireMs - 10) {
        if (!isRunningRef.current) return
      }
      // 忙等待
      while (Date.now() + serverOffsetRef.current < fireTimeMs) { /* busy wait */ }
    }

    if (!isRunningRef.current) return

    // 发射！
    addLog(`[FIRE] ⚡⚡⚡ 发射！[${new Date().toLocaleTimeString('zh-CN', { hour12: false })}.${String(new Date().getMilliseconds()).padStart(3, '0')}] ⚡⚡⚡`, 'warning')

    let attempt = 0
    let success = false

    while (attempt < maxRetries && !success && isRunningRef.current) {
      attempt++
      setStats(prev => ({ ...prev, totalSnipeAttempts: prev.totalSnipeAttempts + 1 }))
      setTavernStatuses(prev => prev.map(s => s.friend.playerId === friend.playerId ? { ...s, status: 'sniping' as const, snipeState: { ...snipeState, phase: 'firing', attempts: attempt } } : s))

      try {
        const result = await recruit(friend.playerId, latest!.candidateId, latest!.version)

        if (result.code === 'OK') {
          success = true
          addLog(`[RESULT] ✅✅✅ 抢招成功！第${attempt}次 铜钱:${result.data?.copperCost || '?'} ✅✅✅`, 'success')
          setStats(prev => ({ ...prev, totalRecruited: prev.totalRecruited + 1 }))
          setTavernStatuses(prev => prev.map(s => s.friend.playerId === friend.playerId ? { ...s, status: 'sniped' as const, snipeState: { ...snipeState, phase: 'success', attempts: attempt, lastResult: `第${attempt}次成功!` } } : s))
        } else {
          addLog(`[RETRY] 第${attempt}次失败: ${result.code} - ${result.message}`, result.code === 'CANDIDATE_PROTECTED' ? 'warning' : 'error')
          if (result.code === 'CANDIDATE_NOT_AVAILABLE' || result.code === 'HERO_CAPACITY_FULL') break
          if (attempt < maxRetries) await sleep(retryIntervalMs)
        }
      } catch {
        addLog(`[RETRY] 第${attempt}次请求异常`, 'error')
        if (attempt < maxRetries) await sleep(retryIntervalMs)
      }
    }

    if (!success) {
      addLog(`[FAIL] 抢招失败，共${attempt}次`, 'error')
      setTavernStatuses(prev => prev.map(s => s.friend.playerId === friend.playerId ? { ...s, status: 'done' as const, snipeState: { ...snipeState, phase: 'failed', attempts: attempt, lastResult: `失败(${attempt}次)` } } : s))
    }
  }

  const handleStart = () => {
    if (!config.accessToken) {
      addLog('[ERROR] 请先在配置面板填入 AccessToken！', 'error')
      return
    }
    setIsRunning(true)
    isRunningRef.current = true
    addLog('🚀 系统启动！', 'success')
    patrolLoop()
  }

  const handleStop = () => {
    setIsRunning(false)
    isRunningRef.current = false
    setCurrentStep('idle')
    addLog('⏹ 用户手动停止', 'warning')
  }

  const handleClearLogs = () => {
    setLogs([])
    setStats({ totalScanned: 0, totalRecruited: 0, totalSkipped: 0, totalSnipeAttempts: 0 })
    setTavernStatuses([])
  }

  const tabs = [
    { id: 'dashboard' as const, label: '📊 控制台' },
    { id: 'config' as const, label: '⚙️ 配置' },
    { id: 'flow' as const, label: '🔄 流程图' },
    { id: 'script' as const, label: '📜 脚本' },
  ]

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-950 to-slate-900 text-white">
      <header className="border-b border-white/10 bg-black/20 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-amber-500 to-red-600 flex items-center justify-center text-xl font-bold shadow-lg shadow-amber-500/30">水</div>
            <div>
              <h1 className="text-lg font-bold bg-gradient-to-r from-amber-300 to-orange-400 bg-clip-text text-transparent">好友酒馆自动巡查招募系统</h1>
              <p className="text-xs text-slate-400">水浒Q传 · 真实请求 + 毫秒级抢招</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-1.5 text-xs text-slate-400 bg-white/5 px-2 py-1 rounded">
              <i className="fa-solid fa-clock text-amber-400" />
              偏移: <span className="text-amber-300 font-mono">{serverOffset.toFixed(0)}ms</span>
            </div>
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${isRunning ? 'bg-green-400 animate-pulse' : 'bg-slate-500'}`} />
              <span className="text-sm text-slate-300">{isRunning ? '运行中' : '已停止'}</span>
            </div>
          </div>
        </div>
      </header>

      <nav className="border-b border-white/10 bg-black/10">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex gap-1">
            {tabs.map(tab => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-2.5 text-sm font-medium rounded-t-lg transition-all ${activeTab === tab.id ? 'bg-white/10 text-amber-300 border-b-2 border-amber-400' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}>
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 py-6">
        {activeTab === 'dashboard' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-1 space-y-4">
              <div className="bg-white/5 rounded-xl border border-white/10 p-4 backdrop-blur-sm">
                <h2 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
                  <i className="fa-solid fa-play text-green-400" /> 控制面板
                </h2>
                <div className="flex gap-2">
                  <button onClick={isRunning ? handleStop : handleStart}
                    className={`flex-1 py-2.5 px-4 rounded-lg font-medium text-sm transition-all ${isRunning ? 'bg-red-500/20 text-red-300 border border-red-500/30 hover:bg-red-500/30' : 'bg-green-500/20 text-green-300 border border-green-500/30 hover:bg-green-500/30'}`}>
                    {isRunning ? '⏹ 停止' : '▶ 启动巡查'}
                  </button>
                  <button onClick={handleClearLogs} className="py-2.5 px-3 rounded-lg text-sm bg-slate-500/20 text-slate-300 border border-slate-500/30 hover:bg-slate-500/30">🗑</button>
                </div>
              </div>
              <StatusPanel stats={stats} currentStep={currentStep} />
              <SnipePanel statuses={tavernStatuses} />
              <FriendInspector statuses={tavernStatuses} />
            </div>
            <div className="lg:col-span-2">
              <LogPanel logs={logs} logEndRef={logEndRef} />
            </div>
          </div>
        )}
        {activeTab === 'config' && <ConfigPanel config={config} setConfig={setConfig} />}
        {activeTab === 'flow' && <FlowDiagram />}
        {activeTab === 'script' && <ScriptViewer />}
      </main>
    </div>
  )
}
