/**
 * 前端请求路径 ↔ 接口文档 交叉核对
 *
 * 为什么要这个脚本：
 *   曾经出现过前端发了 5 个《05-接口文档.md》里根本不存在的接口路径
 *   （当时是首页看板的接口名自己编的）。路径对不上，后端实现完必然 404，
 *   而且藏得深 —— 因为 mock 模式下前端照样能跑。
 *
 * ⚠️ 2026-09-13 修过一次严重的漏检：
 *   抽取逻辑只认引号形式 `url: '...'`，于是 `url: USER`（裸标识符）和
 *   `url: `${BASE}/${id}``（模板里有动态段）这两种写法**整条被跳过**。
 *   172 个请求只检查到 66 个，脚本却一直报「全部通过」。
 *   现在抽取逻辑统一在 scripts/lib/api-calls.js，与 gen:api-status 共用一份。
 *
 * 用法：
 *   npm run check:api
 */
import fs from 'node:fs'
import path from 'node:path'
import { readApiCalls } from './lib/api-calls.js'
import { backendFile } from './lib/backend-paths.js'

// 后端项目位置由 scripts/lib/backend-paths.js 统一探测（本仓库后端在 master/crm/ 下，非同级）。
//
// ⚠️ 这里一度并存**三套**方案：本文件内联的 DOC_CANDIDATES + CRM_DOC 环境变量、
//    lib/backend-paths.js、以及一个功能完全重复的 lib/backend-dir.js ——
//    同一个问题三份实现，合并时就撞成了冲突（本文件当时直接语法错误、check:api 整体不可用）。
//    现在只保留 backend-paths.js 一份；要显式指定后端位置用 AURUM_BACKEND_DIR，
//    三个脚本共用同一个覆盖口（原先只有本文件支持 CRM_DOC，另外两个照旧跑不了）。
//
// ⚠️ 2026-09-14 补记：上面这段「合并撞成冲突」的描述，本身又原样发生了一次 ——
//    冲突标记（<<<<<<< HEAD / ======= / >>>>>>>）被**提交进了版本库**，
//    于是 check:api 再次整体不可用（SyntaxError: Unexpected token '<<'）。
//    本次按「保留 backend-paths.js 一份」的既定结论解掉冲突。
//    ⚠️ 教训：冲突标记一定要跑一次脚本确认，别只看「文件保存了」。
const API_DIR = path.resolve(import.meta.dirname, '../src/api')
const DOC = backendFile('docs/05-接口文档.md')

// 把实际用到的那份打出来 —— 路径选错时能一眼看出来（比如命中了另一个陈旧的副本）
console.log(`接口文档：${DOC}\n`)

const doc = fs.readFileSync(DOC, 'utf8')
const { calls, errors, skipped } = readApiCalls(API_DIR)

// 文档里出现过这个路径就算有定义（不校验方法 —— 方法由 gen:api-status 那份清单负责）
const missing = []
const docImprecise = []

for (const c of calls) {
  if (doc.includes(c.path.split('?')[0])) continue

  // 去掉结尾的 /{id} 后文档里有 → 不是前端写错，是文档那行把多个方法合并成一句
  // （`| POST/PUT/DELETE | `/system/unit` |`），省掉了 PUT/DELETE 必需的 /{id}。
  // 前端按 REST 语义带 id 是对的，所以这里不算失败，但要每次都提醒 ——
  // 万一后端照字面实现成 PUT /system/unit（id 放 body），两边就会 404。
  const bare = c.path.replace(/\/\{id\}$/, '')
  if (bare !== c.path && doc.includes(bare)) {
    docImprecise.push({ ...c, bare })
    continue
  }
  missing.push(c)
}

console.log(`前端请求调用共 ${calls.length} 个（去重后 ${new Set(calls.map((c) => c.key)).size} 个路径+方法）`)
console.log(`  ✓ 文档中能找到该路径：${calls.length - missing.length - docImprecise.length}`)
console.log(`  ⚠ 文档写法不精确：${docImprecise.length}`)
console.log(`  ✗ 文档中查不到：${missing.length}`)
if (skipped) console.log(`  · 跳过的复杂表达式：${skipped} 个（无法静态解析）`)

if (errors.length) {
  console.log('\n⚠ 以下请求的 url 用了未声明的常量，无法校验：')
  for (const e of errors) console.log(`  · ${e.reason}   (src/api/${e.file})`)
}

if (docImprecise.length) {
  console.log('\n⚠ 文档里这几行把多个方法合并写了，省略了 PUT/DELETE 的 /{id}：')
  for (const d of docImprecise) {
    console.log(`  · ${d.method} ${d.path}   (文档写的是 ${d.bare})   src/api/${d.file}`)
  }
  console.log('  前端按 REST 语义带 id 是对的。若后端照文档字面实现，这两边会 404 —— 需要跟后端确认。')
}

if (missing.length) {
  console.log('\n以下路径在《05-接口文档.md》里找不到：')
  for (const m of missing) console.log(`  · ${m.method} ${m.path}   (src/api/${m.file})`)
  console.log('\n要么路径写错了，要么文档缺了这个接口 —— 两者都得处理。')
}

if (missing.length || errors.length) process.exit(1)
