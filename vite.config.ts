import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  base: process.env.BASE || '/',
  // 微信内置浏览器：iOS 14 / 安卓 X5、XWeb
  build: { target: ['es2020', 'safari14', 'chrome87'] },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
})
