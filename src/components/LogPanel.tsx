import type { LogEntry } from '../types'
import { RefObject } from 'react'

interface Props {
  logs: LogEntry[]
  logEndRef: RefObject<HTMLDivElement>
}

const typeStyles: Record<LogEntry['type'], string> = {
  info: 'text-slate-300',
  success: 'text-green-400',
  error: 'text-red-400',
  warning: 'text-amber-400',
}

// 根据日志内容前缀决定样式
function getLogStyle(message: string): { prefix: string; content: string; icon: string } {
  if (message.startsWith('[HTTP]')) {
    return { prefix: 'text-cyan-400', content: 'text-slate-400 font-mono', icon: '📡' }
  }
  if (message.startsWith('[RESP]')) {
    return { prefix: 'text-blue-400', content: 'text-slate-400 font-mono', icon: '📥' }
  }
  if (message.startsWith('[DATA]')) {
    return { prefix: 'text-purple-400', content: 'text-slate-300 font-mono', icon: '📊' }
  }
  if (message.startsWith('[CONFIG]')) {
    return { prefix: 'text-gray-400', content: 'text-slate-400', icon: '⚙️' }
  }
  if (message.startsWith('[TASK]')) {
    return { prefix: 'text-amber-400', content: 'text-amber-300', icon: '📋' }
  }
  if (message.startsWith('[DECISION]')) {
    return { prefix: 'text-orange-400', content: 'text-orange-300', icon: '🎯' }
  }
  if (message.startsWith('[RESULT]')) {
    return { prefix: 'text-green-400', content: 'text-green-300 font-semibold', icon: '✅' }
  }
  if (message.startsWith('[FAIL]') || message.startsWith('[ERROR]')) {
    return { prefix: 'text-red-400', content: 'text-red-300', icon: '❌' }
  }
  if (message.startsWith('[WAIT]')) {
    return { prefix: 'text-yellow-400', content: 'text-yellow-300', icon: '⏳' }
  }
  if (message.startsWith('[FIRE]')) {
    return { prefix: 'text-red-500', content: 'text-red-400 font-bold', icon: '⚡' }
  }
  if (message.startsWith('[RETRY]')) {
    return { prefix: 'text-orange-400', content: 'text-orange-300', icon: '🔄' }
  }
  if (message.startsWith('[CALC]')) {
    return { prefix: 'text-teal-400', content: 'text-teal-300 font-mono', icon: '🧮' }
  }
  if (message.startsWith('[INFO]')) {
    return { prefix: 'text-slate-400', content: 'text-slate-300', icon: 'ℹ️' }
  }
  if (message.startsWith('[TARGET]')) {
    return { prefix: 'text-pink-400', content: 'text-pink-300', icon: '🎯' }
  }
  if (message.startsWith('[PLAN]')) {
    return { prefix: 'text-indigo-400', content: 'text-indigo-300', icon: '📝' }
  }
  if (message.startsWith('[SKIP]')) {
    return { prefix: 'text-gray-400', content: 'text-gray-400', icon: '⏭️' }
  }
  if (message.startsWith('[OK]')) {
    return { prefix: 'text-green-400', content: 'text-green-300', icon: '✅' }
  }
  if (message.startsWith('━━') || message.startsWith('══') || message.startsWith('──')) {
    return { prefix: 'text-slate-600', content: 'text-slate-500', icon: '' }
  }
  return { prefix: '', content: typeStyles.info, icon: '' }
}

export default function LogPanel({ logs, logEndRef }: Props) {
  return (
    <div className="bg-white/5 rounded-xl border border-white/10 backdrop-blur-sm h-full flex flex-col">
      <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-300 flex items-center gap-2">
          <i className="fa-solid fa-terminal text-green-400" />
          运行日志
        </h2>
        <span className="text-xs text-slate-500">{logs.length} 条记录</span>
      </div>
      <div className="flex-1 overflow-y-auto p-3 font-mono text-xs space-y-0.5 min-h-[400px] max-h-[700px] bg-black/20">
        {logs.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-500">
            <i className="fa-solid fa-scroll text-3xl mb-2 opacity-30" />
            <p>等待启动巡查...</p>
            <p className="text-xs mt-1">点击"启动巡查"开始自动偷取武将</p>
          </div>
        ) : (
          logs.map(log => {
            if (log.message === '') {
              return <div key={log.id} className="h-2" />
            }
            const style = getLogStyle(log.message)
            return (
              <div key={log.id} className="flex gap-2 hover:bg-white/5 px-1 py-0.5 rounded transition-colors">
                <span className="text-slate-600 shrink-0 select-none">[{log.timestamp}]</span>
                {style.icon && <span className="shrink-0">{style.icon}</span>}
                <span className={`break-all ${style.content}`}>
                  {log.message}
                </span>
              </div>
            )
          })
        )}
        <div ref={logEndRef as React.Ref<HTMLDivElement>} />
      </div>
    </div>
  )
}
