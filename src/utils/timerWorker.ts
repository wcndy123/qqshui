// 高精度计时 Worker 的主线程封装
// 将 public/timer-worker.js 与项目关联起来：
// - Worker 内部的 setInterval / Date.now 不受浏览器后台标签页节流影响，
//   解决主线程 setTimeout/setInterval 在后台被降频（最低 1s/次）导致的时间对比不准问题
// - 自动同步服务器时间偏移（阶段1校准后调用 syncServerOffset）

export type TimerWorkerMessage =
  | { type: 'initialized' }
  | { type: 'started'; targetTime: number; startTime: number; remaining: number }
  | { type: 'ready'; remaining: number; timestamp: number }
  | { type: 'progress'; remaining: number; timestamp: number }
  | { type: 'fire'; timestamp: number; targetTime: number; actualDelay: number }
  | { type: 'stopped' }
  | { type: 'synced'; offset: number; calibratedTime: number }
  | { type: 'targetUpdated'; newTarget: number; remaining: number }
  | { type: 'status'; isRunning: boolean; targetTime: number | null; currentTime: number; remaining: number | null; serverOffset: number }

export type TimerWorkerHandler = (msg: TimerWorkerMessage) => void

let workerInstance: Worker | null = null
const listeners = new Set<TimerWorkerHandler>()

function dispatch(msg: TimerWorkerMessage) {
  listeners.forEach(fn => {
    try { fn(msg) } catch (e) { console.error('[TimerWorker] listener error:', e) }
  })
}

/** 获取（惰性创建）高精度计时 Worker 单例 */
export function getTimerWorker(): Worker | null {
  if (workerInstance) return workerInstance
  try {
    // Vite 会保留该 URL 字符串并解析为 public 目录下的静态资源
    const url = new URL('/timer-worker.js', window.location.origin).href
    workerInstance = new Worker(url)
    workerInstance.onmessage = (e: MessageEvent<TimerWorkerMessage>) => dispatch(e.data)
    workerInstance.onerror = (err) => {
      console.error('[TimerWorker] worker error:', err)
    }
  } catch (e) {
    console.warn('[TimerWorker] 创建 Worker 失败，将回退到主线程计时:', e)
    workerInstance = null
  }
  return workerInstance
}

/** 订阅 Worker 消息，返回取消订阅函数 */
export function onTimerMessage(handler: TimerWorkerHandler): () => void {
  listeners.add(handler)
  return () => listeners.delete(handler)
}

/** 同步服务器时间偏移给 Worker（应在阶段1时间校准后调用） */
export function syncServerOffset(offset: number) {
  getTimerWorker()?.postMessage({ type: 'sync', data: { offset } })
}

/** 启动倒计时，目标时间为「校准后的绝对毫秒时间戳」（Date.now() + serverOffset 同一时间轴） */
export function startPreciseTimer(targetTime: number) {
  getTimerWorker()?.postMessage({ type: 'start', data: { targetTime } })
}

/** 运行中更新目标时间 */
export function updateTimerTarget(targetTime: number) {
  getTimerWorker()?.postMessage({ type: 'updateTarget', data: { targetTime } })
}

/** 停止计时 */
export function stopPreciseTimer() {
  getTimerWorker()?.postMessage({ type: 'stop', data: {} })
}

/**
 * Promise 化的精确等待：等待到目标时间点（校准时间轴）触发。
 * @returns 是否成功由 Worker 触发；若 Worker 不可用或被停止则返回 false（调用方需自行回退处理）
 */
export function waitUntilCalibratedTime(
  targetTime: number,
  opts: { shouldAbort?: () => boolean; onTick?: (remainingMs: number) => void } = {},
): Promise<boolean> {
  const worker = getTimerWorker()
  if (!worker) return Promise.resolve(false)

  return new Promise<boolean>(resolve => {
    let settled = false
    let pollId: number | undefined

    const finish = (ok: boolean) => {
      if (settled) return
      settled = true
      unsubscribe()
      if (pollId !== undefined) clearInterval(pollId)
      resolve(ok)
    }

    const unsubscribe = onTimerMessage(msg => {
      if (msg.type === 'fire') {
        finish(true)
      } else if (msg.type === 'stopped') {
        finish(false)
      } else if (msg.type === 'progress' && opts.onTick) {
        opts.onTick(msg.remaining)
      }
    })

    // 轮询检查外部中止条件（Worker 消息是异步的，这里保证及时退出）
    pollId = window.setInterval(() => {
      if (opts.shouldAbort?.()) {
        stopPreciseTimer()
        finish(false)
      }
    }, 50)

    startPreciseTimer(targetTime)
  })
}
