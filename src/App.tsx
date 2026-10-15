import { useState, useCallback, useRef, useEffect } from 'react'
import ConfigPanel from './components/ConfigPanel'
import LogPanel from './components/LogPanel'
import StatusPanel from './components/StatusPanel'
import FlowDiagram from './components/FlowDiagram'
import ScriptViewer from './components/ScriptViewer'
import FriendInspector from './components/FriendInspector'
import type { Config, LogEntry, FriendTavernStatus } from './types'

const DEFAULT_CONFIG: Config = {
  phoneNumber: '',
  password: '',
  deviceFingerprint: '',
  serverId: 'recharge-s1',
  targetQualities: ['PURPLE', 'ORANGE'],
  intervalSeconds: 60,
  friendIds: [],
  accessToken: '',
}

export default function App() {
  const [config, setConfig] = useState<Config>(DEFAULT_CONFIG)
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [isRunning, setIsRunning] = useState(false)
  const [currentStep, setCurrentStep] = useState<string>('idle')
  const [tavernStatuses, setTavernStatuses] = useState<FriendTavernStatus[]>([])
  const [stats, setStats] = useState({ totalScanned: 0, totalRecruited: 0, totalSkipped: 0 })
  const [activeTab, setActiveTab] = useState<'dashboard' | 'config' | 'script' | 'flow'>('dashboard')
  const intervalRef = useRef<number | null>(null)
  const logEndRef = useRef<HTMLDivElement>(null!)

  const addLog = useCallback((message: string, type: LogEntry['type'] = 'info') => {
    setLogs(prev => [...prev, {
      id: Date.now() + Math.random(),
      timestamp: new Date().toLocaleTimeString('zh-CN'),
      message,
      type,
    }])
  }, [])

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [logs])

  const simulatePatrol = useCallback(() => {
    if (!isRunning) return

    setCurrentStep('login')
    addLog('正在登录服务器...', 'info')

    setTimeout(() => {
      if (!config.accessToken) {
        addLog('❌ 未配置 AccessToken，请先在配置面板填入！', 'error')
        setCurrentStep('idle')
        return
      }
      addLog('✅ 登录成功，获取好友列表...', 'success')
      setCurrentStep('friends')

      setTimeout(() => {
        const friends = config.friendIds.length > 0 ? config.friendIds : ['未配置好友ID']
        addLog(`📋 共 ${friends.length} 个好友待巡查`, 'info')
        setCurrentStep('patrol')

        let friendIndex = 0
        const patrolNext = () => {
          if (!isRunning || friendIndex >= friends.length) {
            addLog(`🔄 本轮巡查结束，${config.intervalSeconds}秒后开始下一轮...`, 'info')
            setCurrentStep('waiting')
            return
          }

          const fid = friends[friendIndex]
          addLog(`🔍 巡查好友 [${fid.substring(0, 8)}...] 的酒馆...`, 'info')

          setTavernStatuses(prev => {
            const existing = prev.find(s => s.friendId === fid)
            if (existing) {
              return prev.map(s => s.friendId === fid ? { ...s, status: 'scanning', lastScan: new Date().toLocaleTimeString('zh-CN') } : s)
            }
            return [...prev, { friendId: fid, status: 'scanning', candidates: [], lastScan: new Date().toLocaleTimeString('zh-CN') }]
          })

          setTimeout(() => {
            // Simulate finding heroes
            const qualities = ['WHITE', 'BLUE', 'PURPLE', 'ORANGE']
            const heroNames = ['阮小七', '孙新', '李逵', '武松', '林冲', '鲁智深', '宋江', '吴用', '公孙胜', '关胜']
            const numHeroes = Math.floor(Math.random() * 3) + 1
            const candidates = Array.from({ length: numHeroes }, () => {
              const q = qualities[Math.floor(Math.random() * qualities.length)]
              return {
                name: heroNames[Math.floor(Math.random() * heroNames.length)],
                quality: q,
                star: Math.floor(Math.random() * 5) + 1,
                available: Math.random() > 0.4,
              }
            })

            setTavernStatuses(prev => prev.map(s =>
              s.friendId === fid ? { ...s, status: 'done', candidates, lastScan: new Date().toLocaleTimeString('zh-CN') } : s
            ))

            setStats(prev => ({ ...prev, totalScanned: prev.totalScanned + 1 }))

            const targets = candidates.filter(c =>
              config.targetQualities.includes(c.quality) && c.available
            )

            if (targets.length > 0) {
              targets.forEach(t => {
                addLog(`🔥 发现目标武将！【${t.name}】| ${t.quality === 'ORANGE' ? '🟠橙色' : '🟣紫色'} ${t.star}星`, 'success')
                addLog(`  → 正在执行秒招募...`, 'info')

                setTimeout(() => {
                  addLog(`  ✅ 成功偷取【${t.name}】！花费铜钱: ${Math.floor(Math.random() * 5000) + 1000}`, 'success')
                  setStats(prev => ({ ...prev, totalRecruited: prev.totalRecruited + 1 }))
                }, 300)
              })
            } else {
              const protectedOnes = candidates.filter(c => !c.available)
              if (protectedOnes.length > 0) {
                addLog(`  ⚠️ 该好友酒馆武将被保护中 (CANDIDATE_PROTECTED)`, 'warning')
              } else {
                addLog(`  无目标品质武将，跳过`, 'info')
              }
              setStats(prev => ({ ...prev, totalSkipped: prev.totalSkipped + 1 }))
            }

            friendIndex++
            setTimeout(patrolNext, 1500)
          }, 800)
        }

        patrolNext()
      }, 500)
    }, 600)
  }, [isRunning, config, addLog])

  const handleStart = () => {
    setIsRunning(true)
    addLog('🚀 自动巡查系统启动！', 'success')
    simulatePatrol()
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
    setStats({ totalScanned: 0, totalRecruited: 0, totalSkipped: 0 })
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
              <p className="text-xs text-slate-400">水浒Q传 · 全自动偷取高品质武将</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${isRunning ? 'bg-green-400 animate-pulse' : 'bg-slate-500'}`} />
            <span className="text-sm text-slate-300">
              {isRunning ? '运行中' : '已停止'}
            </span>
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
            {/* Left Column - Controls & Status */}
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
