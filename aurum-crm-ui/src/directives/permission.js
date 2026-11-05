/**
 * v-permission 指令 —— 按权限点隐藏元素。
 *
 * 后端已经用 `@SaCheckPermission` 把接口守住了（见后端 docs/07 的 BUG-016），
 * 但**接口拒绝和界面隐藏是两件事**：不隐藏的话，用户会看到一个「看得见、
 * 点了报 403」的按钮，比直接看不见更让人困惑。这个指令负责把界面对齐到权限模型。
 *
 * 用法：
 *   v-permission="'crm:lead:delete'"              // 单个权限点
 *   v-permission="['crm:lead:update', 'crm:lead:delete']"   // 任一满足即可
 *
 * ⚠️ <b>不传 / 传空值一律放行</b>（与 store 里 `hasPermission` 的语义一致）——
 *    这样没写 perm 的老按钮不会因为漏配而集体消失，行为是向后兼容的。
 *
 * ⚠️ <b>这是「界面友好」不是「安全边界」</b>。真正的边界在后端 ——
 *    绕过这个指令（改内存、直接调接口）不会得到任何额外权限，
 *    所以它不需要做得无懈可击，也不该因此被当成安全措施。
 */
import { useUserStore } from '@/store/user'

function allowed(value) {
  const userStore = useUserStore()
  if (value === undefined || value === null || value === '') return true
  if (Array.isArray(value)) {
    // 空数组视为「未配置」而不是「全不允许」—— 避免写成 [] 的按钮意外全消失
    if (value.length === 0) return true
    return value.some((perm) => userStore.hasPermission(perm))
  }
  return userStore.hasPermission(value)
}

export const permission = {
  mounted(el, binding) {
    if (!allowed(binding.value)) {
      // 直接摘掉节点。不用 display:none —— 后者在 flex 布局里仍会占位，
      // 而且元素依然能被键盘 Tab 到。
      el.parentNode?.removeChild(el)
    }
  }
}

export default permission
