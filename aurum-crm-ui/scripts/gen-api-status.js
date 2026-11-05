/**
 * 生成「接口清单」文本文件
 *
 * 从《05-接口文档.md》抽出全部接口，与 `src/api/*.js` 里**实际发出的请求**交叉比对，
 * 产出 `docs/接口清单.txt`，分「已接入 / 未接入」两节。
 *
 * 为什么不手写这份清单：
 *   手写的清单会过期。后端加一个接口、前端接一个接口，文档就悄悄失真了。
 *   这里每次跑都重新算，跟 `gen:menu`、`check:api` 是一个路子。
 *
 * 用法：
 *   npm run gen:api-status
 */
import fs from 'node:fs'
import path from 'node:path'
import { readApiCalls, normalizePath } from './lib/api-calls.js'
import { backendFile } from './lib/backend-paths.js'

// 后端项目位置由 scripts/lib/backend-paths.js 统一探测（本仓库后端在 master/crm/ 下，非同级）
const API_DIR = path.resolve(import.meta.dirname, '../src/api')
const DOC = backendFile('docs/05-接口文档.md')
const OUT = path.resolve(import.meta.dirname, '../docs/接口清单.txt')

const doc = fs.readFileSync(DOC, 'utf8')

/** 动态段统一成 {id}，便于与前端路径比对 */
const normalize = normalizePath

/** 模块划分，按路径前缀 */
const MODULES = [
  { key: 'auth', name: '一、认证模块 /auth' },
  { key: 'system', name: '二、系统管理 /system' },
  { key: 'crm', name: '三、客户模块 /crm' },
  { key: 'finance', name: '四、财务模块 /finance' },
  { key: 'bpm', name: '五、审批流 /bpm' },
  { key: 'dashboard', name: '六、首页与统计 /dashboard' }
]
const moduleOf = (p) => MODULES.find((m) => p.startsWith('/' + m.key + '/') || p === '/' + m.key)?.key || 'other'

// ---------------------------------------------------------------------------
//  1. 从接口文档抽出全部接口
// ---------------------------------------------------------------------------
// 表格行： | GET | `/crm/lead/simple-list` | 说明 |  —— 能拿到说明
// 正文行： POST /auth/login                        —— 拿不到说明，记「—」
//
// ⚠️ 文档里有几行把多个方法写在同一格：`| POST/PUT/DELETE | `/system/dict-type` |`。
//    只认单个方法的话这些行会被整行跳过，结果是「文档里明明有、脚本说没有」的假告警，
//    接口总数也会少算。所以方法格要按 `/` 拆开分别登记。
const M = '(?:GET|POST|PUT|DELETE|PATCH)'
const METHOD_CELL = `(${M}(?:\\s*/\\s*${M})*)`
const docTable = new RegExp(`^\\|\\s*${METHOD_CELL}\\s*\\|\\s*\`([^\`]+)\`\\s*\\|\\s*([^|]*)\\|`, 'i')
const docInline = new RegExp(`^\\s*${METHOD_CELL}\\s+(\\/\\S+)`, 'i')

/** 把 'POST/PUT/DELETE' 拆成 ['POST','PUT','DELETE'] */
const splitMethods = (s) => s.split('/').map((x) => x.trim().toUpperCase()).filter(Boolean)

/** key = 'GET /path'，value = { method, path, desc } */
const docApis = new Map()

/** 登记一个接口（同 key 只登记一次） */
function addApi(method, rawPath, desc) {
  // 占位写法（如 §十 的 `/{模块}/{资源}/simple-list`）不是真实接口，跳过
  if (rawPath.includes('{模块}') || rawPath.includes('{资源}')) return
  const key = `${method} ${normalize(rawPath)}`
  const prev = docApis.get(key)
  if (prev) {
    // 正文行先登记时说明是空的，表格里再补上
    if (desc && prev.desc === '—') prev.desc = desc
    return
  }
  docApis.set(key, { method, path: rawPath, desc: desc || '—' })
}

