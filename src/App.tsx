import { useState, useCallback, useRef, useEffect } from 'react'
import ConfigPanel from './components/ConfigPanel'
import LogPanel from './components/LogPanel'
import StatusPanel from './components/StatusPanel'
import FlowDiagram from './components/FlowDiagram'
import ScriptViewer from './components/ScriptViewer'
import FriendInspector from './components/FriendInspector'
import SnipePanel from './components/SnipePanel'
import type { Config, LogEntry, FriendTavernStatus, TavernCandidate, SnipeState } from './types'

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
  const [serverOffset, setServerOffset] = useState(0) // 服务器时间偏移(ms)
  const intervalRef = useRef<number | null>(null)
  const logEndRef = useRef<HTMLDivElement>(null!)

  const addLog = useCallback((message: string, type: LogEntry['type'] = 'info') => {
    setLogs(prev => [...prev, {
      id: Date.now() + Math.random(),
      timestamp: new Date().toLocaleTimeString('zh-CN', { hour12: false, fractionalSecondDigits: 3 } as any),
      message,
      type,
    }])
  }, [])

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [logs])

  // 模拟服务器时间校准
  const calibrateTime = useCallback(() => {
    const serverTime = Date.now() + (Math.random() * 40 - 20) // 模拟±20ms偏差
    const offset = serverTime - Date.now()
    setServerOffset(offset)
    return offset
  }, [])

  // 模拟巡查一个好友酒馆
  const simulateInspect = useCallback((friendId: string) => {
    const qualities = ['WHITE', 'BLUE', 'PURPLE', 'ORANGE']
    const heroNames = ['阮小七', '孙新', '李逵', '武松', '林冲', '鲁智深', '宋江', '吴用', '公孙胜', '关胜']
    const numHeroes = Math.floor(Math.random() * 3) + 1

    const candidates: TavernCandidate[] = Array.from({ length: numHeroes }, (_, i) => {
      const q = qualities[Math.floor(Math.random() * qualities.length)]
      return {
        candidateId: `cand-${Date.now()}-${i}`,
        name: heroNames[Math.floor(Math.random() * heroNames.length)],
        quality: q,
        star: Math.floor(Math.random() * 5) + 1,
        version: Math.floor(Math.random() * 3),
        available: Math.random() > 0.4,
        copperCost: Math.floor(Math.random() * 5000) + 500,
        unavailableReason: Math.random() > 0.5 ? 'CANDIDATE_PROTECTED' : undefined,
      }
    })

    // 模拟保护期：随机在未来0~30分钟内
    const now = Date.now()
    const protectionDuration = Math.floor(Math.random() * 30 * 60 * 1000)
    const protectionEndsAt = new Date(now + protectionDuration).toISOString()

    return { candidates, protectionEndsAt }
  }, [])

  // 抢招核心逻辑
  const executeSnipe = useCallback(async (
    friendId: string,
    candidate: TavernCandidate,
    protectionEndsAt: string,
  ) => {
    const { advanceMs, maxRetries, retryIntervalMs } = config.snipeConfig
    const protectEnd = new Date(protectionEndsAt).getTime()
    const now = Date.now() + serverOffset
    const timeUntilProtectEnd = protectEnd - now

    const snipeState: SnipeState = {
      phase: 'watching',
      targetHero: candidate.name,
      countdown: Math.ceil(timeUntilProtectEnd / 1000),
      serverOffset,
      attempts: 0,
    }

    // 更新状态为 watching
    setTavernStatuses(prev => prev.map(s =>
      s.friend.playerId === friendId
        ? { ...s, status: 'watching' as const, snipeState }
        : s
    ))

    addLog(`👁 开始监控【${candidate.name}】${candidate.quality === 'ORANGE' ? '🟠橙' : '🟣紫'}${candidate.star}星`, 'info')
    addLog(`  保护期剩余: ${Math.ceil(timeUntilProtectEnd / 1000)}秒 | 服务器偏移: ${serverOffset.toFixed(1)}ms`, 'info')

    // 阶段1：等待到预查询时间
    const preQueryMs = config.snipeConfig.preQuerySeconds * 1000
    const waitUntilPreQuery = timeUntilProtectEnd - preQueryMs

    if (waitUntilPreQuery > 0) {
      addLog(`  ⏳ 等待${config.snipeConfig.preQuerySeconds}秒后预查询...`, 'info')
      await sleep(waitUntilPreQuery)
    }

    // 阶段2：预查询（获取最新candidateId和version）
    setTavernStatuses(prev => prev.map(s =>
      s.friend.playerId === friendId
        ? { ...s, snipeState: { ...snipeState, phase: 'preparing' } }
        : s
    ))
    addLog(`  🔍 预查询获取最新数据...`, 'info')
    await sleep(200) // 模拟请求延迟

    // 阶段3：等待到发射时间
    const fireTime = protectEnd - advanceMs // 提前 advanceMs 发起
    const currentTime = Date.now() + serverOffset
    const waitUntilFire = fireTime - currentTime

    setTavernStatuses(prev => prev.map(s =>
      s.friend.playerId === friendId
        ? { ...s, snipeState: { ...snipeState, phase: 'ready', countdown: Math.ceil(waitUntilFire / 1000) } }
        : s
    ))

    if (waitUntilFire > 0) {
      addLog(`  🎯 准备就绪，${(waitUntilFire / 1000).toFixed(2)}秒后发射 (提前${advanceMs}ms补偿网络延迟)`, 'warning')
      await sleep(waitUntilFire)
    }

    // 阶段4：发射！
    let attempt = 0
    let success = false

    while (attempt < maxRetries && !success) {
      attempt++
      const firedAt = new Date().toISOString()

      setTavernStatuses(prev => prev.map(s =>
        s.friend.playerId === friendId
          ? { ...s, status: 'sniping' as const, snipeState: { ...snipeState, phase: 'firing', attempts: attempt, firedAt } }
          : s
      ))

      setStats(prev => ({ ...prev, totalSnipeAttempts: prev.totalSnipeAttempts + 1 }))
      addLog(`  ⚡ 第${attempt}次发射！[${new Date().toLocaleTimeString('zh-CN', { hour12: false } as any)}.${String(new Date().getMilliseconds()).padStart(3, '0')}]`, 'warning')

      // 模拟请求
      await sleep(30 + Math.random() * 50) // 模拟网络延迟30-80ms

      // 模拟结果
      const rand = Math.random()
      if (attempt === 1 && rand > 0.3) {
        // 第一次就有70%概率成功
        success = true
      } else if (attempt === 2 && rand > 0.2) {
        success = true
      } else if (attempt >= 3 && rand > 0.5) {
        success = true
      }

      if (success) {
        setTavernStatuses(prev => prev.map(s =>
          s.friend.playerId === friendId
            ? { ...s, status: 'sniped' as const, snipeState: { ...snipeState, phase: 'success', attempts: attempt, lastResult: '招募成功！' } }
            : s
        ))
        addLog(`  ✅ 成功偷取【${candidate.name}】！第${attempt}次尝试 | 花费铜钱: ${candidate.copperCost}`, 'success')
        setStats(prev => ({ ...prev, totalRecruited: prev.totalRecruited + 1 }))
        return true
      } else {
        const failReason = attempt === 1 ? '保护期未结束' : '已被他人抢先'
        addLog(`  ❌ 第${attempt}次失败: ${failReason}`, 'error')

        if (attempt < maxRetries) {
          await sleep(retryIntervalMs)
        }
      }
    }

    // 全部失败
    setTavernStatuses(prev => prev.map(s =>
      s.friend.playerId === friendId
        ? { ...s, status: 'done' as const, snipeState: { ...snipeState, phase: 'failed', attempts: attempt, lastResult: '抢招失败' } }
        : s
    ))
    addLog(`  💀 抢招失败，已尝试${attempt}次`, 'error')
    return false
  }, [config.snipeConfig, serverOffset, addLog])

  const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

  // 主巡查循环
  const patrolLoop = useCallback(async () => {
    if (!isRunning) return

    setCurrentStep('login')
    addLog('🔐 正在校准服务器时间...', 'info')
    const offset = calibrateTime()
    addLog(`  服务器时间偏移: ${offset.toFixed(1)}ms`, 'info')

    await sleep(300)
    setCurrentStep('patrol')

    const friends = config.friends
    if (friends.length === 0) {
      addLog('❌ 未配置好友！请先在配置面板搜索并添加好友', 'error')
      setCurrentStep('idle')
      return
    }

    addLog(`\n📋 开始巡查 ${friends.length} 个好友的酒馆`, 'info')

    // 阶段1：慢轮询发现目标
    const targets: { friend: typeof friends[0], candidate: TavernCandidate, protectionEndsAt: string }[] = []

    for (let i = 0; i < friends.length; i++) {
      if (!isRunning) return
      const friend = friends[i]
      addLog(`\n[${i + 1}/${friends.length}] 🔍 巡查【${friend.displayName}】(#${friend.shortId})`, 'info')

      setTavernStatuses(prev => {
        const existing = prev.find(s => s.friend.playerId === friend.playerId)
        if (existing) {
          return prev.map(s => s.friend.playerId === friend.playerId ? { ...s, status: 'scanning' as const, lastScan: new Date().toLocaleTimeString('zh-CN') } : s)
        }
        return [...prev, { friend, status: 'scanning' as const, candidates: [], lastScan: new Date().toLocaleTimeString('zh-CN') }]
      })

      await sleep(300) // 模拟请求延迟

      const { candidates, protectionEndsAt } = simulateInspect(friend.playerId)

      setTavernStatuses(prev => prev.map(s =>
        s.friend.playerId === friend.playerId
          ? { ...s, status: 'done' as const, candidates, protectionEndsAt, lastScan: new Date().toLocaleTimeString('zh-CN') }
          : s
      ))

      setStats(prev => ({ ...prev, totalScanned: prev.totalScanned + 1 }))

      // 检查是否有保护期内的目标品质武将
      const protectEndTime = new Date(protectionEndsAt).getTime()
      const now = Date.now() + serverOffset
      const isProtected = protectEndTime > now

      const targetCandidates = candidates.filter(c =>
        config.targetQualities.includes(c.quality)
      )

      if (targetCandidates.length > 0) {
        if (isProtected) {
          const remainSec = Math.ceil((protectEndTime - now) / 1000)
          addLog(`  🔥 发现目标！但保护期内(剩余${remainSec}秒)`, 'warning')
          targetCandidates.forEach(c => {
            addLog(`    ${c.quality === 'ORANGE' ? '🟠' : '🟣'}【${c.name}】${c.star}星 - 等待保护期结束`, 'warning')
          })

          if (config.snipeConfig.autoSnipe) {
            // 选择最高品质的目标
            const best = targetCandidates.sort((a, b) => {
              const qOrder = { ORANGE: 2, PURPLE: 1 }
              return (qOrder[b.quality as keyof typeof qOrder] || 0) - (qOrder[a.quality as keyof typeof qOrder] || 0)
            })[0]
            targets.push({ friend, candidate: best, protectionEndsAt })
          }
        } else {
          // 保护期已过，直接尝试招募
          const available = targetCandidates.find(c => c.available)
          if (available) {
            addLog(`  🔥 发现可招募目标！立即抢招...`, 'success')
            // 直接招募（无保护期）
            await sleep(100)
            const success = Math.random() > 0.5
            if (success) {
              addLog(`  ✅ 成功偷取【${available.name}】！`, 'success')
              setStats(prev => ({ ...prev, totalRecruited: prev.totalRecruited + 1 }))
            } else {
              addLog(`  ❌ 招募失败: 已被他人抢先`, 'error')
            }
          } else {
            addLog(`  目标武将被保护中，跳过`, 'info')
          }
        }
      } else {
        addLog(`  无目标品质武将`, 'info')
        setStats(prev => ({ ...prev, totalSkipped: prev.totalSkipped + 1 }))
      }

      await sleep(500) // 好友间间隔
    }

    // 阶段2：对需要等待保护期的目标执行抢招
    if (targets.length > 0 && config.snipeConfig.autoSnipe) {
      addLog(`\n🎯 发现 ${targets.length} 个待抢目标，进入抢招模式...`, 'warning')
      setCurrentStep('sniping')

      for (const target of targets) {
        if (!isRunning) return
        await executeSnipe(target.friend.playerId, target.candidate, target.protectionEndsAt)
        await sleep(1000) // 目标间间隔
      }
    }

    // 本轮结束
    setCurrentStep('waiting')
    addLog(`\n🔄 本轮巡查结束，${config.intervalSeconds}秒后开始下一轮...`, 'info')
  }, [isRunning, config, serverOffset, calibrateTime, simulateInspect, executeSnipe, addLog])

  const handleStart = () => {
    setIsRunning(true)
    addLog('🚀 自动巡查系统启动！', 'success')
    addLog(`  抢招模式: ${config.snipeConfig.autoSnipe ? '✅ 开启' : '❌ 关闭'}`, 'info')
    addLog(`  提前量: ${config.snipeConfig.advanceMs}ms | 最大重试: ${config.snipeConfig.maxRetries}次`, 'info')
    patrolLoop()
  }

  const handleStop = () => {
    setIsRunning(false)
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
    setCurrentStep('idle')
    addLog('⏹ 自动巡查已停止', 'warning')
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
              时间偏移: <span className="text-amber-300 font-mono">{serverOffset.toFixed(0)}ms</span>
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
