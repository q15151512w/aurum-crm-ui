import { fileURLToPath, URL } from 'node:url'
import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import AutoImport from 'unplugin-auto-import/vite'
import Components from 'unplugin-vue-components/vite'
import { ElementPlusResolver } from 'unplugin-vue-components/resolvers'

/**
 * Vite 配置
 *
 * 支持的配置项见 .env.development / .env.production
 */
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd())

  return {
    plugins: [
      vue(),

      // 自动导入 Vue / Pinia / Vue Router 的 API，不用每个文件写 import
      AutoImport({
        imports: ['vue', 'vue-router', 'pinia'],
        resolvers: [ElementPlusResolver()],
        dts: false // 用 JS 不用 TS，不生成类型声明文件
      }),

      // Element Plus 组件按需引入，减小打包体积
      Components({
        resolvers: [ElementPlusResolver()],
        dts: false
      })
    ],

    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url))
      }
    },

    css: {
      preprocessorOptions: {
        scss: {
          // Vite 5 默认用已废弃的 Sass legacy API，会刷屏 DEPRECATION WARNING。
          // 显式指定 modern-compiler 消除警告（Dart Sass 2.0 将移除 legacy API）
          api: 'modern-compiler'
        }
      }
    },

    server: {
      host: '0.0.0.0',
      // 用 5173（Vite 默认）而不是 80 —— Windows 上监听 80 需要管理员权限，
      // 且容易和 IIS / 其他服务冲突
      port: 5173,
      // 启动时自动打开浏览器。不想被弹窗打扰就改成 false
      open: false,

      // 开发环境把 /api 代理到后端，避免本地跨域
      // 后端地址通过 .env.development 的 VITE_APP_BASE_API 配置
      proxy: {
        [env.VITE_APP_BASE_API || '/api']: {
          target: env.VITE_APP_API_TARGET || 'http://localhost:8080',
          changeOrigin: true,
          rewrite: (path) => path.replace(new RegExp('^' + (env.VITE_APP_BASE_API || '/api')), '')
        }
      }
    },

    build: {
      outDir: 'dist',
      sourcemap: false,
      // 单文件超过 500KB 报警（Element Plus + ECharts 体积较大，按需引入后应低于该值）
      chunkSizeWarningLimit: 1500,
      rollupOptions: {
        output: {
          // 拆包：把体积大的第三方库单独打包，利于浏览器缓存。
          // ⚠️ 这里只列【实际被 import 的库】—— 列了没引入的库会产生
          //    "Generated an empty chunk" 警告。ECharts 等首页看板实现后再加回来。
          manualChunks: {
            vue: ['vue', 'vue-router', 'pinia'],
            elementPlus: ['element-plus', '@element-plus/icons-vue']
          }
        }
      }
    }
  }
})
