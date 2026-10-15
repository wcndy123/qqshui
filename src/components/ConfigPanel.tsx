import type { Config } from '../types'

interface Props {
  config: Config
  setConfig: (config: Config) => void
}

export default function ConfigPanel({ config, setConfig }: Props) {
  const updateField = (field: keyof Config, value: string | string[] | number) => {
    setConfig({ ...config, [field]: value })
  }

  const addFriendId = () => {
    setConfig({ ...config, friendIds: [...config.friendIds, ''] })
  }

  const removeFriendId = (index: number) => {
    setConfig({ ...config, friendIds: config.friendIds.filter((_, i) => i !== index) })
  }

  const updateFriendId = (index: number, value: string) => {
    const newIds = [...config.friendIds]
    newIds[index] = value
    setConfig({ ...config, friendIds: newIds })
  }

  const toggleQuality = (quality: string) => {
    const current = config.targetQualities
    if (current.includes(quality)) {
      updateField('targetQualities', current.filter(q => q !== quality))
    } else {
      updateField('targetQualities', [...current, quality])
    }
  }

  return (
    <div className="space-y-6">
      {/* Auth Section */}
      <div className="bg-white/5 rounded-xl border border-white/10 p-5 backdrop-blur-sm">
        <h3 className="text-base font-semibold text-amber-300 mb-4 flex items-center gap-2">
          <i className="fa-solid fa-key" />
          认证信息
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-slate-400 mb-1">AccessToken *</label>
            <input
              type="text"
              value={config.accessToken}
              onChange={e => updateField('accessToken', e.target.value)}
              placeholder="从抓包工具获取的 Bearer Token"
              className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/30"
            />
            <p className="text-xs text-slate-500 mt-1">从浏览器开发者工具 Network 面板复制 Authorization 头中的值</p>
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">设备指纹</label>
            <input
              type="text"
              value={config.deviceFingerprint}
              onChange={e => updateField('deviceFingerprint', e.target.value)}
              placeholder="30bf967e-18ff-443d-a765-1c4580274ab3"
              className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/30"
            />
          </div>
        </div>
      </div>

      {/* Server Section */}
      <div className="bg-white/5 rounded-xl border border-white/10 p-5 backdrop-blur-sm">
        <h3 className="text-base font-semibold text-amber-300 mb-4 flex items-center gap-2">
          <i className="fa-solid fa-server" />
          服务器配置
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-slate-400 mb-1">区服ID</label>
            <input
              type="text"
              value={config.serverId}
              onChange={e => updateField('serverId', e.target.value)}
              className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/30"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">巡查间隔 (秒)</label>
            <input
              type="number"
              value={config.intervalSeconds}
              onChange={e => updateField('intervalSeconds', parseInt(e.target.value) || 60)}
              min={10}
              max={600}
              className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/30"
            />
          </div>
        </div>
      </div>

      {/* Target Qualities */}
      <div className="bg-white/5 rounded-xl border border-white/10 p-5 backdrop-blur-sm">
        <h3 className="text-base font-semibold text-amber-300 mb-4 flex items-center gap-2">
          <i className="fa-solid fa-filter" />
          目标品质筛选
        </h3>
        <div className="flex flex-wrap gap-3">
          {[
            { value: 'WHITE', label: '⬜ 白色', color: 'border-slate-400 text-slate-300' },
            { value: 'BLUE', label: '🔵 蓝色', color: 'border-blue-400 text-blue-300' },
            { value: 'PURPLE', label: '🟣 紫色', color: 'border-purple-400 text-purple-300' },
            { value: 'ORANGE', label: '🟠 橙色', color: 'border-orange-400 text-orange-300' },
          ].map(q => (
            <button
              key={q.value}
              onClick={() => toggleQuality(q.value)}
              className={`px-4 py-2 rounded-lg border text-sm font-medium transition-all ${
                config.targetQualities.includes(q.value)
                  ? `${q.color} bg-white/10 shadow-lg`
                  : 'border-white/10 text-slate-500 opacity-50'
              }`}
            >
              {q.label}
            </button>
          ))}
        </div>
        <p className="text-xs text-slate-500 mt-2">仅巡查并招募被选中的品质武将</p>
      </div>

      {/* Friend IDs */}
      <div className="bg-white/5 rounded-xl border border-white/10 p-5 backdrop-blur-sm">
        <h3 className="text-base font-semibold text-amber-300 mb-4 flex items-center gap-2">
          <i className="fa-solid fa-users" />
          好友ID列表
        </h3>
        <div className="space-y-2 mb-3">
          {config.friendIds.map((fid, index) => (
            <div key={index} className="flex gap-2">
              <input
                type="text"
                value={fid}
                onChange={e => updateFriendId(index, e.target.value)}
                placeholder={`好友 ${index + 1} 的 UUID`}
                className="flex-1 bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/30"
              />
              <button
                onClick={() => removeFriendId(index)}
                className="px-3 py-2 rounded-lg bg-red-500/20 text-red-300 border border-red-500/30 hover:bg-red-500/30 text-sm"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
        <button
          onClick={addFriendId}
          className="px-4 py-2 rounded-lg bg-amber-500/20 text-amber-300 border border-amber-500/30 hover:bg-amber-500/30 text-sm transition-all"
        >
          + 添加好友ID
        </button>
        <div className="mt-3 p-3 bg-amber-500/5 border border-amber-500/20 rounded-lg">
          <p className="text-xs text-amber-300/80">
            💡 <strong>提示：</strong>好友ID可以从抓包中获取。访问好友酒馆时URL中的UUID就是好友ID，例如：
            <code className="bg-black/30 px-1.5 py-0.5 rounded mx-1 text-amber-200">
              /friend-cities/d15f3677-67fc-4074-92c1-5aede87bb491/tavern
            </code>
          </p>
        </div>
      </div>

      {/* Quick Login (Optional) */}
      <div className="bg-white/5 rounded-xl border border-white/10 p-5 backdrop-blur-sm">
        <h3 className="text-base font-semibold text-amber-300 mb-4 flex items-center gap-2">
          <i className="fa-solid fa-right-to-bracket" />
          自动登录（可选）
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-slate-400 mb-1">手机号</label>
            <input
              type="tel"
              value={config.phoneNumber}
              onChange={e => updateField('phoneNumber', e.target.value)}
              placeholder="登录手机号"
              className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/30"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">密码</label>
            <input
              type="password"
              value={config.password}
              onChange={e => updateField('password', e.target.value)}
              placeholder="登录密码"
              className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/30"
            />
          </div>
        </div>
        <p className="text-xs text-slate-500 mt-2">
          填写后可自动登录获取Token，无需手动抓包
        </p>
      </div>
    </div>
  )
}
