export default function FlowDiagram() {
  const steps = [
    {
      id: 1,
      title: '登录进服',
      description: 'POST /api/v1/auth/password/login\nPOST /api/v1/auth/servers/enter',
      icon: '🔐',
      color: 'from-blue-500 to-blue-600',
    },
    {
      id: 2,
      title: '获取好友列表',
      description: 'GET /api/v1/friends\n提取所有 friendId',
      icon: '📋',
      color: 'from-indigo-500 to-indigo-600',
    },
    {
      id: 3,
      title: '巡查好友酒馆',
      description: 'GET /api/v1/friend-cities/{friendId}/tavern\n获取候选武将列表',
      icon: '🔍',
      color: 'from-purple-500 to-purple-600',
    },
    {
      id: 4,
      title: '品质筛选',
      description: '判断 quality ∈ {PURPLE, ORANGE}\n且 recruitmentAvailable == true',
      icon: '🎯',
      color: 'from-pink-500 to-pink-600',
    },
    {
      id: 5,
      title: '执行秒招募',
      description: 'POST /api/v1/friend-cities/{friendId}/tavern/recruitments\n携带 candidateId + version',
      icon: '⚡',
      color: 'from-amber-500 to-orange-600',
    },
    {
      id: 6,
      title: '容量检查',
      description: '检查 heroCapacity\n满仓则停止，否则继续',
      icon: '📦',
      color: 'from-green-500 to-green-600',
    },
  ]

  const apiTable = [
    { feature: '自己的酒馆', get: '/api/v1/tavern', post: '/api/v1/tavern/recruitments' },
    { feature: '好友的酒馆', get: '/api/v1/friend-cities/{friendId}/tavern', post: '/api/v1/friend-cities/{friendId}/tavern/recruitments' },
  ]

  return (
    <div className="space-y-6">
      {/* Flow Steps */}
      <div className="bg-white/5 rounded-xl border border-white/10 p-6 backdrop-blur-sm">
        <h3 className="text-base font-semibold text-amber-300 mb-6 flex items-center gap-2">
          <i className="fa-solid fa-diagram-project" />
          全自动巡查业务流程
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
                  <div className="w-0.5 h-4 bg-gradient-to-b from-white/30 to-transparent" />
                  <div className="absolute mt-3">
                    <i className="fa-solid fa-chevron-down text-white/40 text-xs" />
                  </div>
                </div>
              )}
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
                <th className="text-left py-2 px-3 text-slate-400 font-medium">功能</th>
                <th className="text-left py-2 px-3 text-green-400 font-medium">查询 (GET)</th>
                <th className="text-left py-2 px-3 text-amber-400 font-medium">招募 (POST)</th>
              </tr>
            </thead>
            <tbody>
              {apiTable.map((row, i) => (
                <tr key={i} className="border-b border-white/5">
                  <td className="py-2.5 px-3 text-slate-300">{row.feature}</td>
                  <td className="py-2.5 px-3">
                    <code className="bg-green-500/10 text-green-300 px-2 py-0.5 rounded text-xs font-mono">
                      {row.get}
                    </code>
                  </td>
                  <td className="py-2.5 px-3">
                    <code className="bg-amber-500/10 text-amber-300 px-2 py-0.5 rounded text-xs font-mono">
                      {row.post}
                    </code>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Response Example */}
      <div className="bg-white/5 rounded-xl border border-white/10 p-6 backdrop-blur-sm">
        <h3 className="text-base font-semibold text-amber-300 mb-4 flex items-center gap-2">
          <i className="fa-solid fa-code" />
          招募请求 Payload 示例
        </h3>
        <div className="bg-black/40 rounded-lg p-4 font-mono text-xs text-slate-300 overflow-x-auto">
          <pre>{`POST /api/v1/friend-cities/{friendId}/tavern/recruitments

{
  "operationId": "uuid-v4-random",
  "candidateId": "f83ad99c-ec08-4e15-beef-82383a50eea8",
  "expectedCandidateVersion": 0
}`}</pre>
        </div>
      </div>
    </div>
  )
}
