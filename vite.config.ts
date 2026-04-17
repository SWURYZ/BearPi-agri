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
