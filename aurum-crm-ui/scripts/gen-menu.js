/**
 * 从后端 sql/crm.sql 的 sys_menu 种子生成 src/mock/menu.js
 *
 * 为什么要有这个脚本：
 *   菜单的权威来源是后端（sys_menu 表），前端 mock 只是它在后端 /auth/me
 *   实现之前的临时投影。两边手工同步迟早漂移 —— 事实上本次改造前就已经
 *   漂移了（后端叫「线索管理 / 产品类型 / 回款登记 / 组织架构」，
 *   原型叫「线索 / 产品 / 财务 / 系统设置」）。所以改成从 SQL 生成。
 *
 * 漂移的现状（**会过时，以 sql/crm.sql 为准**）：
 *   ✅ 线索（10 / 11）、系统设置（70）—— 2026-09-15 已对齐原型（只改了 `crm.sql` 的种子；
 *      存量库没有增量脚本，需手工执行两条 UPDATE，见 backend 的 《02-建表文档》末节）
 *   ❌ 产品类型（50）、财务（60）—— 原型模块表叫「产品」「财务」，
 *      尚未对齐。要改的话改 crm.sql 种子 + 出一个 alter 脚本 + 重跑本脚本。
 *
 * 用法：
 *   npm run gen:menu
 *
 * 改了菜单之后记得重新跑一次，别直接手改 src/mock/menu.js。
 */
import fs from 'node:fs'
import path from 'node:path'
import { backendFile } from './lib/backend-paths.js'

// 后端项目位置由 scripts/lib/backend-paths.js 统一探测（不再硬编码 ——
// 本仓库后端在 master/crm/ 下，与 aurum-crm-ui 并非同级）
const SQL = backendFile('sql/crm.sql')
const OUT = path.resolve(import.meta.dirname, '../src/mock/menu.js')

const sql = fs.readFileSync(SQL, 'utf8')

// ---------- 1. 截出 sys_menu 的 INSERT 块 ----------
const start = sql.indexOf('INSERT INTO `sys_menu`')
if (start === -1) throw new Error('未找到 sys_menu 的 INSERT 语句')
const end = sql.indexOf(';', start)
const block = sql.slice(start, end)

// ---------- 2. 解析每一行元组 ----------
// 值里可能有逗号，所以要按引号状态分割，不能直接 split(',')
function splitTop(s) {
  const out = []
  let cur = ''
  let inQuote = false
  for (const ch of s) {
    if (ch === "'") {
      inQuote = !inQuote
      cur += ch
    } else if (ch === ',' && !inQuote) {
      out.push(cur.trim())
      cur = ''
    } else {
      cur += ch
    }
  }
  out.push(cur.trim())
  return out
}

function parseValue(raw) {
  if (raw === 'NULL') return null
  if (raw.startsWith("'")) return raw.slice(1, -1)
  return Number(raw)
}

const rows = []
for (const line of block.split('\n')) {
  const t = line.trim()
  if (!t.startsWith('(')) continue
  const m = t.match(/^\((.*)\),?\s*$/)
  if (!m) continue

  const v = splitTop(m[1]).map(parseValue)
  if (v.length < 11) continue

  rows.push({
    menuId: v[0],
    parentId: v[1],
    menuName: v[2],
    menuType: v[3],
    path: v[4],
    component: v[5],
    perms: v[6],
    icon: v[7],
    sort: v[8],
    visible: v[9],
    status: v[10]
  })
}

if (!rows.length) throw new Error('没解析出任何菜单行，检查 SQL 格式')

// ---------- 3. 组装成树 ----------
const byId = new Map(rows.map((r) => [r.menuId, { ...r, children: [] }]))
const roots = []
for (const node of byId.values()) {
  const parent = byId.get(node.parentId)
  if (parent) parent.children.push(node)
  else roots.push(node)
}

// 同级按 sort 升序，sort 相同按 menuId 兜底（SQL 里 sort 有重复值，如各详情页都是 9）
const sortTree = (list) => {
  list.sort((a, b) => a.sort - b.sort || a.menuId - b.menuId)
  list.forEach((n) => sortTree(n.children))
  return list
}
sortTree(roots)

// ---------- 4. 裁剪字段 + 输出 ----------
function shape(n) {
  return {
    menuId: n.menuId,
    parentId: n.parentId,
    menuName: n.menuName,
    menuType: n.menuType,
    path: n.path,
    component: n.component,
    perms: n.perms,
    icon: n.icon,
    sort: n.sort,
    visible: n.visible,
    children: n.children.map(shape)
  }
}

const menus = roots.map(shape)

// 用 2 空格缩进输出，读起来像手写的
function toJs(value, indent) {
  const pad = ' '.repeat(indent)
  const pad2 = ' '.repeat(indent + 2)
  if (Array.isArray(value)) {
    if (!value.length) return '[]'
    return '[\n' + value.map((v) => pad2 + toJs(v, indent + 2)).join(',\n') + '\n' + pad + ']'
  }
  if (value && typeof value === 'object') {
    return (
      '{\n' +
      Object.entries(value)
        .map(([k, v]) => `${pad2}${k}: ${toJs(v, indent + 2)}`)
        .join(',\n') +
      '\n' +
      pad +
      '}'
    )
  }
  return JSON.stringify(value)
}

const count = (list) => list.reduce((s, n) => s + 1 + count(n.children), 0)

const out = `/**
 * 菜单 mock 数据
 *
 * ⚠️ 本文件由 \`npm run gen:menu\` 从后端 sql/crm.sql 的 sys_menu 种子【自动生成】，
 *    请勿手工编辑 —— 改了也会被下次生成覆盖。
 *    当前节点数：${count(menus)}
 *
 * 用途：后端 /auth/me 尚未实现时，让前端动态菜单与路由守卫能端到端跑通。
 * 后端就绪后：
 *   1. 把 .env.development 里的 VITE_APP_USE_MOCK 改为 false
 *   2. 本文件即可删除
 *
 * 字段说明：
 *   menuType  1=目录（顶部一级导航，不产生路由） 2=菜单（对应一个路由页面） 3=按钮（不下发前端）
 *   path      目录为 null；菜单为绝对路径
 *   component 前端组件路径，相对 src/views，如 crm/lead/index
 *   visible   0=隐藏（可路由但不显示在导航里，如详情页）
 */
export const mockMenus = ${toJs(menus, 0)}

/** 超级管理员的权限标识 */
export const mockPermissions = ['*:*:*']

/** mock 用户信息（对应后端 GET /auth/me 的响应）*/
export const mockUserInfo = {
  userId: 1,
  username: 'admin',
  realName: '超级管理员',
  deptId: 1,
  deptName: '总公司',
  roles: ['admin'],
  permissions: mockPermissions,
  menus: mockMenus
}
`

fs.writeFileSync(OUT, out, 'utf8')
console.log(`已生成 ${path.relative(process.cwd(), OUT)}`)
console.log(`菜单节点 ${count(menus)} 条，一级导航 ${menus.length} 项：`)
menus.forEach((m) => console.log(`  - ${m.menuName}（子项 ${m.children.length}）`))
