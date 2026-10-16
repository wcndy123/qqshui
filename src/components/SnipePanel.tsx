import type { FriendTavernStatus } from '../types'

interface Props {
  statuses: FriendTavernStatus[]
}

const phaseConfig: Record<string, { label: string; color: string; icon: string }> = {
  idle: { label: '待机', color: 'text-slate-400', icon: '💤' },
  watching: { label: '监控中', color: 'text-blue-300', icon: '👁' },
  preparing: { label: '预查询', color: 'text-cyan-300', icon: '🔍' },
  ready: { label: '就绪', color: 'text-amber-300', icon: '🎯' },
  firing: { label: '发射!', color: 'text-red-300', icon: '⚡' },
  success: { label: '成功!', color: 'text-green-300', icon: '✅' },
  failed: { label: '失败', color: 'text-red-400', icon: '❌' },
  protected: { label: '保护中', color: 'text-yellow-400', icon: '🛡' },
}

export default function SnipePanel({ statuses }: Props) {
  const snipeTargets = statuses.filter(s => s.snipeState && s.snipeState.phase !== 'idle')

  if (snipeTargets.length === 0) {
    return (
      <div className="bg-white/5 rounded-xl border border-white/10 p-4 backdrop-blur-sm">
        <h2 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
          <i className="fa-solid fa-crosshairs text-red-400" />
          抢招监控
        </h2>
        <p className="text-xs text-slate-500 text-center py-3">
          发现保护期内目标后自动进入抢招模式
        </p>
      </div>
    )
  }

  return (
    <div className="bg-white/5 rounded-xl border border-white/10 p-4 backdrop-blur-sm">
      <h2 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
        <i className="fa-solid fa-crosshairs text-red-400" />
        抢招监控
        <span className="ml-auto text-xs text-red-400 animate-pulse">
          {snipeTargets.filter(s => ['watching', 'preparing', 'ready', 'firing'].includes(s.snipeState!.phase)).length > 0 && '● LIVE'}
        </span>
      </h2>

      <div className="space-y-2">
        {snipeTargets.map((status, idx) => {
          const state = status.snipeState!
          const phase = phaseConfig[state.phase] || phaseConfig.idle

          return (
            <div
              key={idx}
              className={`rounded-lg p-3 border transition-all ${
                state.phase === 'firing'
                  ? 'bg-red-500/10 border-red-500/30 animate-pulse'
                  : state.phase === 'success'
                  ? 'bg-green-500/10 border-green-500/30'
                  : state.phase === 'failed'
                  ? 'bg-red-500/5 border-red-500/20'
                  : 'bg-black/20 border-white/5'
              }`}
            >
              {/* Header */}
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-lg">{phase.icon}</span>
                  <div>
                    <span className="text-sm font-medium text-white">
                      {state.targetHero || '未知武将'}
                    </span>
                    <span className={`ml-2 text-xs ${phase.color}`}>
                      {phase.label}
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  {state.countdown !== undefined && state.countdown > 0 && (
                    <div className="text-lg font-mono font-bold text-amber-300">
                      {state.countdown}s
                    </div>
                  )}
                </div>
              </div>

              {/* Progress Bar */}
              {['watching', 'preparing', 'ready'].includes(state.phase) && state.countdown !== undefined && (
                <div className="mb-2">
                  <div className="h-1.5 bg-black/30 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-amber-500 to-red-500 transition-all duration-1000"
                      style={{ width: `${Math.max(0, Math.min(100, (1 - state.countdown / 30) * 100))}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Details */}
              <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                <div className="text-slate-500">
                  服务器偏移: <span className="text-slate-300 font-mono">{state.serverOffset?.toFixed(1) || '0'}ms</span>
                </div>
                <div className="text-slate-500">
                  尝试次数: <span className="text-slate-300 font-mono">{state.attempts || 0}</span>
                </div>
                {state.lastResult && (
                  <div className="col-span-2 text-slate-500">
                    结果: <span className={state.phase === 'success' ? 'text-green-300' : 'text-red-300'}>{state.lastResult}</span>
                  </div>
                )}
              </div>

              {/* Phase Indicator */}
              <div className="mt-2 flex gap-1">
                {['watching', 'preparing', 'ready', 'firing', 'success'].map((p, i) => {
                  const phases = ['watching', 'preparing', 'ready', 'firing', 'success']
                  const currentIdx = phases.indexOf(state.phase)
                  const isActive = i <= currentIdx || (state.phase === 'failed' && i < 4)
                  return (
                    <div
                      key={p}
                      className={`flex-1 h-1 rounded-full transition-all ${
                        isActive
                          ? state.phase === 'success'
                            ? 'bg-green-500'
                            : state.phase === 'failed'
                            ? i === 4 ? 'bg-slate-600' : 'bg-red-500'
                            : 'bg-amber-500'
                          : 'bg-white/10'
                      }`}
                    />
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
