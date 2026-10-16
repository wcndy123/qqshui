// 高精度计时 Worker
// 不受浏览器后台标签页节流影响

let targetTime = null;
let checkInterval = null;
let isRunning = false;

// 使用 performance.now() 获得更高精度
const startTime = performance.now();
let serverTimeOffset = 0; // 服务器时间偏移（毫秒）

// 获取当前校准后的时间（毫秒）
function getCalibratedTime() {
  return Date.now() + serverTimeOffset;
}

// 高精度忙等待
function busyWaitUntil(targetMs) {
  const start = performance.now();
  while (getCalibratedTime() < targetMs) {
    // 忙等待，确保精度
    // 如果等待时间超过 10ms，让出线程避免阻塞
    if (performance.now() - start > 10) {
      break;
    }
  }
}

// 检查是否到达目标时间
function checkTime() {
  if (!isRunning || !targetTime) return;

  const now = getCalibratedTime();
  const remaining = targetTime - now;

  // 提前 100ms 发送 ready 通知
  if (remaining <= 100 && remaining > 50) {
    self.postMessage({
      type: 'ready',
      remaining: remaining,
      timestamp: now
    });
  }

  // 到达目标时间（允许 1ms 误差）
  if (remaining <= 1) {
    // 忙等待最后 1ms
    busyWaitUntil(targetTime);
    
    self.postMessage({
      type: 'fire',
      timestamp: getCalibratedTime(),
      targetTime: targetTime,
      actualDelay: getCalibratedTime() - targetTime
    });

    // 停止计时
    stopTimer();
  }
  // 距离目标还很远，降低检查频率
  else if (remaining > 1000) {
    clearInterval(checkInterval);
    checkInterval = setInterval(checkTime, 100); // 100ms 检查一次
  }
  // 距离目标 1 秒内，提高检查频率
  else if (remaining > 100) {
    clearInterval(checkInterval);
    checkInterval = setInterval(checkTime, 10); // 10ms 检查一次
  }
  // 距离目标 100ms 内，最高频率检查
  else {
    clearInterval(checkInterval);
    checkInterval = setInterval(checkTime, 1); // 1ms 检查一次
  }

  // 发送进度更新
  if (remaining > 0) {
    self.postMessage({
      type: 'progress',
      remaining: remaining,
      timestamp: now
    });
  }
}

function startTimer(target) {
  targetTime = target;
  isRunning = true;
  
  // 初始检查频率
  const now = getCalibratedTime();
  const remaining = targetTime - now;
  
  if (remaining > 1000) {
    checkInterval = setInterval(checkTime, 100);
  } else if (remaining > 100) {
    checkInterval = setInterval(checkTime, 10);
  } else {
    checkInterval = setInterval(checkTime, 1);
  }

  self.postMessage({
    type: 'started',
    targetTime: targetTime,
    startTime: now,
    remaining: remaining
  });
}

function stopTimer() {
  isRunning = false;
  if (checkInterval) {
    clearInterval(checkInterval);
    checkInterval = null;
  }
  targetTime = null;
}

// 处理主线程消息
self.onmessage = function(e) {
  const { type, data } = e.data;

  switch (type) {
    case 'start':
      // 开始倒计时到指定时间
      startTimer(data.targetTime);
      break;

    case 'stop':
      // 停止计时
      stopTimer();
      self.postMessage({ type: 'stopped' });
      break;

    case 'sync':
      // 同步服务器时间偏移
      serverTimeOffset = data.offset || 0;
      self.postMessage({
        type: 'synced',
        offset: serverTimeOffset,
        calibratedTime: getCalibratedTime()
      });
      break;

    case 'updateTarget':
      // 更新目标时间（用于抢招过程中的时间调整）
      if (isRunning) {
        targetTime = data.targetTime;
        self.postMessage({
          type: 'targetUpdated',
          newTarget: targetTime,
          remaining: targetTime - getCalibratedTime()
        });
      }
      break;

    case 'getStatus':
      // 获取当前状态
      self.postMessage({
        type: 'status',
        isRunning: isRunning,
        targetTime: targetTime,
        currentTime: getCalibratedTime(),
        remaining: targetTime ? targetTime - getCalibratedTime() : null,
        serverOffset: serverTimeOffset
      });
      break;
  }
};

// Worker 初始化完成
self.postMessage({ type: 'initialized' });
