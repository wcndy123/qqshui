import type { LogEntry } from '../types'

interface Props {
  logs: LogEntry[]
  logEndRef: React.RefObject<HTMLDivElement>
}

const typeStyles: Record<LogEntry['type'], string> = {
  info: 'text-slate-300',
  success: 'text-green-400',
  error: 'text-red-400',
  warning: 'text-amber-400',
}

const typeIcons: Record<LogEntry['type'], string> = {
  info: 'ℹ️',
  success: '✅',
  error: '❌',
  warning: '⚠️',
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
      <div className="flex-1 overflow-y-auto p-4 font-mono text-xs space-y-1 min-h-[400px] max-h-[600px]">
        {logs.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-500">
            <i className="fa-solid fa-scroll text-3xl mb-2 opacity-30" />
            <p>等待启动巡查...</p>
            <p className="text-xs mt-1">点击"启动巡查"开始自动偷取武将</p>
          </div>
        ) : (
          logs.map(log => (
            <div key={log.id} className={`flex gap-2 ${typeStyles[log.type]}`}>
              <span className="text-slate-500 shrink-0">[{log.timestamp}]</span>
              <span className="shrink-0">{typeIcons[log.type]}</span>
              <span className="break-all">{log.message}</span>
            </div>
          ))
        )}
        <div ref={logEndRef as React.Ref<HTMLDivElement>} />
      </div>
    </div>
  )
}
