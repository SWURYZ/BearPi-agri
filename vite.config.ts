import { defineConfig, loadEnv } from 'vite'
import path from 'path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'


function figmaAssetResolver() {
  return {
    name: 'figma-asset-resolver',
    resolveId(id) {
      if (id.startsWith('figma:asset/')) {
        const filename = id.replace('figma:asset/', '')
        return path.resolve(__dirname, 'src/assets', filename)
      }
    },
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const apiProxyTarget = env.VITE_API_PROXY_TARGET || 'http://localhost:8082'
  const agriAgentProxyTarget = env.VITE_AGRI_AGENT_PROXY_TARGET || 'http://localhost:8085'
  const faceProxyTarget = env.VITE_FACE_PROXY_TARGET || 'http://localhost:8090'
  const historicalProxyTarget = env.VITE_HISTORICAL_PROXY_TARGET || 'http://localhost:8087'
  const smartDecisionProxyTarget = env.VITE_SMART_DECISION_PROXY_TARGET || 'http://localhost:8089'
  const pestRecognitionProxyTarget = env.VITE_PEST_RECOGNITION_PROXY_TARGET || 'http://localhost:5000'
  // 新增:按端口分发的后端服务代理,确保手机访问 :5173 时前端能通过代理到达各微服务
  const deviceControlProxyTarget = env.VITE_DEVICE_CONTROL_PROXY_TARGET || 'http://localhost:8083'
  const lightScheduleProxyTarget = env.VITE_LIGHT_SCHEDULE_PROXY_TARGET || 'http://localhost:8084'
  const greenhouseMonitorProxyTarget = env.VITE_GREENHOUSE_MONITOR_PROXY_TARGET || 'http://localhost:8086'
  const compositeProxyTarget = env.VITE_COMPOSITE_PROXY_TARGET || 'http://localhost:8088'
  const thresholdAlertProxyTarget = env.VITE_THRESHOLD_ALERT_PROXY_TARGET || 'http://localhost:8091'

  return {
    plugins: [
      figmaAssetResolver(),
      // The React and Tailwind plugins are both required for Make, even if
      // Tailwind is not being actively used – do not remove them
      react(),
      tailwindcss(),
    ],
    resolve: {
      alias: {
        // Alias @ to the src directory
        '@': path.resolve(__dirname, './src'),
      },
    },
    server: apiProxyTarget
      ? {
        host: true,
        // 允许通过 cloudflared / ngrok 等隧道域名访问 dev server
        allowedHosts: [".trycloudflare.com", ".ngrok-free.app", ".ngrok.io"],
        proxy: {
          '/api/v1/agri-agent': {
            target: agriAgentProxyTarget,
            changeOrigin: true,
            ws: true,
          },
          '/api/v1/smart-decision': {
            target: smartDecisionProxyTarget,
            changeOrigin: true,
          },
          '/api/insect': {
            target: pestRecognitionProxyTarget,
            changeOrigin: true,
            rewrite: (p) => p.replace(/^\/api\/insect/, '/api'),
          },
          '/api/plant': {
            target: pestRecognitionProxyTarget,
            changeOrigin: true,
          },
          '/api/face': {
            target: faceProxyTarget,
            changeOrigin: true,
          },
          '/api/auth': {
            target: faceProxyTarget,
            changeOrigin: true,
          },
          '/api/greenhouses': {
            target: historicalProxyTarget,
            changeOrigin: true,
            ws: true,
          },
          // ── 按端口精准分发的后端服务代理 ──(必须放在通配 '/api' 之前)
          '/api/v1/device-control': {
            target: deviceControlProxyTarget,
            changeOrigin: true,
          },
          '/api/v1/light-schedule': {
            target: lightScheduleProxyTarget,
            changeOrigin: true,
          },
          '/api/v1/greenhouse-monitor': {
            target: greenhouseMonitorProxyTarget,
            changeOrigin: true,
            ws: true,
          },
          '/api/v1/composite-condition': {
            target: compositeProxyTarget,
            changeOrigin: true,
          },
          '/api/v1/threshold-alert': {
            target: thresholdAlertProxyTarget,
            changeOrigin: true,
          },
          '/api': {
            target: apiProxyTarget,
            changeOrigin: true,
            ws: true,
          },
        },
      }
      : undefined,

    // File types to support raw imports. Never add .css, .tsx, or .ts files to this.
    assetsInclude: ['**/*.svg', '**/*.csv'],
  }
})
