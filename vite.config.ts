import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import { mdDataPlugin } from './vite-plugin-md-data';

// ─────────────────────────────────────────────────────────────────────────────
//  📄 MD 文档配置
//  如果文档文件名或路径发生变化，只需修改这里即可，其他地方无需改动。
//  路径相对于项目根目录（vite.config.ts 所在位置）。
// ─────────────────────────────────────────────────────────────────────────────
export const MD_SOURCE_FILE = 'yannakakis.md';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
    base: '/db-trends/202604/',
    plugins: [
      react(),
      tailwindcss(),
      // 将 MD 文档实时解析为 virtual:md-data 虚拟模块
      mdDataPlugin(MD_SOURCE_FILE),
    ],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});
