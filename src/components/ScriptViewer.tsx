import { useState } from 'react'

const PYTHON_SCRIPT = `import time
import uuid
import requests
from datetime import datetime, timezone

BASE_URL = "https://service.qjsh.top"

# ==================== 配置区 ====================
PHONE_NUMBER = "你的手机号"
PASSWORD = "你的密码"
DEVICE_FINGERPRINT = "你的设备指纹UUID"
SERVER_ID = "recharge-s1"

# 目标品质: WHITE, BLUE, PURPLE, ORANGE
TARGET_QUALITIES = ["PURPLE", "ORANGE"]

# 好友列表 (短ID或昵称，脚本会自动搜索转换为内部UUID)
FRIEND_QUERIES = [
    "100033",      # 短ID
    "戏言",        # 昵称
    # 添加更多好友的短ID或昵称...
]

# 巡查间隔 (秒)
PATROL_INTERVAL = 60

# ==================== 抢招策略配置 ====================
# 提前量(ms): 在保护期结束前多少毫秒发起请求，补偿网络延迟
# 建议值: 30-80ms (根据你的网络延迟调整)
SNIPE_ADVANCE_MS = 50

# 预查询时间(秒): 保护期结束前多少秒重新查询获取最新数据
SNIPE_PRE_QUERY_SECONDS = 5

# 最大重试次数
SNIPE_MAX_RETRIES = 3

# 重试间隔(ms): 两次招募请求之间的最小间隔
SNIPE_RETRY_INTERVAL_MS = 200

# 是否启用自动抢招
AUTO_SNIPE = True
# ==================== 配置区结束 ====================

session = requests.Session()
session.trust_env = False
session.headers.update({
    "accept": "application/json",
    "content-type": "application/json",
    "origin": "https://qjsh.top",
    "referer": "https://qjsh.top/",
    "user-agent": "Mozilla/5.0 (Linux; Android 16; Pixel 10) "
                  "AppleWebKit/537.36 (KHTML, like Gecko) "
                  "Edg/155.0.0.0 Mobile Safari/537.36"
})

# 服务器时间偏移量 (毫秒)
server_time_offset_ms = 0


def get_server_now():
    """获取校准后的当前服务器时间"""
    return datetime.now(timezone.utc).timestamp() * 1000 + server_time_offset_ms


def calibrate_time():
    """通过任意接口获取服务器时间，计算本地与服务器时间偏移"""
    global server_time_offset_ms
    local_before = datetime.now(timezone.utc).timestamp() * 1000
    
    resp = session.get(f"{BASE_URL}/api/v1/tavern").json()
    
    local_after = datetime.now(timezone.utc).timestamp() * 1000
    local_mid = (local_before + local_after) / 2
    
    if resp.get("code") == "OK":
        server_time_str = resp["data"].get("serverTime")
        if server_time_str:
            server_time = datetime.fromisoformat(
                server_time_str.replace("Z", "+00:00")
            ).timestamp() * 1000
            server_time_offset_ms = server_time - local_mid
            print(f"[*] 时间校准完成: 服务器偏移 = {server_time_offset_ms:.1f}ms")
            return True
    
    print("[!] 时间校准失败")
    return False


def login_and_enter():
    """步骤 1：自动登录与选服换取 accessToken"""
    print("[*] 正在登录...")
    
    login_res = session.post(f"{BASE_URL}/api/v1/auth/password/login", json={
        "releaseId": "dy-recharge-prod-water-v1-0.1.0",
        "clientVersion": "0.1.0",
        "deviceFingerprint": DEVICE_FINGERPRINT,
        "phoneNumber": PHONE_NUMBER,
        "password": PASSWORD
    }).json()
    
    if login_res.get("code") != "OK":
        print(f"[!] 登录失败: {login_res.get('message')}")
        return False
    
    account_token = login_res["data"]["accountToken"]
    print("[*] 登录成功，正在选服...")

    enter_res = session.post(
        f"{BASE_URL}/api/v1/auth/servers/enter",
        headers={"authorization": f"Bearer {account_token}"},
        json={"serverId": SERVER_ID}
    ).json()
    
    if enter_res.get("code") != "OK":
        print(f"[!] 选服失败: {enter_res.get('message')}")
        return False
    
    access_token = enter_res["data"]["accessToken"]
    session.headers["authorization"] = f"Bearer {access_token}"
    print("[✓] 登录进服成功！")
    
    # 登录后立即校准时间
    calibrate_time()
    return True


def search_player(query):
    """通过短ID或昵称搜索玩家，返回内部playerId"""
    results = []
    is_numeric = query.strip().isdigit()
    
    if is_numeric:
        # 纯数字 → 同时搜索短ID和昵称（昵称也可能是纯数字）
        for search_type in ["SHORT_ID", "NAME"]:
            try:
                res = session.get(
                    f"{BASE_URL}/api/v1/player-search",
                    params={"type": search_type, "query": query, "limit": 20}
                ).json()
                if res.get("code") == "OK":
                    for p in res["data"].get("players", []):
                        if p["playerId"] not in [r["playerId"] for r in results]:
                            results.append(p)
            except Exception:
                pass
    else:
        # 含文字 → 只搜索昵称
        try:
            res = session.get(
                f"{BASE_URL}/api/v1/player-search",
                params={"type": "NAME", "query": query, "limit": 20}
            ).json()
            if res.get("code") == "OK":
                results = res["data"].get("players", [])
        except Exception:
            pass
    
    return results


def get_friend_list():
    """步骤 2：通过短ID/昵称搜索获取好友的内部playerId列表"""
    friend_map = {}  # playerId -> player info
    
    for query in FRIEND_QUERIES:
        print(f"[*] 搜索好友: {query}")
        players = search_player(query)
        
        if players:
            for p in players:
                pid = p["playerId"]
                name = p.get("displayName", "?")
                sid = p.get("shortId", "?")
                print(f"    → 找到: {name} (ID:{sid}, UUID:{pid[:8]}...)")
                friend_map[pid] = p
        else:
            print(f"    → 未找到匹配的玩家")
    
    print(f"[*] 共解析到 {len(friend_map)} 个好友")
    return list(friend_map.values())


def inspect_friend_tavern(friend_id):
    """巡查好友酒馆，返回候选武将列表和保护期信息"""
    url = f"{BASE_URL}/api/v1/friend-cities/{friend_id}/tavern"
    
    try:
        resp = session.get(url).json()
    except Exception as e:
        print(f"  [-] 请求失败: {e}")
        return None, None, None

    if resp.get("code") != "OK":
        print(f"  [-] 查询失败: {resp.get('message')}")
        return None, None, None

    data = resp.get("data", {})
    candidates = data.get("candidates", [])
    protection_ends_at = data.get("protectionEndsAt")
    server_time = data.get("serverTime")
    
    # 每次请求都更新时间偏移
    if server_time:
        global server_time_offset_ms
        local_now = datetime.now(timezone.utc).timestamp() * 1000
        server_now = datetime.fromisoformat(
            server_time.replace("Z", "+00:00")
        ).timestamp() * 1000
        server_time_offset_ms = server_now - local_now
    
    return candidates, protection_ends_at, data


def is_protected(protection_ends_at):
    """判断当前是否在保护期内"""
    if not protection_ends_at:
        return False
    protect_end = datetime.fromisoformat(
        protection_ends_at.replace("Z", "+00:00")
    ).timestamp() * 1000
    return get_server_now() < protect_end


def get_protection_remaining_ms(protection_ends_at):
    """获取保护期剩余毫秒数"""
    if not protection_ends_at:
        return 0
    protect_end = datetime.fromisoformat(
        protection_ends_at.replace("Z", "+00:00")
    ).timestamp() * 1000
    return max(0, protect_end - get_server_now())


def execute_snipe(friend_id, candidate, protection_ends_at):
    """
    抢招核心逻辑：
    1. 等待到预查询时间 → 重新获取最新数据
    2. 等待到发射时间 → 提前 advance_ms 发起请求
    3. 失败则重试，间隔 retry_interval_ms
    """
    name = candidate["name"]
    quality = candidate["quality"]
    star = candidate["star"]
    quality_emoji = "🟠" if quality == "ORANGE" else "🟣"
    
    remaining_ms = get_protection_remaining_ms(protection_ends_at)
    remaining_sec = remaining_ms / 1000
    
    print(f"\\n  {'='*40}")
    print(f"  🎯 抢招目标: {quality_emoji}【{name}】{quality} {star}星")
    print(f"  🛡 保护期剩余: {remaining_sec:.1f}秒")
    print(f"  ⏰ 服务器偏移: {server_time_offset_ms:.1f}ms")
    print(f"  {'='*40}")
    
    # 阶段1: 等待到预查询时间
    pre_query_wait_ms = remaining_ms - (SNIPE_PRE_QUERY_SECONDS * 1000)
    if pre_query_wait_ms > 0:
        print(f"  [*] 等待 {SNIPE_PRE_QUERY_SECONDS}秒 后预查询...")
        time.sleep(pre_query_wait_ms / 1000)
    
    # 阶段2: 预查询 - 获取最新的 candidateId 和 version
    print(f"  [*] 预查询获取最新数据...")
    candidates, _, _ = inspect_friend_tavern(friend_id)
    if not candidates:
        print(f"  [!] 预查询失败，放弃抢招")
        return False
    
    # 找到目标武将的最新数据
    latest = None
    for c in candidates:
        if c.get("heroCode") == candidate.get("heroCode") or c.get("name") == name:
            latest = c
            break
    
    if not latest:
        # 如果找不到完全匹配的，取第一个目标品质的
        for c in candidates:
            if c.get("quality") in TARGET_QUALITIES:
                latest = c
                break
    
    if not latest:
        print(f"  [!] 预查询未找到目标武将，可能被招募走了")
        return False
    
    cid = latest["candidateId"]
    version = latest.get("version", 0)
    print(f"  [*] 最新数据: candidateId={cid[:8]}... version={version}")
    
    # 阶段3: 计算发射时间并等待
    protect_end_ms = datetime.fromisoformat(
        protection_ends_at.replace("Z", "+00:00")
    ).timestamp() * 1000
    fire_time_ms = protect_end_ms - SNIPE_ADVANCE_MS
    
    current_ms = get_server_now()
    wait_until_fire_ms = fire_time_ms - current_ms
    
    if wait_until_fire_ms > 0:
        print(f"  [*] 准备就绪，{(wait_until_fire_ms/1000):.3f}秒后发射 "
              f"(提前{SNIPE_ADVANCE_MS}ms补偿网络延迟)")
        # 精确等待：粗等 + 细等
        if wait_until_fire_ms > 100:
            time.sleep((wait_until_fire_ms - 50) / 1000)
        # 忙等待最后50ms确保精度
        while get_server_now() < fire_time_ms:
            pass
    
    # 阶段4: 发射！
    recruit_url = f"{BASE_URL}/api/v1/friend-cities/{friend_id}/tavern/recruitments"
    payload = {
        "operationId": str(uuid.uuid4()),
        "candidateId": cid,
        "expectedCandidateVersion": version
    }
    
    for attempt in range(1, SNIPE_MAX_RETRIES + 1):
        fire_timestamp = datetime.now().strftime("%H:%M:%S.%f")[:-3]
        print(f"  ⚡ 第{attempt}次发射! [{fire_timestamp}]")
        
        try:
            recruit_res = session.post(recruit_url, json=payload).json()
        except Exception as e:
            print(f"  [×] 请求异常: {e}")
            if attempt < SNIPE_MAX_RETRIES:
                time.sleep(SNIPE_RETRY_INTERVAL_MS / 1000)
            continue
        
        code = recruit_res.get("code")
        
        if code == "OK":
            rdata = recruit_res["data"]
            copper = rdata.get("copperCost", 0)
            cap = rdata.get("heroCapacity", {})
            print(f"  [✓] ✅ 成功偷取【{name}】! 第{attempt}次尝试")
            print(f"      花费铜钱: {copper} | 容量: "
                  f"{cap.get('owned')}/{cap.get('capacity')}")
            return True
        
        elif code == "CANDIDATE_PROTECTED":
            print(f"  [×] 仍在保护期内! (提前量不够)")
            if attempt < SNIPE_MAX_RETRIES:
                time.sleep(SNIPE_RETRY_INTERVAL_MS / 1000)
        
        elif code == "HERO_CAPACITY_FULL":
            print(f"  [!] 武将背包已满!")
            return False
        
        elif code == "CANDIDATE_NOT_AVAILABLE":
            print(f"  [×] 已被他人抢先招募!")
            return False
        
        else:
            msg = recruit_res.get("message", "未知错误")
            print(f"  [×] 失败: {msg}")
            if attempt < SNIPE_MAX_RETRIES:
                time.sleep(SNIPE_RETRY_INTERVAL_MS / 1000)
    
    print(f"  [!] 抢招失败，已尝试{SNIPE_MAX_RETRIES}次")
    return False


def start_auto_patrol():
    """全自动巡查主循环"""
    print("=" * 50)
    print("  水浒Q传 - 好友酒馆自动巡查招募系统")
    print("  保护期倒计时 + 毫秒级抢招")
    print("=" * 50)
    print(f"  抢招模式: {'✅ 开启' if AUTO_SNIPE else '❌ 关闭'}")
    print(f"  提前量: {SNIPE_ADVANCE_MS}ms | 重试: {SNIPE_MAX_RETRIES}次")
    print(f"  预查询: {SNIPE_PRE_QUERY_SECONDS}秒前")
    print("=" * 50)
    
    # 登录
    if not login_and_enter():
        print("[!] 登录失败，程序退出")
        return
    
    # 获取好友列表
    friends = get_friend_list()
    if not friends:
        print("[!] 没有可巡查的好友")
        return
    
    round_count = 0
    
    while True:
        round_count += 1
        print(f"\\n{'='*50}")
        print(f"  第 {round_count} 轮巡查 (共 {len(friends)} 个好友)")
        print(f"{'='*50}")
        
        # 每轮开始前重新校准时间
        calibrate_time()
        
        snipe_targets = []  # 需要等待保护期结束的目标
        
        for i, friend in enumerate(friends):
            fid = friend["playerId"]
            fname = friend.get("displayName", "?")
            fsid = friend.get("shortId", "?")
            
            print(f"\\n[{i+1}/{len(friends)}] 🔍 巡查【{fname}】(#{fsid})")
            
            candidates, protection_ends_at, data = inspect_friend_tavern(fid)
            if not candidates:
                continue
            
            protected = is_protected(protection_ends_at)
            remaining_sec = get_protection_remaining_ms(protection_ends_at) / 1000
            
            # 筛选目标品质武将
            targets = [c for c in candidates if c.get("quality") in TARGET_QUALITIES]
            
            if targets:
                if protected:
                    print(f"  🔥 发现目标! 但保护期内 (剩余{remaining_sec:.0f}秒)")
                    for t in targets:
                        q = t["quality"]
                        emoji = "🟠" if q == "ORANGE" else "🟣"
                        print(f"    {emoji}【{t['name']}】{q} {t['star']}星")
                    
                    if AUTO_SNIPE:
                        # 选择最高品质目标
                        best = sorted(targets, key=lambda x: (
                            2 if x["quality"] == "ORANGE" else
                            1 if x["quality"] == "PURPLE" else 0
                        ), reverse=True)[0]
                        snipe_targets.append({
                            "friend_id": fid,
                            "candidate": best,
                            "protection_ends_at": protection_ends_at,
                            "friend_name": fname,
                        })
                else:
                    # 保护期已过，直接尝试招募
                    available = [t for t in targets if t.get("recruitmentAvailable")]
                    if available:
                        print(f"  🔥 发现可招募目标! 立即招募...")
                        target = available[0]
                        recruit_url = f"{BASE_URL}/api/v1/friend-cities/{fid}/tavern/recruitments"
                        payload = {
                            "operationId": str(uuid.uuid4()),
                            "candidateId": target["candidateId"],
                            "expectedCandidateVersion": target.get("version", 0)
                        }
                        try:
                            res = session.post(recruit_url, json=payload).json()
                            if res.get("code") == "OK":
                                print(f"  ✅ 成功偷取【{target['name']}】!")
                            else:
                                print(f"  ❌ 招募失败: {res.get('message')}")
                        except Exception as e:
                            print(f"  ❌ 请求异常: {e}")
                    else:
                        print(f"  目标武将被保护中，跳过")
            else:
                print(f"  无目标品质武将")
            
            time.sleep(1.0)  # 好友间间隔
        
        # 抢招阶段：对需要等待的目标执行精确抢招
        if snipe_targets and AUTO_SNIPE:
            print(f"\\n{'='*50}")
            print(f"  🎯 发现 {len(snipe_targets)} 个待抢目标，进入抢招模式!")
            print(f"{'='*50}")
            
            # 按保护期结束时间排序，先抢最先结束的
            snipe_targets.sort(key=lambda x: x["protection_ends_at"])
            
            for target in snipe_targets:
                print(f"\\n  → 准备抢招【{target['friend_name']}】的武将...")
                execute_snipe(
                    target["friend_id"],
                    target["candidate"],
                    target["protection_ends_at"]
                )
                time.sleep(1.0)
        
        print(f"\\n[*] 本轮巡查完毕，{PATROL_INTERVAL}秒后开始下一轮...")
        time.sleep(PATROL_INTERVAL)


if __name__ == "__main__":
    try:
        start_auto_patrol()
    except KeyboardInterrupt:
        print("\\n[*] 用户手动停止")
    except Exception as e:
        print(f"\\n[!] 程序异常: {e}")
        import traceback
        traceback.print_exc()`

