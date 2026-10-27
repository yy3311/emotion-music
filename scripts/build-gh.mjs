#!/usr/bin/env node
/**
 * GitHub Pages 构建脚本（跨平台，Windows / macOS / Linux 通用）
 *
 * 作用：把 Vite 的 base 设为 /<仓库名>/，并打开「静态托管模式」，
 *       跳过仅在本地 npm run dev 时才存在的 /api 后端。
 *
 * 用法：
 *   node scripts/build-gh.mjs                # 仓库名自动取自 git remote / package.json
 *   node scripts/build-gh.mjs emotion-music  # 手动指定仓库名
 */
import { execSync, spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

function detectRepo() {
  if (process.argv[2]) return process.argv[2]
  try {
    const url = execSync('git remote get-url origin', { cwd: root, stdio: ['ignore', 'pipe', 'ignore'] })
      .toString().trim()
    const m = url.match(/\/([^/]+?)(\.git)?$/)
    if (m) return m[1]
  } catch (e) { /* 无 remote */ }
  return JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).name
}

const repo = detectRepo()
const base = `/${repo}/`
console.log(`[gh-pages] 仓库名=${repo}  base=${base}  静态托管模式=开`)

const r = spawnSync(
  process.platform === 'win32' ? 'npx.cmd' : 'npx',
  ['vite', 'build', `--base=${base}`],
  {
    cwd: root,
    stdio: 'inherit',
    env: { ...process.env, VITE_STATIC_DEPLOY: '1' },
    shell: process.platform === 'win32'
  }
)
process.exit(r.status ?? 1)
