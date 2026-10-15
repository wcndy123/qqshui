import JSZip from 'jszip'
import { saveAs } from 'file-saver'

// 所有源代码文件内容
const sourceFiles: Record<string, string> = {
  'package.json': `{
  "name": "tavern-sniper",
  "private": true,
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1"
  },
  "devDependencies": {
    "@types/react": "^18.3.12",
    "@types/react-dom": "^18.3.1",
    "@vitejs/plugin-react": "^4.3.4",
    "autoprefixer": "^10.4.20",
    "postcss": "^8.4.49",
    "tailwindcss": "^3.4.16",
    "typescript": "^5.6.3",
    "vite": "^6.0.3"
  }
}`,

  'vite.config.ts': `import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
})`,

  'tsconfig.json': `{
  "files": [],
  "references": [
    { "path": "./tsconfig.app.json" },
    { "path": "./tsconfig.node.json" }
  ]
}`,

  'tsconfig.app.json': `{
  "compilerOptions": {
    "tsBuildInfoFile": "./node_modules/.tmp/tsconfig.app.tsbuildinfo",
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "isolatedModules": true,
    "moduleDetection": "force",
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "noUncheckedSideEffectImports": true
  },
  "include": ["src"]
}`,

  'tsconfig.node.json': `{
  "compilerOptions": {
    "tsBuildInfoFile": "./node_modules/.tmp/tsconfig.node.tsbuildinfo",
    "target": "ES2022",
    "lib": ["ES2023"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "isolatedModules": true,
    "moduleDetection": "force",
    "noEmit": true,
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "noUncheckedSideEffectImports": true
  },
  "include": ["vite.config.ts"]
}`,

  'tailwind.config.js': `/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}`,

  'postcss.config.js': `export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}`,

  'index.html': `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>水浒Q传 - 好友酒馆自动巡查招募系统</title>
    <link
      rel="stylesheet"
      href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css"
    />
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>`,

  'README.md': `# 水浒Q传 - 好友酒馆自动巡查招募系统

## 项目介绍

这是一个自动巡查好友酒馆并抢招高品质武将的系统，包含：
- Web 控制面板（React + TypeScript + Tailwind CSS）
- Python 自动化脚本（tavern_sniper.py）

## 功能特性

- 🔍 自动巡查好友酒馆
- 🎯 智能识别紫色/橙色武将
- ⚡ 毫秒级精确抢招（保护期结束后立即招募）
- 🛡 保护期倒计时 + 时间校准
- 📊 详细日志记录

## 安装运行

### Web 控制面板

\`\`\`bash
# 安装依赖
npm install

# 启动开发服务器
npm run dev

# 构建生产版本
npm run build
\`\`\`

### Python 脚本

\`\`\`bash
# 安装依赖
pip install requests

# 编辑配置
# 修改 tavern_sniper.py 中的配置区

# 运行脚本
python tavern_sniper.py
\`\`\`

## 配置说明

### Web 控制面板

1. 打开浏览器访问 http://localhost:5173
2. 在"配置"标签页填入：
   - AccessToken（从抓包工具获取）
   - 好友短ID或昵称
   - 目标品质（紫色/橙色）
   - 抢招策略参数
3. 在"控制台"标签页点击"启动巡查"

### Python 脚本

编辑 \`tavern_sniper.py\` 顶部配置区：
- PHONE_NUMBER: 手机号
- PASSWORD: 密码
- DEVICE_FINGERPRINT: 设备指纹
- FRIEND_QUERIES: 好友短ID或昵称列表
- TARGET_QUALITIES: 目标品质
- SNIPE_ADVANCE_MS: 提前量（毫秒）

## 抢招策略

系统采用四阶段抢招策略：

1. **发现阶段**：慢轮询（60秒）发现目标
2. **校准阶段**：时间同步 + 倒计时
3. **预备阶段**：预查询 + 构建payload
4. **抢招阶段**：毫秒级精确发射

关键参数：
- 提前量：50ms（补偿网络延迟）
- 预查询：保护期结束前5秒
- 重试间隔：200ms（防止封控）

## 注意事项

⚠️ 本工具仅供学习研究使用，请遵守游戏规则，合理使用。

## 技术栈

- React 18
- TypeScript
- Tailwind CSS
- Vite
- Python 3
- requests

## License

MIT
`,
}

export async function downloadProject() {
  const zip = new JSZip()

  // 添加所有源代码文件
  for (const [path, content] of Object.entries(sourceFiles)) {
    zip.file(path, content)
  }

  // 添加 src 目录下的文件
  // 注意：这里需要动态读取文件内容，但由于构建后无法访问源代码
  // 我们会在组件中传入文件内容

  // 生成 zip 文件
  const blob = await zip.generateAsync({ type: 'blob' })
  
  // 下载
  saveAs(blob, 'tavern-sniper-project.zip')
}

export function addSourceFile(zip: JSZip, path: string, content: string) {
  zip.file(path, content)
}