export default function ScriptViewer() {
  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
    navigator.clipboard.writeText(PYTHON_SCRIPT)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleDownload = () => {
    const blob = new Blob([PYTHON_SCRIPT], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'tavern_sniper.py'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-white/5 rounded-xl border border-white/10 p-4 backdrop-blur-sm flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-amber-300 flex items-center gap-2">
            <i className="fa-brands fa-python text-yellow-400" />
            Python 抢招脚本
          </h3>
          <p className="text-xs text-slate-400 mt-1">tavern_sniper.py · 保护期倒计时 + 毫秒级精确抢招</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleCopy}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              copied
                ? 'bg-green-500/20 text-green-300 border border-green-500/30'
                : 'bg-white/10 text-slate-300 border border-white/10 hover:bg-white/20'
            }`}
          >
            {copied ? '✓ 已复制' : '📋 复制'}
          </button>
          <button
            onClick={handleDownload}
            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-amber-500/20 text-amber-300 border border-amber-500/30 hover:bg-amber-500/30 transition-all"
          >
            ⬇ 下载 .py
          </button>
        </div>
      </div>

      {/* Strategy Summary */}
      <div className="bg-gradient-to-r from-red-500/10 to-amber-500/10 rounded-xl border border-red-500/20 p-4 backdrop-blur-sm">
        <h4 className="text-sm font-semibold text-red-300 mb-2">⚡ 抢招策略核心</h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
          <div className="bg-black/20 rounded-lg p-2.5">
            <p className="text-amber-300 font-medium mb-1">🕐 时间校准</p>
            <p className="text-slate-400">每次请求获取 serverTime，计算本地与服务器偏移量，确保倒计时精确</p>
          </div>
          <div className="bg-black/20 rounded-lg p-2.5">
            <p className="text-amber-300 font-medium mb-1">🎯 提前发射</p>
            <p className="text-slate-400">在保护期结束前 50ms 发起请求，补偿网络传输延迟，确保请求到达时刚好解封</p>
          </div>
          <div className="bg-black/20 rounded-lg p-2.5">
            <p className="text-amber-300 font-medium mb-1">🔁 智能重试</p>
            <p className="text-slate-400">失败后间隔 200ms 重试，最多 3 次。避免疯狂点击触发封控</p>
          </div>
        </div>
      </div>

      {/* Code Block */}
      <div className="bg-white/5 rounded-xl border border-white/10 backdrop-blur-sm overflow-hidden">
        <div className="px-4 py-2 border-b border-white/10 bg-black/20 flex items-center gap-2">
          <div className="flex gap-1.5">
            <div className="w-3 h-3 rounded-full bg-red-500/60" />
            <div className="w-3 h-3 rounded-full bg-yellow-500/60" />
            <div className="w-3 h-3 rounded-full bg-green-500/60" />
          </div>
          <span className="text-xs text-slate-400 ml-2 font-mono">tavern_sniper.py</span>
        </div>
        <div className="overflow-x-auto p-4 max-h-[600px] overflow-y-auto">
          <pre className="text-xs font-mono text-slate-300 leading-relaxed">
            <code>{PYTHON_SCRIPT}</code>
          </pre>
        </div>
      </div>

      {/* Usage Instructions */}
      <div className="bg-white/5 rounded-xl border border-white/10 p-5 backdrop-blur-sm">
        <h3 className="text-base font-semibold text-amber-300 mb-3 flex items-center gap-2">
          <i className="fa-solid fa-circle-info text-blue-400" />
          使用说明
        </h3>
        <div className="space-y-3 text-sm text-slate-300">
          <div className="flex gap-2">
            <span className="text-amber-400 font-bold shrink-0">1.</span>
            <p>安装依赖: <code className="bg-black/30 px-1.5 py-0.5 rounded text-amber-200">pip install requests</code></p>
          </div>
          <div className="flex gap-2">
            <span className="text-amber-400 font-bold shrink-0">2.</span>
            <p>修改脚本顶部配置区的手机号、密码、设备指纹</p>
          </div>
          <div className="flex gap-2">
            <span className="text-amber-400 font-bold shrink-0">3.</span>
            <p>在 FRIEND_QUERIES 列表中填入好友的短ID或游戏昵称</p>
          </div>
          <div className="flex gap-2">
            <span className="text-amber-400 font-bold shrink-0">4.</span>
            <p>调整抢招策略参数（提前量、重试次数等）</p>
          </div>
          <div className="flex gap-2">
            <span className="text-amber-400 font-bold shrink-0">5.</span>
            <p>运行脚本: <code className="bg-black/30 px-1.5 py-0.5 rounded text-amber-200">python tavern_sniper.py</code></p>
          </div>
        </div>
        
        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="p-3 bg-amber-500/5 border border-amber-500/20 rounded-lg">
            <p className="text-xs text-amber-300/80">
              💡 <strong>提前量调整建议：</strong>
              <br />- 网络好(延迟&lt;50ms): 30ms
              <br />- 网络一般(50-100ms): 50ms
              <br />- 网络差(&gt;100ms): 80-100ms
            </p>
          </div>
          <div className="p-3 bg-red-500/5 border border-red-500/20 rounded-lg">
            <p className="text-xs text-red-300/80">
              ⚠️ <strong>防封控注意：</strong>
              <br />- 重试间隔不低于 200ms
              <br />- 保护期内不要发起招募请求
              <br />- 好友间巡查间隔至少 1 秒
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
