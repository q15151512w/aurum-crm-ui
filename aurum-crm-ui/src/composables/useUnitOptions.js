import { ref } from 'vue'
import { getUnitSimpleList } from '@/api/system'

/**
 * 计量单位选项（产品表单、商机/报价单/合同的产品明细编辑器共用）
 *
 * 背景（《08-产品模块接口文档》已知限制 1）：
 * 单位下拉原来读 `constants/options.js` 里**硬编码**的 `台/个/箱/件/瓶/套/米/千克`，
 * 而 `sys_unit` 种子里只有 `个/台/套/年/次`。产品提交的是**单位名字**，
 * 后端 `ProductServiceImpl.resolveUnitId()` 按名字查不到就报 `2408` ——
 * 于是其中 5 个选项一选就保存失败，而页面上完全看不出来。
 *
 * 现在改为从 `GET /system/unit/simple-list`（只返回启用单位）取数：
 * 管理员在「计量单位」页新增了单位，产品下拉立刻就能选 —— 前端不再维护第二份单位清单。
 *
 * ⚠️ `value` 用的是**单位名称**：产品新增/修改提交的是 `unitName`
 * （见 `ProductSaveReqVO`），后端按名字解析成 `unit_id`。
 * 接口同时返回了 `id`，将来想把提交口径换成 `unitId` 时不必再改接口。
 *
 * 缓存：模块级单例 + 在途 Promise 去重 —— 同时打开多个表单也只发一次请求。
 * 失败时保持空数组（不抛异常、不阻塞表单）：单位本身是选填项，
 * 拿不到选项不该让整个表单不能用（错误提示已由 `utils/request.js` 统一弹过）。
 */
const unitOptions = ref([])

/** 是否已成功加载过 —— 空数组也是有效结果，不能用 length 判断，否则会反复重试 */
let loaded = false

/** 在途请求，用于并发去重 */
let inflight = null

export async function ensureUnitOptions() {
  if (loaded) return unitOptions.value
  if (!inflight) {
    inflight = getUnitSimpleList({ pageSize: 200 })
      .then((data) => {
        unitOptions.value = (data?.list || []).map((unit) => ({
          label: unit.name,
          value: unit.name,
          id: unit.id,
          decimalPlaces: unit.decimalPlaces ?? 0
        }))
        loaded = true
        return unitOptions.value
      })
      .catch((e) => {
        console.error('[useUnitOptions] 计量单位选项加载失败', e)
        return unitOptions.value
      })
      .finally(() => {
        inflight = null
      })
  }
  return inflight
}

export { unitOptions }
