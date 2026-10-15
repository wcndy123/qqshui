interface Props {
  stats: {
    totalScanned: number
    totalRecruited: number
    totalSkipped: number
    totalSnipeAttempts: number
  }
  currentStep: string
}

const stepLabels: Record<string, string> = {
  idle: '待机中',
  login: '🔐 正在登录...',
  friends: '📋 获取好友列表...',
  patrol: '🔍 巡查中...',
  sniping: '⚡ 抢招模式!',
  waiting: '⏳ 等待下一轮...',
}

export default function StatusPanel({ stats, currentStep }: Props) {
  const statCards = [
    { label: '已巡查', value: stats.totalScanned, icon: '🔍', color: 'from-blue-500/20 to-blue-600/10 border-blue-500/30' },
    { label: '已招募', value: stats.totalRecruited, icon: '🏆', color: 'from-green-500/20 to-green-600/10 border-green-500/30' },
    { label: '抢招次数', value: stats.totalSnipeAttempts, icon: '⚡', color: 'from-red-500/20 to-red-600/10 border-red-500/30' },
    { label: '已跳过', value: stats.totalSkipped, icon: '⏭', color: 'from-slate-500/20 to-slate-600/10 border-slate-500/30' },
  ]

  return (
    <div className="bg-white/5 rounded-xl border border-white/10 p-4 backdrop-blur-sm">
      <h2 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
        <i className="fa-solid fa-chart-bar text-blue-400" />
        统计信息
      </h2>
      
      {/* Current Step */}
      <div className="mb-3 px-3 py-2 bg-black/20 rounded-lg border border-white/5">
        <p className="text-xs text-slate-400">当前状态</p>
        <p className={`text-sm font-medium ${currentStep === 'sniping' ? 'text-red-300 animate-pulse' : 'text-amber-300'}`}>
          {stepLabels[currentStep] || '处理中...'}
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-2">
        {statCards.map(card => (
          <div
            key={card.label}
            className={`bg-gradient-to-b ${card.color} border rounded-lg p-2.5 text-center`}
          >
            <div className="text-lg">{card.icon}</div>
            <div className="text-xl font-bold text-white">{card.value}</div>
            <div className="text-xs text-slate-400">{card.label}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