for (const line of doc.split('\n')) {
  const m = line.match(docTable) || line.match(docInline)
  if (!m) continue

  const rawPath = m[2].trim().replace(/`/g, '')
  const desc = (m[3] || '').trim()
  for (const method of splitMethods(m[1])) addApi(method, rawPath, desc)
}

// ---------------------------------------------------------------------------
//  2. 从 src/api/*.js 抽出前端实际发出的请求
// ---------------------------------------------------------------------------
/** key = 'GET /path'，value = { path, method, files } */
const feApis = new Map()

{
  const { calls, errors, skipped } = readApiCalls(API_DIR)
  for (const c of calls) {
    const prev = feApis.get(c.key)
    if (prev) {
      if (!prev.files.includes(c.file)) prev.files.push(c.file)
    } else {
      feApis.set(c.key, { path: c.path, method: c.method, files: [c.file] })
    }
  }
  if (errors.length) {
    console.warn('⚠ 以下请求的 url 用了未声明的常量，无法核对：')
    for (const e of errors) console.warn(`  · ${e.reason}   (src/api/${e.file})`)
  }
  if (skipped) console.warn(`· 跳过的复杂表达式：${skipped} 个`)
}

// ---------------------------------------------------------------------------
//  3. 比对
// ---------------------------------------------------------------------------
const done = []
const todo = []
const extra = []

for (const [key, api] of docApis) {
  const fe = feApis.get(key)
  if (fe) done.push({ ...api, files: fe.files })
  else todo.push(api)
}
for (const [key, fe] of feApis) {
  if (docApis.has(key)) continue
  // 去掉结尾的 /{id} 后文档里有 → 文档那行是合并写法，省掉了 PUT/DELETE 必需的 /{id}
  const bare = fe.path.replace(/\/\{id\}$/, '')
  const docBare = bare !== fe.path && doc.includes(bare) ? bare : null
  extra.push({ key, files: fe.files, path: fe.path, docBare })
}

// ---------------------------------------------------------------------------
//  4. 输出
// ---------------------------------------------------------------------------
const now = new Date()
const pad = (n) => String(n).padStart(2, '0')
const stamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`

const lines = []
const rule = '='.repeat(78)
const thin = '-'.repeat(78)

lines.push(rule)
lines.push('AurumCRM 前端 —— 接口完成情况')
lines.push(rule)
lines.push(`生成时间：${stamp}`)
lines.push(`数据来源：《05-接口文档.md》 ／ src/api/*.js`)
lines.push('')
lines.push(`接口总数        ${docApis.size}`)
lines.push(`已完成（已接入） ${done.length}`)
lines.push(`未完成（未接入） ${todo.length}`)
if (extra.length) lines.push(`⚠ 前端发了但文档没有 ${extra.length}`)
lines.push('')
lines.push('说明：')
lines.push('  · 「已完成」指前端 api 层已经按文档的路径与方法发出了请求，')
lines.push('    不代表后端已实现 —— 后端目前只有 /health，跑的是 mock。')
lines.push('  · 「导出」类接口前端已接，但 mock 模式下会提示「接口尚未实现」，')
lines.push('    这是预期的（导出返回的是文件流，没法造假数据）。')
lines.push('  · 本文件由 `npm run gen:api-status` 生成，不要手改。')
lines.push('')

lines.push(rule)
lines.push(`一、已完成（前端已接入）  ${done.length} 个`)
lines.push(rule)
for (const mod of MODULES) {
  const rows = done.filter((a) => moduleOf(a.path) === mod.key)
  if (!rows.length) continue
  lines.push('')
  lines.push(`【${mod.name}】 ${rows.length} 个`)
  lines.push(thin)
  for (const a of rows.sort((x, y) => x.path.localeCompare(y.path))) {
    lines.push(`  ${a.method.padEnd(6)} ${a.path}`)
    lines.push(`         ${a.desc}`)
    lines.push(`         前端：src/api/${a.files.join(', ')}`)
  }
}

lines.push('')
lines.push(rule)
lines.push(`二、未完成（文档有、前端未接入）  ${todo.length} 个`)
lines.push(rule)
lines.push('')
lines.push('这些接口在《05-接口文档.md》里有定义，但前端还没发过请求。')
lines.push('要接的时候记得同时更新本文件（重跑 npm run gen:api-status）。')
for (const mod of MODULES) {
  const rows = todo.filter((a) => moduleOf(a.path) === mod.key)
  if (!rows.length) continue
  lines.push('')
  lines.push(`【${mod.name}】 ${rows.length} 个`)
  lines.push(thin)
  for (const a of rows.sort((x, y) => x.path.localeCompare(y.path))) {
    lines.push(`  ${a.method.padEnd(6)} ${a.path}`)
    lines.push(`         ${a.desc}`)
  }
}

if (extra.length) {
  lines.push('')
  lines.push(rule)
  lines.push(`三、⚠ 前端发了、但文档里没有完全对应的条目  ${extra.length} 个`)
  lines.push(rule)
  lines.push('')
  const bare = extra.filter((e) => e.docBare)
  const really = extra.filter((e) => !e.docBare)

  if (bare.length) {
    lines.push('【文档写法不精确】' + bare.length + ' 个')
    lines.push(thin)
    lines.push('文档里这几行把多个方法合并成一句，省略了 PUT/DELETE 必需的 /{id}，例如：')
    lines.push('    | POST/PUT/DELETE | `/system/unit` | 计量单位 |')
    lines.push('')
    lines.push('前端按 REST 语义发的是带 id 的路径（下面这些），这是对的。')
    lines.push('⚠️ 但如果后端照文档字面实现成 `PUT /system/unit`（id 放请求体），两边会 404。')
    lines.push('   这一条需要跟后端确认，确认后把文档补精确或把前端改掉。')
    lines.push('')
    for (const e of bare) {
      lines.push(`  ${e.key}`)
      lines.push(`         文档里写的是：${e.docBare}`)
      lines.push(`         前端实际发：  ${e.path}   (src/api/${e.files.join(', ')})`)
    }
  }

  if (really.length) {
    lines.push('')
    lines.push('【文档里确实没有】' + really.length + ' 个 —— 要么前端路径写错了，要么文档漏了')
    lines.push(thin)
    for (const e of really) lines.push(`  ${e.key}   (src/api/${e.files.join(', ')})`)
  }
}

lines.push('')
lines.push(rule)
lines.push('附：模块之外的接口')
lines.push(rule)
lines.push('')
const others = [...docApis.values()].filter((a) => moduleOf(a.path) === 'other')
if (others.length) {
  for (const a of others) lines.push(`  ${a.method.padEnd(6)} ${a.path}   ${a.desc}`)
} else {
  lines.push('  （无）')
}
lines.push('')

fs.writeFileSync(OUT, lines.join('\n'), 'utf8')

console.log(`已生成 ${path.relative(process.cwd(), OUT)}`)
console.log(`  接口总数 ${docApis.size} ／ 已完成 ${done.length} ／ 未完成 ${todo.length}`)
if (extra.length) console.log(`  ⚠ 前端发了但文档没有：${extra.length} 个`)
