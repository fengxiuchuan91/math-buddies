// 本机预览构建产物，响应头与 deploy/mathbuddies.caddy 一致，用来验证 CSP 不会拦住页面。
//   node scripts/serve-dist.mjs [端口]

import { createServer } from 'node:http'
import { existsSync, readFileSync, statSync } from 'node:fs'
import { extname, join, normalize } from 'node:path'

const root = new URL('../dist/', import.meta.url).pathname
const caddy = readFileSync(new URL('../deploy/mathbuddies.caddy', import.meta.url), 'utf8')
const csp = caddy.match(/Content-Security-Policy "([^"]+)"/)[1]
const perms = caddy.match(/Permissions-Policy "([^"]+)"/)[1]
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.png': 'image/png' }

createServer((req, res) => {
  const url = decodeURIComponent((req.url ?? '/').split('?')[0])
  let file = normalize(join(root, url))
  if (!file.startsWith(root) || !existsSync(file) || statSync(file).isDirectory()) file = join(root, 'index.html')
  res.setHeader('Content-Security-Policy', csp)
  res.setHeader('Permissions-Policy', perms)
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('Cache-Control', url.startsWith('/assets/') ? 'public, max-age=31536000, immutable' : 'no-cache')
  res.setHeader('Content-Type', TYPES[extname(file)] ?? 'application/octet-stream')
  res.end(readFileSync(file))
}).listen(Number(process.argv[2] ?? 4318), () => console.log(`http://localhost:${process.argv[2] ?? 4318}/`))
