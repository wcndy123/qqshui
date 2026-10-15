import { useState } from 'react'

const PYTHON_SCRIPT = `import time
import uuid
import requests

BASE_URL = "https://service.qjsh.top"

# ==================== 配置区 ====================
PHONE_NUMBER = "你的手机号"
PASSWORD = "你的密码"
DEVICE_FINGERPRINT = "你的设备指纹UUID"
SERVER_ID = "recharge-s1"

# 目标品质: WHITE, BLUE, PURPLE, ORANGE
TARGET_QUALITIES = ["PURPLE", "ORANGE"]

# 好友ID列表 (从抓包中获取)
FRIEND_IDS = [
    "d15f3677-67fc-4074-92c1-5aede87bb491",
    "616593b2-9544-49cb-9bde-20fbe5372c29",
    # 添加更多好友ID...
]

# 巡查间隔 (秒)
PATROL_INTERVAL = 60
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


def login_and_enter():
    """步骤 1：自动登录与选服换取 accessToken"""
    print("[*] 正在登录...")
    
    # 登录获取 accountToken
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

    # 选服获取 accessToken
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
    return True


def get_friend_list():
    """步骤 2：获取好友列表"""
    try:
        res = session.get(f"{BASE_URL}/api/v1/friends").json()
        if res.get("code") == "OK":
            friends = res["data"].get("friends", [])
            friend_ids = [
                f.get("friendId") or f.get("id") or f.get("playerId")
                for f in friends
            ]
            print(f"[*] 动态获取到 {len(friend_ids)} 个好友")
            return [fid for fid in friend_ids if fid]
    except Exception as e:
        print(f"[!] 动态获取好友列表失败: {e}")
    
    # 兜底：使用手动配置的好友ID
    print(f"[*] 使用手动配置的好友列表 ({len(FRIEND_IDS)} 人)")
    return FRIEND_IDS


def inspect_friend_tavern(friend_id):
    """步骤 3 & 4：巡查好友酒馆并偷取目标武将"""
    url = f"{BASE_URL}/api/v1/friend-cities/{friend_id}/tavern"
    
    try:
        resp = session.get(url).json()
    except Exception as e:
        print(f"  [-] 请求失败: {e}")
        return False

    if resp.get("code") != "OK":
        print(f"  [-] 查询失败: {resp.get('message')}")
        return False

    data = resp.get("data", {})
    candidates = data.get("candidates", [])
    fid_short = friend_id[:8]
    
    print(f"  [*] 好友 [{fid_short}...] 酒馆: {len(candidates)} 名候选武将")

    recruited_any = False
    
    for hero in candidates:
        name = hero.get("name")
        quality = hero.get("quality")
        star = hero.get("star")
        available = hero.get("recruitmentAvailable")
        cid = hero.get("candidateId")
        version = hero.get("version", 0)
        unavailable_reason = hero.get("recruitmentUnavailableReason", "")

        # 检查是否是目标品质且可招募
        if quality in TARGET_QUALITIES and available:
            quality_emoji = "🟠" if quality == "ORANGE" else "🟣"
            print(f"  [🔥] 发现目标！{quality_emoji}【{name}】{quality} {star}星")
            
            # 发起招募
            recruit_url = f"{BASE_URL}/api/v1/friend-cities/{friend_id}/tavern/recruitments"
            payload = {
                "operationId": str(uuid.uuid4()),
                "candidateId": cid,
                "expectedCandidateVersion": version
            }
            
            try:
                recruit_res = session.post(recruit_url, json=payload).json()
            except Exception as e:
                print(f"  [×] 招募请求失败: {e}")
                continue

            if recruit_res.get("code") == "OK":
                rdata = recruit_res["data"]
                cap = rdata.get("heroCapacity", {})
                copper = rdata.get("copperCost", 0)
                print(f"  [✓] 成功偷取【{name}】！花费铜钱: {copper}")
                print(f"      容量: {cap.get('owned')}/{cap.get('capacity')} "
                      f"(剩余: {cap.get('remaining')})")
                recruited_any = True
                
                # 检查是否满仓
                if cap.get("remaining", 1) <= 0:
                    print("[!] ⚠️ 武将背包已满！")
                    return "FULL"
                    
            elif recruit_res.get("code") == "HERO_CAPACITY_FULL":
                print("[!] ⚠️ 武将背包已满！")
                return "FULL"
            else:
                print(f"  [×] 招募失败: {recruit_res.get('message')}")
                
        elif quality in TARGET_QUALITIES and not available:
            print(f"  [🔒] 【{name}】{quality} {star}星 - 被保护 "
                  f"({unavailable_reason})")

    return recruited_any


def start_auto_patrol():
    """全自动巡查主循环"""
    print("=" * 50)
    print("  水浒Q传 - 好友酒馆自动巡查招募系统")
    print("=" * 50)
    
    # 登录
    if not login_and_enter():
        print("[!] 登录失败，程序退出")
        return
    
    # 获取好友列表
    friend_ids = get_friend_list()
    if not friend_ids:
        print("[!] 没有可巡查的好友")
        return
    
    round_count = 0
    
    while True:
        round_count += 1
        print(f"\\n{'='*40}")
        print(f"  第 {round_count} 轮巡查 (共 {len(friend_ids)} 个好友)")
        print(f"{'='*40}")
        
        full_bag = False
        
        for i, fid in enumerate(friend_ids):
            if not fid:
                continue
            
            print(f"\\n[{i+1}/{len(friend_ids)}] 巡查好友 {fid[:8]}...")
            result = inspect_friend_tavern(fid)
            
            if result == "FULL":
                full_bag = True
                break
            
            time.sleep(1.0)  # 防限流
        
        if full_bag:
            print("\\n[!] 背包已满，请先解雇低品质武将")
            print("[*] 5分钟后再次尝试...")
            time.sleep(300)
        else:
            print(f"\\n[*] 本轮巡查完毕，{PATROL_INTERVAL}秒后开始下一轮...")
            time.sleep(PATROL_INTERVAL)


if __name__ == "__main__":
    try:
        start_auto_patrol()
    except KeyboardInterrupt:
        print("\\n[*] 用户手动停止")
    except Exception as e:
        print(f"\\n[!] 程序异常: {e}")`

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
    a.download = 'tavern_auto_recruit.py'
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
            Python 自动招募脚本
          </h3>
          <p className="text-xs text-slate-400 mt-1">tavern_auto_recruit.py · 完整可运行版本</p>
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

      {/* Code Block */}
      <div className="bg-white/5 rounded-xl border border-white/10 backdrop-blur-sm overflow-hidden">
        <div className="px-4 py-2 border-b border-white/10 bg-black/20 flex items-center gap-2">
          <div className="flex gap-1.5">
            <div className="w-3 h-3 rounded-full bg-red-500/60" />
            <div className="w-3 h-3 rounded-full bg-yellow-500/60" />
            <div className="w-3 h-3 rounded-full bg-green-500/60" />
          </div>
          <span className="text-xs text-slate-400 ml-2 font-mono">tavern_auto_recruit.py</span>
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
            <p>在 FRIEND_IDS 列表中填入你要巡查的好友UUID</p>
          </div>
          <div className="flex gap-2">
            <span className="text-amber-400 font-bold shrink-0">4.</span>
            <p>运行脚本: <code className="bg-black/30 px-1.5 py-0.5 rounded text-amber-200">python tavern_auto_recruit.py</code></p>
          </div>
          <div className="flex gap-2">
            <span className="text-amber-400 font-bold shrink-0">5.</span>
            <p>脚本会自动循环巡查所有好友酒馆，发现紫色/橙色武将立即偷取</p>
          </div>
        </div>
        <div className="mt-4 p-3 bg-red-500/5 border border-red-500/20 rounded-lg">
          <p className="text-xs text-red-300/80">
            ⚠️ <strong>注意：</strong>请合理控制巡查频率，避免触发服务器限流。建议间隔不低于60秒。
          </p>
        </div>
      </div>
    </div>
  )
}
