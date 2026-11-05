/**
 * api 层的 mock 开关（各模块共用）
 *
 * 后端目前只有 /health，其余接口全部未实现，所以每个 api 函数都带一条 mock 分支。
 * 后端就绪后：把 .env.development 的 VITE_APP_USE_MOCK 改成 false，
 * 本文件的 USE_MOCK 即为 false，各 api 里的 mock 分支自然失效（可再统一清理）。
 */
export const USE_MOCK = import.meta.env.VITE_APP_USE_MOCK === 'true'

/** 模拟网络延迟，让 loading 状态可见 */
export const delay = (ms = 250) => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * mock 模式下调用「没有 mock 分支」的功能
 *
 * 导出类接口返回的是 blob，没法造，以前会直接发真实请求，
 * 结果必然报「网络异常，请检查后端服务是否已启动」—— 那个提示会让人以为后端挂了。
 * 这里给一个准确的提示并中断流程，调用方的 catch 会静默接住。
 */
export function mockNotImplemented(name) {
  // 动态引入，避免 api 层在模块顶层就依赖 element-plus
  import('element-plus').then(({ ElMessage }) => {
    ElMessage.info(`「${name}」接口尚未实现（当前为 MOCK 模式）`)
  })
  return Promise.reject(new Error(`[MOCK] ${name} 未实现`))
}
