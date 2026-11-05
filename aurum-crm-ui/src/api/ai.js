import request from '@/utils/request'
import { USE_MOCK, delay } from './_mock'

/**
 * AI 小助手接口
 *
 * ⚠️ 这个文件**故意不 import `@/utils/auth`**：`scripts/check-api-mock.mjs`
 * 复制 api 文件时只重写固定的几个别名（`./_mock`、`@/utils/request`、
 * `@/mock/db`、`@/mock/menu`、`@/constants/regions`），导入别的别名会让
 * 整个 check:mock 以 ERR_MODULE_NOT_FOUND 挂掉 —— 而且是加载失败不是断言失败，
 * 看起来像环境问题，很难查（见 docs/开发注意事项.md 第 26 条）。
 * token 的键名与 utils/auth.js 保持一致，这里直接读 localStorage。
 */
const TOKEN_KEY = 'AurumCRM-Token'
const BASE = '/ai'
const SESSIONS = '/ai/sessions'

// ==================== 会话管理（普通 JSON 接口）====================
//
// 这三个走 `request`（axios），因此**能被 check:api 校验**——
// 只有下面那个流式的 chatStream 因为用 fetch 而落在工具的盲区里。

/** 我的会话列表，按最后活跃时间倒序 */
export async function getAiSessions() {
  if (USE_MOCK) {
    await delay()
    return mockSessions.map((s) => ({ ...s, messages: undefined }))
  }
  return request({ url: SESSIONS, method: 'get' })
}

/** 某个会话的全部消息（时间正序） */
export async function getAiMessages(sessionId) {
  if (USE_MOCK) {
    await delay()
    const found = mockSessions.find((s) => s.sessionId === sessionId)
    return found ? found.messages : []
  }
  return request({ url: `${SESSIONS}/${sessionId}/messages`, method: 'get' })
}

/** 删除会话 */
export async function deleteAiSession(sessionId) {
  if (USE_MOCK) {
    await delay()
    const i = mockSessions.findIndex((s) => s.sessionId === sessionId)
    if (i >= 0) mockSessions.splice(i, 1)
    return true
  }
  return request({ url: `${SESSIONS}/${sessionId}`, method: 'delete' })
}

// ==================== 流式对话 ====================

/**
 * 流式对话
 *
 * ⚠️ 用 `fetch` + `ReadableStream` 而不是 axios：axios 不支持流式响应，
 * `utils/request.js` 的拦截器（含自动加 Authorization、401 跳登录、统一错误提示）
 * 在**这里全都不会生效**，必须自己补。这是本文件与其它 api 文件最大的不同。
 *
 * ⚠️⚠️ **本函数是 `npm run check:api` 的盲区，改路径时要格外小心。**
 *     `scripts/lib/api-calls.js` 只解析 `request({ url, method })` 这种写法，
 *     认不出 `fetch(...)` —— 所以这里的路径写错了，check:api 和 gen:api-status
 *     都不会报，接口清单里也看不到它。改动后请人工核对《05-接口文档》第十三节。
 *
 * @param {object}   opts
 * @param {string?}  opts.sessionId 会话ID；首次对话不传，由服务端创建
 * @param {string}   opts.content   本轮提问
 * @param {Function} opts.onMeta    开场 ({model, sessionId}) => void
 * @param {Function} opts.onDelta   正文增量 (text) => void
 * @param {Function} opts.onTool    工具状态 ({name, status}) => void
 * @param {Function} opts.onDone    正常结束 ({finishReason, usage}) => void
 * @param {Function} opts.onError   出错 ({code, message}) => void
 * @param {AbortSignal} opts.signal 用于「停止生成」
 */
