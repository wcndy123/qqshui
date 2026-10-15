export default function FlowDiagram() {
  const steps = [
    {
      id: 1,
      title: '登录 & 时间校准',
      description: 'POST /auth/password/login\nPOST /auth/servers/enter\nGET 任意接口获取 serverTime → 计算 offset',
      icon: '🔐',
      color: 'from-blue-500 to-blue-600',
    },
    {
      id: 2,
      title: '慢轮询巡查',
      description: 'GET /friend-cities/{friendId}/tavern\n每60秒巡查一次，发现目标品质武将\n记录 protectionEndsAt',
      icon: '🔍',
      color: 'from-indigo-500 to-indigo-600',
    },
    {
      id: 3,
      title: '判断保护期',
      description: 'protectionEndsAt > serverNow?\n→ 是: 进入抢招等待队列\n→ 否: 直接尝试招募',
      icon: '🛡',
      color: 'from-yellow-500 to-amber-600',
    },
    {
      id: 4,
      title: '倒计时等待',
      description: '用校准后的时间精确倒计时\n保护期结束前 preQuerySeconds 秒\n触发预查询',
      icon: '⏱',
      color: 'from-purple-500 to-purple-600',
    },
    {
      id: 5,
      title: '预查询',
      description: '重新 GET tavern 获取最新\ncandidateId + version\n构建好 payload 待命',
      icon: '🔄',
      color: 'from-pink-500 to-pink-600',
    },
    {
      id: 6,
      title: '精确抢招 ⚡',
      description: '在 protectionEndsAt - advanceMs 时刻\n发起 POST recruitments\n失败则间隔 retryInterval 重试',
      icon: '⚡',
      color: 'from-red-500 to-red-600',
    },
  ]

  return (
    <div className="space-y-6">
      {/* Strategy Overview */}
      <div className="bg-gradient-to-r from-red-500/10 to-amber-500/10 rounded-xl border border-red-500/20 p-6 backdrop-blur-sm">
        <h3 className="text-base font-semibold text-red-300 mb-3 flex items-center gap-2">
          <i className="fa-solid fa-bolt" />
          四阶段抢招策略
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          {[
            { phase: '① 发现', desc: '慢轮询(60s)发现目标', icon: '🔍', color: 'border-blue-500/30 bg-blue-500/5' },
            { phase: '② 校准', desc: '时间同步+倒计时', icon: '⏱', color: 'border-purple-500/30 bg-purple-500/5' },
            { phase: '③ 预备', desc: '预查询+构建payload', icon: '🎯', color: 'border-amber-500/30 bg-amber-500/5' },
            { phase: '④ 抢招', desc: '毫秒级精确发射', icon: '⚡', color: 'border-red-500/30 bg-red-500/5' },
          ].map(item => (
            <div key={item.phase} className={`p-3 rounded-lg border ${item.color}`}>
              <div className="text-xl mb-1">{item.icon}</div>
              <div className="text-sm font-bold text-white">{item.phase}</div>
              <div className="text-xs text-slate-400">{item.desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Timeline Diagram */}
      <div className="bg-white/5 rounded-xl border border-white/10 p-6 backdrop-blur-sm">
        <h3 className="text-base font-semibold text-amber-300 mb-4 flex items-center gap-2">
          <i className="fa-solid fa-timeline" />
          抢招时序图
        </h3>
        <div className="relative">
          {/* Timeline bar */}
          <div className="h-2 bg-gradient-to-r from-blue-500 via-amber-500 to-red-500 rounded-full mb-6" />

          {/* Time markers */}
          <div className="flex justify-between text-xs text-slate-400 font-mono mb-4">
            <span>T-30min</span>
            <span>T-5s</span>
            <span>T-0.05s</span>
            <span className="text-red-400 font-bold">T+0 (保护期结束)</span>
            <span>T+0.2s</span>
            <span>T+0.4s</span>
          </div>

          {/* Events */}
          <div className="space-y-3">
            {[
              { time: 'T-30min', event: '酒馆刷新，保护期开始', detail: '只有主人能招募', color: 'text-blue-300', icon: '🛡' },
              { time: 'T-60s', event: '慢轮询发现目标', detail: 'GET tavern → 记录 protectionEndsAt', color: 'text-indigo-300', icon: '🔍' },
              { time: 'T-5s', event: '预查询', detail: '重新获取 candidateId + version', color: 'text-purple-300', icon: '🔄' },
              { time: 'T-0.05s', event: '发射请求', detail: '提前50ms补偿网络延迟', color: 'text-amber-300', icon: '🎯' },
              { time: 'T+0', event: '⚡ 保护期结束', detail: '请求到达服务器，立即处理', color: 'text-red-300', icon: '⚡' },
              { time: 'T+0.2s', event: '重试 #2 (如需)', detail: '间隔200ms，防止封控', color: 'text-orange-300', icon: '🔁' },
              { time: 'T+0.4s', event: '重试 #3 (如需)', detail: '最后一次机会', color: 'text-red-400', icon: '🔁' },
            ].map((item, i) => (
              <div key={i} className="flex items-start gap-3">
                <span className="text-xs font-mono text-slate-500 w-16 shrink-0 pt-0.5">{item.time}</span>
                <span className="text-base">{item.icon}</span>
                <div>
                  <p className={`text-sm font-medium ${item.color}`}>{item.event}</p>
                  <p className="text-xs text-slate-500">{item.detail}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Key Design Decisions */}
      <div className="bg-white/5 rounded-xl border border-white/10 p-6 backdrop-blur-sm">
        <h3 className="text-base font-semibold text-amber-300 mb-4 flex items-center gap-2">
          <i className="fa-solid fa-lightbulb text-yellow-400" />
          关键设计决策
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[
            {
              title: '为什么提前50ms？',
              content: '网络请求从客户端到服务器通常需要30-100ms。提前50ms发起，请求到达时刚好是保护期结束时刻，既不会太早被拒绝，也不会太晚被别人抢先。',
              icon: '🌐',
            },
            {
              title: '为什么需要时间校准？',
              content: '客户端和服务器的系统时钟可能有偏差。每次请求都获取 serverTime，计算 offset，确保倒计时基于服务器时间而非本地时间。',
              icon: '⏰',
            },
            {
              title: '为什么预查询？',
              content: '保护期结束前重新查询获取最新的 candidateId 和 version，确保招募请求的数据是最新的，避免因数据过期被拒绝。',
              icon: '🔄',
            },
            {
              title: '为什么限制重试间隔？',
              content: '保护期结束后竞争极其激烈，但不能疯狂点击。200ms间隔既能保证多次尝试，又不会触发服务器的频率限制和封控机制。',
              icon: '🛡',
            },
          ].map((item, i) => (
            <div key={i} className="p-3 bg-black/20 rounded-lg border border-white/5">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-lg">{item.icon}</span>
                <h4 className="text-sm font-bold text-white">{item.title}</h4>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">{item.content}</p>
            </div>
          ))}
        </div>
      </div>

      {/* API Table */}
      <div className="bg-white/5 rounded-xl border border-white/10 p-6 backdrop-blur-sm">
        <h3 className="text-base font-semibold text-amber-300 mb-4 flex items-center gap-2">
          <i className="fa-solid fa-table" />
          API 接口对照表
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10">
                <th className="text-left py-2 px-3 text-slate-400 font-medium">阶段</th>
                <th className="text-left py-2 px-3 text-green-400 font-medium">方法</th>
                <th className="text-left py-2 px-3 text-amber-400 font-medium">端点</th>
              </tr>
            </thead>
            <tbody>
              {[
                { phase: '时间校准', method: 'GET', endpoint: '任意接口（响应含 serverTime）' },
                { phase: '巡查酒馆', method: 'GET', endpoint: '/api/v1/friend-cities/{friendId}/tavern' },
                { phase: '预查询', method: 'GET', endpoint: '/api/v1/friend-cities/{friendId}/tavern' },
                { phase: '抢招', method: 'POST', endpoint: '/api/v1/friend-cities/{friendId}/tavern/recruitments' },
                { phase: '搜索玩家', method: 'GET', endpoint: '/api/v1/player-search?type=SHORT_ID|NAME&query=xxx' },
              ].map((row, i) => (
                <tr key={i} className="border-b border-white/5">
                  <td className="py-2.5 px-3 text-slate-300">{row.phase}</td>
                  <td className="py-2.5 px-3">
                    <code className={`px-2 py-0.5 rounded text-xs font-mono ${
                      row.method === 'GET' ? 'bg-green-500/10 text-green-300' : 'bg-amber-500/10 text-amber-300'
                    }`}>
                      {row.method}
                    </code>
                  </td>
                  <td className="py-2.5 px-3">
                    <code className="text-xs font-mono text-slate-300">{row.endpoint}</code>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Flow Steps */}
      <div className="bg-white/5 rounded-xl border border-white/10 p-6 backdrop-blur-sm">
        <h3 className="text-base font-semibold text-amber-300 mb-6 flex items-center gap-2">
          <i className="fa-solid fa-diagram-project" />
          完整业务流程
        </h3>
        <div className="flex flex-col items-center gap-2">
          {steps.map((step, index) => (
            <div key={step.id} className="w-full max-w-lg">
              <div className={`bg-gradient-to-r ${step.color} rounded-xl p-4 shadow-lg`}>
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{step.icon}</span>
                  <div className="flex-1">
                    <h4 className="font-bold text-white text-sm">
                      Step {step.id}: {step.title}
                    </h4>
                    <p className="text-xs text-white/80 font-mono mt-1 whitespace-pre-line">
                      {step.description}
                    </p>
                  </div>
                </div>
              </div>
              {index < steps.length - 1 && (
                <div className="flex justify-center py-1">
                  <i className="fa-solid fa-chevron-down text-white/30 text-xs" />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
