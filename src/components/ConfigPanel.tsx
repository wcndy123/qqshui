import { useState, useCallback } from 'react'
import type { Config, FriendInfo, PlayerSearchResult } from '../types'

interface Props {
  config: Config
  setConfig: (config: Config) => void
}

export default function ConfigPanel({ config, setConfig }: Props) {
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<PlayerSearchResult[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [searchError, setSearchError] = useState('')

  const updateField = (field: keyof Config, value: string | string[] | number | FriendInfo[]) => {
    setConfig({ ...config, [field]: value })
  }

  const toggleQuality = (quality: string) => {
    const current = config.targetQualities
    if (current.includes(quality)) {
      updateField('targetQualities', current.filter(q => q !== quality))
    } else {
      updateField('targetQualities', [...current, quality])
    }
  }

  // 判断输入是否为纯数字
  const isNumeric = (str: string) => /^\d+$/.test(str.trim())

  // 模拟搜索（实际项目中应调用真实API）
  const handleSearch = useCallback(async () => {
    const query = searchQuery.trim()
    if (!query) return

    setIsSearching(true)
    setSearchError('')
    setSearchResults([])

    try {
      // 模拟API调用延迟
      await new Promise(resolve => setTimeout(resolve, 500))

      // 模拟搜索结果
      // 实际实现中这里应该调用:
      // GET /api/v1/player-search?type=SHORT_ID&query={query}&limit=20
      // GET /api/v1/player-search?type=NAME&query={query}&limit=20
      const mockResults: PlayerSearchResult[] = []

      if (isNumeric(query)) {
        // 纯数字 → 同时搜索短ID和昵称
        mockResults.push({
          playerId: 'mock-' + Date.now(),
          shortId: query,
          displayName: `玩家${query}`,
          avatarKey: 'player.avatar.male.default',
          level: Math.floor(Math.random() * 50) + 1,
          commercialTier: Math.floor(Math.random() * 6),
        })
      } else {
        // 包含文字 → 只搜索昵称
        mockResults.push({
          playerId: 'mock-' + Date.now(),
          shortId: String(Math.floor(Math.random() * 900000) + 100000),
          displayName: query,
          avatarKey: 'player.avatar.male.default',
          level: Math.floor(Math.random() * 50) + 1,
          commercialTier: Math.floor(Math.random() * 6),
        })
      }

      setSearchResults(mockResults)
    } catch {
      setSearchError('搜索失败，请检查网络或AccessToken')
    } finally {
      setIsSearching(false)
    }
  }, [searchQuery])

  const addFriend = (player: PlayerSearchResult) => {
    // 检查是否已添加
    if (config.friends.some(f => f.playerId === player.playerId)) {
      setSearchError('该好友已在列表中')
      return
    }

    const newFriend: FriendInfo = {
      playerId: player.playerId,
      shortId: player.shortId,
      displayName: player.displayName,
      level: player.level,
      avatarKey: player.avatarKey,
    }

    updateField('friends', [...config.friends, newFriend])
    setSearchResults([])
    setSearchQuery('')
    setSearchError('')
  }

  const removeFriend = (playerId: string) => {
    updateField('friends', config.friends.filter(f => f.playerId !== playerId))
  }

  // 手动添加（直接输入UUID的兜底方案）
  const [showManualAdd, setShowManualAdd] = useState(false)
  const [manualId, setManualId] = useState('')
  const [manualName, setManualName] = useState('')
  const [manualShortId, setManualShortId] = useState('')

  const handleManualAdd = () => {
    if (!manualId.trim()) return
    const newFriend: FriendInfo = {
      playerId: manualId.trim(),
      shortId: manualShortId.trim() || 'N/A',
      displayName: manualName.trim() || '未知玩家',
      level: 0,
    }
    if (config.friends.some(f => f.playerId === newFriend.playerId)) return
    updateField('friends', [...config.friends, newFriend])
    setManualId('')
    setManualName('')
    setManualShortId('')
    setShowManualAdd(false)
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

      {/* Friend Search & List */}
      <div className="bg-white/5 rounded-xl border border-white/10 p-5 backdrop-blur-sm">
        <h3 className="text-base font-semibold text-amber-300 mb-4 flex items-center gap-2">
          <i className="fa-solid fa-users" />
          好友列表
          <span className="ml-auto text-xs text-slate-400 font-normal">
            已添加 {config.friends.length} 人
          </span>
        </h3>

        {/* Search Box */}
        <div className="mb-4">
          <label className="block text-xs text-slate-400 mb-1.5">
            搜索好友（输入短ID或游戏昵称）
          </label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSearch()}
                placeholder="输入短ID(如100033)或昵称(如戏言)"
                className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/30 pr-20"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-500">
                {searchQuery && (isNumeric(searchQuery) ? '🔢 短ID+昵称' : '📝 昵称')}
              </span>
            </div>
            <button
              onClick={handleSearch}
              disabled={isSearching || !searchQuery.trim()}
              className="px-4 py-2.5 rounded-lg bg-amber-500/20 text-amber-300 border border-amber-500/30 hover:bg-amber-500/30 text-sm font-medium transition-all disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
            >
              {isSearching ? (
                <span className="flex items-center gap-1.5">
                  <i className="fa-solid fa-spinner fa-spin text-xs" />
                  搜索中
                </span>
              ) : (
                <span className="flex items-center gap-1.5">
                  <i className="fa-solid fa-magnifying-glass text-xs" />
                  搜索
                </span>
              )}
            </button>
          </div>

          {/* Search hint */}
          <div className="mt-2 flex items-start gap-2 text-xs text-slate-500">
            <i className="fa-solid fa-circle-info text-blue-400 mt-0.5" />
            <div>
              <p>
                <strong className="text-slate-400">纯数字</strong>（如100033）→ 同时搜索短ID和昵称（因为昵称也可能是数字）
              </p>
              <p>
                <strong className="text-slate-400">含文字</strong>（如戏言）→ 仅搜索昵称
              </p>
            </div>
          </div>
        </div>

        {/* Search Error */}
        {searchError && (
          <div className="mb-3 px-3 py-2 bg-red-500/10 border border-red-500/20 rounded-lg text-xs text-red-300">
            {searchError}
          </div>
        )}

        {/* Search Results */}
        {searchResults.length > 0 && (
          <div className="mb-4 bg-black/20 rounded-lg border border-white/5 overflow-hidden">
            <div className="px-3 py-2 bg-white/5 border-b border-white/5 text-xs text-slate-400">
              搜索结果 ({searchResults.length})
            </div>
            <div className="divide-y divide-white/5">
              {searchResults.map(player => {
                const alreadyAdded = config.friends.some(f => f.playerId === player.playerId)
                return (
                  <div key={player.playerId} className="px-3 py-2.5 flex items-center gap-3">
                    {/* Avatar */}
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-amber-500/30 to-orange-600/30 border border-amber-500/20 flex items-center justify-center text-sm font-bold text-amber-300 shrink-0">
                      {player.displayName.charAt(0)}
                    </div>
                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-white truncate">{player.displayName}</span>
                        <span className="text-xs text-slate-500">Lv.{player.level}</span>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-slate-400 font-mono">ID: {player.shortId}</span>
                        <span className="text-xs text-slate-600">·</span>
                        <span className="text-xs text-slate-500 font-mono truncate max-w-[120px]">
                          {player.playerId.substring(0, 8)}...
                        </span>
                      </div>
                    </div>
                    {/* Add Button */}
                    <button
                      onClick={() => addFriend(player)}
                      disabled={alreadyAdded}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all shrink-0 ${
                        alreadyAdded
                          ? 'bg-slate-500/10 text-slate-500 border border-slate-500/20 cursor-not-allowed'
                          : 'bg-green-500/20 text-green-300 border border-green-500/30 hover:bg-green-500/30'
                      }`}
                    >
                      {alreadyAdded ? '已添加' : '+ 添加'}
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Added Friends List */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-slate-400">已添加的好友</span>
            <button
              onClick={() => setShowManualAdd(!showManualAdd)}
              className="text-xs text-slate-500 hover:text-amber-300 transition-colors flex items-center gap-1"
            >
              <i className="fa-solid fa-pen-to-square" />
              手动添加UUID
            </button>
          </div>

          {/* Manual Add Form */}
          {showManualAdd && (
            <div className="mb-3 p-3 bg-amber-500/5 border border-amber-500/20 rounded-lg space-y-2">
              <input
                type="text"
                value={manualId}
                onChange={e => setManualId(e.target.value)}
                placeholder="内部UUID (如 d15f3677-67fc-4074-92c1-5aede87bb491)"
                className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-500/50"
              />
              <div className="flex gap-2">
                <input
                  type="text"
                  value={manualName}
                  onChange={e => setManualName(e.target.value)}
                  placeholder="昵称 (可选)"
                  className="flex-1 bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-500/50"
                />
                <input
                  type="text"
                  value={manualShortId}
                  onChange={e => setManualShortId(e.target.value)}
                  placeholder="短ID (可选)"
                  className="flex-1 bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-500/50"
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleManualAdd}
                  disabled={!manualId.trim()}
                  className="px-3 py-1.5 rounded-lg text-xs bg-amber-500/20 text-amber-300 border border-amber-500/30 hover:bg-amber-500/30 disabled:opacity-40"
                >
                  确认添加
                </button>
                <button
                  onClick={() => setShowManualAdd(false)}
                  className="px-3 py-1.5 rounded-lg text-xs bg-slate-500/20 text-slate-300 border border-slate-500/30 hover:bg-slate-500/30"
                >
                  取消
                </button>
              </div>
            </div>
          )}

          {config.friends.length === 0 ? (
            <div className="text-center py-6 text-slate-500">
              <i className="fa-solid fa-user-plus text-2xl mb-2 opacity-30" />
              <p className="text-xs">还没有添加好友，请在上方搜索并添加</p>
            </div>
          ) : (
            <div className="space-y-1.5 max-h-64 overflow-y-auto">
              {config.friends.map(friend => (
                <div
                  key={friend.playerId}
                  className="flex items-center gap-3 px-3 py-2 bg-black/20 rounded-lg border border-white/5 group hover:border-white/10 transition-all"
                >
                  {/* Avatar */}
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-500/20 to-orange-600/20 border border-amber-500/10 flex items-center justify-center text-xs font-bold text-amber-300 shrink-0">
                    {friend.displayName.charAt(0)}
                  </div>
                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-white font-medium truncate">{friend.displayName}</span>
                      {friend.level > 0 && (
                        <span className="text-xs text-slate-500">Lv.{friend.level}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-amber-400/70 font-mono">#{friend.shortId}</span>
                      <span className="text-xs text-slate-600">·</span>
                      <span className="text-xs text-slate-500 font-mono truncate">
                        {friend.playerId.substring(0, 8)}...
                      </span>
                    </div>
                  </div>
                  {/* Remove Button */}
                  <button
                    onClick={() => removeFriend(friend.playerId)}
                    className="px-2 py-1 rounded text-xs text-red-400/60 hover:text-red-400 hover:bg-red-500/10 opacity-0 group-hover:opacity-100 transition-all"
                    title="移除"
                  >
                    <i className="fa-solid fa-xmark" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* API Info */}
        <div className="mt-4 p-3 bg-blue-500/5 border border-blue-500/20 rounded-lg">
          <p className="text-xs text-blue-300/80">
            💡 <strong>搜索API：</strong>
            <code className="bg-black/30 px-1.5 py-0.5 rounded mx-1 text-blue-200">
              GET /api/v1/player-search?type=SHORT_ID|NAME&query=xxx&limit=20
            </code>
            <br />
            搜索结果中的 <code className="bg-black/30 px-1 py-0.5 rounded text-blue-200">playerId</code> 即为内部UUID，用于访问好友酒馆。
          </p>
        </div>
      </div>

      {/* Snipe Strategy Config */}
      <div className="bg-white/5 rounded-xl border border-red-500/20 p-5 backdrop-blur-sm">
        <h3 className="text-base font-semibold text-red-300 mb-4 flex items-center gap-2">
          <i className="fa-solid fa-crosshairs" />
          ⚡ 抢招策略配置
        </h3>

        {/* Enable/Disable */}
        <div className="mb-4 flex items-center justify-between p-3 bg-black/20 rounded-lg border border-white/5">
          <div>
            <p className="text-sm text-white font-medium">自动抢招模式</p>
            <p className="text-xs text-slate-500">保护期结束后自动发起毫秒级抢招</p>
          </div>
          <button
            onClick={() => setConfig({
              ...config,
              snipeConfig: { ...config.snipeConfig, autoSnipe: !config.snipeConfig.autoSnipe }
            })}
            className={`w-12 h-6 rounded-full transition-all relative ${
              config.snipeConfig.autoSnipe ? 'bg-red-500' : 'bg-slate-600'
            }`}
          >
            <div className={`w-5 h-5 rounded-full bg-white absolute top-0.5 transition-all ${
              config.snipeConfig.autoSnipe ? 'left-6' : 'left-0.5'
            }`} />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Advance Time */}
          <div>
            <label className="block text-xs text-slate-400 mb-1">
              提前量 (ms)
              <span className="text-slate-500 ml-1">· 补偿网络延迟</span>
            </label>
            <input
              type="number"
              value={config.snipeConfig.advanceMs}
              onChange={e => setConfig({
                ...config,
                snipeConfig: { ...config.snipeConfig, advanceMs: parseInt(e.target.value) || 50 }
              })}
              min={0}
              max={500}
              step={10}
              className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-red-500/50 focus:ring-1 focus:ring-red-500/30"
            />
            <p className="text-xs text-slate-500 mt-1">在保护期结束前 N 毫秒发起请求，补偿网络传输时间</p>
          </div>

          {/* Pre-query Time */}
          <div>
            <label className="block text-xs text-slate-400 mb-1">
              预查询时间 (秒)
              <span className="text-slate-500 ml-1">· 获取最新数据</span>
            </label>
            <input
              type="number"
              value={config.snipeConfig.preQuerySeconds}
              onChange={e => setConfig({
                ...config,
                snipeConfig: { ...config.snipeConfig, preQuerySeconds: parseInt(e.target.value) || 5 }
              })}
              min={2}
              max={30}
              className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-red-500/50 focus:ring-1 focus:ring-red-500/30"
            />
            <p className="text-xs text-slate-500 mt-1">保护期结束前 N 秒重新查询获取最新 candidateId 和 version</p>
          </div>

          {/* Max Retries */}
          <div>
            <label className="block text-xs text-slate-400 mb-1">最大重试次数</label>
            <input
              type="number"
              value={config.snipeConfig.maxRetries}
              onChange={e => setConfig({
                ...config,
                snipeConfig: { ...config.snipeConfig, maxRetries: parseInt(e.target.value) || 3 }
              })}
              min={1}
              max={5}
              className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-red-500/50 focus:ring-1 focus:ring-red-500/30"
            />
            <p className="text-xs text-slate-500 mt-1">首次抢招失败后的重试次数（间隔200ms）</p>
          </div>

          {/* Retry Interval */}
          <div>
            <label className="block text-xs text-slate-400 mb-1">重试间隔 (ms)</label>
            <input
              type="number"
              value={config.snipeConfig.retryIntervalMs}
              onChange={e => setConfig({
                ...config,
                snipeConfig: { ...config.snipeConfig, retryIntervalMs: parseInt(e.target.value) || 200 }
              })}
              min={100}
              max={2000}
              step={50}
              className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-red-500/50 focus:ring-1 focus:ring-red-500/30"
            />
            <p className="text-xs text-slate-500 mt-1">两次招募请求之间的最小间隔，防止触发封控</p>
          </div>
        </div>

        {/* Strategy Explanation */}
        <div className="mt-4 p-3 bg-red-500/5 border border-red-500/20 rounded-lg">
          <p className="text-xs text-red-300/80 font-medium mb-2">🎯 抢招时序策略：</p>
          <div className="text-xs text-slate-400 space-y-1 font-mono">
            <p>T-{config.snipeConfig.preQuerySeconds}s → 预查询获取最新 candidateId/version</p>
            <p>T-{(config.snipeConfig.advanceMs / 1000).toFixed(2)}s → 发起招募请求（提前量补偿网络延迟）</p>
            <p>T+0.00s → ⚡ 保护期结束瞬间</p>
            <p>T+0.20s → 若失败，第2次重试</p>
            <p>T+0.40s → 若失败，第3次重试</p>
          </div>
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
