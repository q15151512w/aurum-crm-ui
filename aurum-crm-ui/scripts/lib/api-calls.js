import fs from 'node:fs'
import path from 'node:path'

/**
 * 抽取 `src/api/*.js` 里实际发出的请求
 *
 * ⚠️ 这里是踩过坑的地方，改动前先看这段注释
 *
 * 早先的抽取只认引号包裹的 url：
 *
 *     url: '/crm/lead'          ← 能抽到
 *     url: USER                 ← 裸标识符，整条请求被跳过（漏 25 个）
 *     url: `${BASE}/${id}`      ← 模板里的 ${id} 不在常量表里，也整条跳过（漏 81 个）
 *
 * 两条加起来漏了 **106 / 172**，也就是 62% 的请求从来没被校验过 ——
 * 而 `check:api` 一直报「全部通过」，接口清单也一直少算。
 * 所以这段逻辑现在抽成共享模块，`check:api` 和 `gen:api-status` 用同一份，别再各写一遍。
 *
 * 规则：
 *   url: 'xxx'              直接用
 *   url: CONST              查常量表（大写前缀的 `const X = '...'`）
 *   url: `${BASE}/${id}/x`  展开已知常量；未知的**小写/驼峰**段视为路径参数 → `{id}`
 *
 * 未知的**全大写**段说明常量忘了声明 —— 记进 errors，由调用方报出来（这种情况通常是真的写错了）。
 */

/** 路径里的动态段统一成 {id}，便于与文档比对 */
export const normalizePath = (p) => p.replace(/\{[^}]*\}/g, '{id}')

/** 收集文件里声明的路径常量：const BASE = '/crm/lead' */
function collectConsts(src) {
  const consts = {}
  for (const m of src.matchAll(/const ([A-Z][A-Z0-9_]*) = '([^']+)'/g)) consts[m[1]] = m[2]
  return consts
}

/**
 * 把 url 表达式还原成路径
 * @returns {{ path: string|null, undefinedConst: string|null }}
 */
function resolveUrl(raw, consts) {
  const expr = raw.trim()

  // 1) 裸标识符：url: USER
  if (/^\w+$/.test(expr)) {
    return { path: consts[expr] ?? null, undefinedConst: consts[expr] ? null : expr }
  }

  // 2) 字符串或模板字面量：url: '/x' 或 url: `${BASE}/${id}`
  if (/^['"`]/.test(expr)) {
    const inner = expr.slice(1, -1)
    let undefinedConst = null
    const expanded = inner.replace(/\$\{([^}]+)\}/g, (_, name) => {
      const key = name.trim()
      if (consts[key]) return consts[key]
      // 全大写说明本该是个常量但没声明 → 有问题
      if (/^[A-Z][A-Z0-9_]*$/.test(key)) {
        undefinedConst = key
        return ''
      }
      // 其余（id / pageNo 之类）当作路径参数
      return '{id}'
    })
    return { path: undefinedConst ? null : expanded, undefinedConst }
  }

  // 3) 其它表达式（三元、函数调用等）—— 放弃了，但要让它可见
  return { path: null, undefinedConst: null }
}

/**
 * 读取 api 目录下所有请求
 *
 * @param {string} apiDir src/api 的绝对路径
 * @returns {{ calls: Array<{method,path,file}>, errors: Array<{file,reason}>, skipped: number }}
 */
export function readApiCalls(apiDir) {
  const calls = []
  const errors = []
  let skipped = 0

  for (const file of fs.readdirSync(apiDir)) {
    if (!file.endsWith('.js') || file === '_mock.js') continue
    const src = fs.readFileSync(path.join(apiDir, file), 'utf8')
    const consts = collectConsts(src)

    // request({ ... }) / request({  ...  })  —— 取到第一个 `})` 为止
    for (const m of src.matchAll(/request\(\{([\s\S]*?)\}\)/g)) {
      const body = m[1]
      const urlM = body.match(/url:\s*([^,\n]+)/)
      if (!urlM) continue

      const { path: p, undefinedConst } = resolveUrl(urlM[1], consts)
      if (undefinedConst) {
        errors.push({ file, reason: `常量 ${undefinedConst} 没有声明` })
        continue
      }
      if (!p) {
        skipped++
        continue
      }

      const methodM = body.match(/method:\s*'(\w+)'/)
      calls.push({
        method: (methodM ? methodM[1] : 'get').toUpperCase(),
        path: p,
        key: `${(methodM ? methodM[1] : 'get').toUpperCase()} ${normalizePath(p)}`,
        file
      })
    }
  }

  return { calls, errors, skipped }
}
