import type { FriendTavernStatus } from '../types'

interface Props {
  statuses: FriendTavernStatus[]
}

const qualityColors: Record<string, string> = {
  WHITE: 'bg-slate-400 text-slate-900',
  BLUE: 'bg-blue-400 text-blue-900',
  PURPLE: 'bg-purple-500 text-purple-100',
  ORANGE: 'bg-orange-500 text-orange-100',
}

const qualityLabels: Record<string, string> = {
  WHITE: '白',
  BLUE: '蓝',
  PURPLE: '紫',
  ORANGE: '橙',
}

export default function FriendInspector({ statuses }: Props) {
  if (statuses.length === 0) {
    return (
      <div className="bg-white/5 rounded-xl border border-white/10 p-4 backdrop-blur-sm">
        <h2 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
          <i className="fa-solid fa-users-viewfinder text-purple-400" />
          好友酒馆状态
        </h2>
        <p className="text-xs text-slate-500 text-center py-4">暂无巡查记录</p>
      </div>
    )
  }

  return (
    <div className="bg-white/5 rounded-xl border border-white/10 p-4 backdrop-blur-sm">
      <h2 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
        <i className="fa-solid fa-users-viewfinder text-purple-400" />
        好友酒馆状态
        <span className="ml-auto text-xs text-slate-500">{statuses.length} 人</span>
      </h2>
      <div className="space-y-2 max-h-64 overflow-y-auto">
        {statuses.map((status, idx) => (
          <div key={idx} className="bg-black/20 rounded-lg p-2.5 border border-white/5">
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-6 h-6 rounded-full bg-gradient-to-br from-amber-500/20 to-orange-600/20 border border-amber-500/10 flex items-center justify-center text-xs font-bold text-amber-300 shrink-0">
                  {status.friend.displayName.charAt(0)}
                </div>
                <div className="min-w-0">
                  <span className="text-xs text-white font-medium truncate block">
                    {status.friend.displayName}
                  </span>
                  <span className="text-xs text-amber-400/60 font-mono">
                    #{status.friend.shortId}
                  </span>
                </div>
              </div>
              <span className={`text-xs px-1.5 py-0.5 rounded shrink-0 ${
                status.status === 'scanning' ? 'bg-blue-500/20 text-blue-300' :
                status.status === 'done' ? 'bg-green-500/20 text-green-300' :
                status.status === 'error' ? 'bg-red-500/20 text-red-300' :
                'bg-slate-500/20 text-slate-400'
              }`}>
                {status.status === 'scanning' ? '🔍 巡查中' :
                 status.status === 'done' ? '✅ 已完成' :
                 status.status === 'error' ? '❌ 失败' : '⏳ 等待'}
              </span>
            </div>
            {status.candidates.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {status.candidates.map((c, i) => (
                  <span
                    key={i}
                    className={`text-xs px-1.5 py-0.5 rounded font-medium ${qualityColors[c.quality] || 'bg-slate-500 text-white'}`}
                    title={`${c.name} ${c.star}星 ${c.available ? '可招募' : '被保护'}`}
                  >
                    {qualityLabels[c.quality]}{c.star}★ {c.name}
                    {!c.available && '🔒'}
                  </span>
                ))}
              </div>
            )}
            {status.lastScan && (
              <p className="text-xs text-slate-500 mt-1">最后巡查: {status.lastScan}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