export async function chatStream({
  sessionId,
  content,
  onMeta,
  onDelta,
  onTool,
  onDone,
  onError,
  signal
}) {
  if (USE_MOCK) {
    return mockChatStream({ sessionId, content, onMeta, onDelta, onDone, signal })
  }

  const base = import.meta.env.VITE_APP_BASE_API || '/api'
  const token = localStorage.getItem(TOKEN_KEY)

  const res = await fetch(`${base}${BASE}/chat/stream`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json;charset=utf-8',
      // ⚠️⚠️ 这里**故意不写 `Accept: text/event-stream`**，别"好心"加上。
      //
      // Accept 会作用于**这个请求的所有响应**，包括错误响应。而在本接口上，
      // 权限不足(403)、未登录(401)、参数错误(400)、未配置(5006) 都是在 SSE 流
      // 开始【之前】返回的普通 JSON —— 一旦 Accept 只允许 text/event-stream，
      // Spring 就无法把这些 CommonResult 渲染出来，结果是
      // **HTTP 500 + 空响应体**（连 content-type 都没有），
      // 前端只能显示「请求失败（500）」，完全看不出真实原因。
      //
      // 实测确认过：带这个头 → 403 变成 500 空响应；去掉 → 拿到正常的 403 JSON。
      // SSE 本身不需要请求方声明 Accept，省略即可（服务端照样按
      // produces = text/event-stream 匹配到处理器并流式写回）。
      //
      // 拦截器不会帮忙加 Authorization，这里必须自己带
      ...(token ? { Authorization: 'Bearer ' + token } : {})
    },
    // 只发会话ID + 本轮提问：历史在服务端（Redis），前端不再上传
    body: JSON.stringify({ sessionId: sessionId || null, content }),
    signal
  })

  // ⚠️⚠️ 分流条件必须同时看 res.ok **和** Content-Type，不能只看 res.ok。
  //
  // 本项目对业务错误沿用统一约定：**HTTP 状态码仍然是 200**，真正的错误在
  // JSON body 的 `code` 里（如 `{"code":403,"message":"没有该操作权限：ai:chat:use"}`）。
  // 权限不足、未登录、参数错误、未配置(5006) 都是这样返回的。
  //
  // 只判断 res.ok 的话，这些响应会被当成正常的 SSE 流去读 —— 里面一帧都没有，
  // 于是所有回调都不触发：用户点发送后**什么都没发生**，既没有回答也没有报错，
  // 比报错还难排查。（实测踩到过。）
  const contentType = res.headers.get('content-type') || ''
  if (!res.ok || !contentType.includes('text/event-stream')) {
    let payload = null
    try {
      payload = await res.json()
    } catch {
      // 不是 JSON（网关错误页之类），落到下面的兜底文案
    }
    onError?.({
      code: payload?.code ?? res.status,
      message: payload?.message || `请求失败（${res.status}）`
    })
    return
  }

  const reader = res.body.getReader()
  const decoder = new TextDecoder('utf-8')
  let buffer = ''

  const dispatch = (frame) => {
    if (!frame) return
    const { event, data } = frame
    if (event === 'meta') onMeta?.(data)
    else if (event === 'delta') onDelta?.(data.content)
    else if (event === 'tool') onTool?.(data)
    else if (event === 'done') onDone?.(data)
    else if (event === 'error') onError?.(data)
    // ping 忽略
  }

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })

    // ⚠️ 必须自己按帧切分并缓冲：一次 read 可能拿到多帧，也可能只拿到半帧。
    //    这是 SSE 客户端最常见的 bug —— 直接对每个 chunk 做 JSON.parse 会在
    //    中文或长回答时随机失败。
    let idx
    while ((idx = buffer.indexOf('\n\n')) >= 0) {
      const raw = buffer.slice(0, idx)
      buffer = buffer.slice(idx + 2)
      dispatch(parseFrame(raw))
    }
  }
  // 最后一帧若没以空行结尾，别把它丢了
  if (buffer.trim()) {
    dispatch(parseFrame(buffer))
  }
}

/** 解析一帧：`event: xxx\ndata: {...}` */
function parseFrame(raw) {
  let event = 'message'
  const dataLines = []
  for (const line of raw.split('\n')) {
    if (line.startsWith('event:')) {
      event = line.slice(6).trim()
    } else if (line.startsWith('data:')) {
      dataLines.push(line.slice(5).trim())
    }
  }
  if (!dataLines.length) return null
  try {
    return { event, data: JSON.parse(dataLines.join('\n')) }
  } catch {
    return null
  }
}

// ==================== MOCK 分支 ====================
//
// 自包含的假数据，**不读 @/mock/db** —— 少一个依赖面，将来若把本文件加进
// check:mock 的列表也不会因为它挂掉。

let mockSeq = 0
const mockSessions = []

async function mockChatStream({ sessionId, content, onMeta, onDelta, onDone, signal }) {
  await delay(200)

  let session = mockSessions.find((s) => s.sessionId === sessionId)
  if (!session) {
    session = {
      sessionId: `mock-${++mockSeq}`,
      title: content.slice(0, 30),
      lastActive: Date.now(),
      messageCount: 0,
      messages: []
    }
    mockSessions.unshift(session)
  }

  onMeta?.({ model: 'mock', sessionId: session.sessionId })
  session.messages.push({ role: 'user', content, ts: Date.now() })

  const text = `（MOCK 模式）收到：「${content}」。当前未连后端，把 .env.development 的 VITE_APP_USE_MOCK 改成 false 即可走真实接口。`
  let answer = ''
  for (const ch of text) {
    if (signal?.aborted) return
    answer += ch
    onDelta?.(ch)
    await delay(12)
  }

  session.messages.push({ role: 'assistant', content: answer, tools: [], ts: Date.now() })
  session.messageCount = session.messages.length
  session.lastActive = Date.now()
  onDone?.({ finishReason: 'stop' })
}
