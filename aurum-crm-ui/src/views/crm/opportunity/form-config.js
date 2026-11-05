import { OPPORTUNITY_STAGE_OPTIONS } from '@/constants/options'
import { calcItemsTotal, round2 } from '@/utils/number'

/**
 * 商机的新增/编辑表单配置
 *
 * 列表页与详情页共用（理由见 lead/form-config.js 的注释）。
 *
 * 「整单最终价」是派生的（合计总价 ×(1 - 折扣/100)），置灰由 compute 自动算，
 * 不让用户手填 —— 手填的值和折扣对不上时没人能发现。
 * mock 里原来的算法就是 `totalAmount * (1 - discount/100)`，这里保持一致。
 *
 * ⚠️「合计总价」的口径：**有产品明细时以明细为准**（= Σ 明细行的含税金额，
 *    由后端在保存明细后回写到 crm_opportunity.amount），没有明细时才是手填的预计金额。
 *    所以有明细时这一格置灰并显示明细汇总 —— 否则用户填的值会被服务端静默覆盖，
 *    看起来就像「填了没生效」。口径总览见 docs/13。
 */

/** 是否已有产品明细 —— 决定「合计总价」是手填还是按明细汇总 */
const hasItems = (model) => Array.isArray(model?.products) && model.products.length > 0

export const FIELDS = [
  {
    prop: 'name',
    label: '商机名称',
    type: 'input',
    required: true,
    maxlength: 128,
    placeholder: '如：华阳科技采购项目'
  },
  {
    prop: 'customerName',
    label: '客户',
    type: 'selector',
    selector: 'customer',
    extraProp: 'customerId',
    required: true
  },
  {
    prop: 'ownerName',
    label: '负责人',
    type: 'selector',
    selector: 'owner',
    extraProp: 'ownerUserId',
    required: true
  },
  { prop: 'stage', label: '商机阶段', type: 'select', options: OPPORTUNITY_STAGE_OPTIONS, required: true },
  { prop: 'expectDealTime', label: '预计成交时间', type: 'date' },
  { prop: 'nextContactTime', label: '下次联系时间', type: 'date' },
  {
    prop: 'totalAmount',
    label: '合计总价（含税）',
    type: 'number',
    precision: 2,
    step: 100,
    // 有明细就以明细为准：这一格的值与后端回写的 crm_opportunity.amount 是同一个数
    disabled: (model) => hasItems(model),
    compute: (model) =>
      hasItems(model) ? calcItemsTotal(model.products).totalWithTax : model.totalAmount,
    tip: '含税金额。已添加产品明细时本格由明细自动汇总、不可手改（明细在详情页「产品明细」里维护，保存后自动回写）；没有明细时填预计金额。'
  },
  { prop: 'discount', label: '整单折扣(%)', type: 'number', min: 0, max: 100, precision: 0 },
  {
    prop: 'finalAmount',
    label: '整单最终价',
    type: 'number',
    precision: 2,
    disabled: true,
    compute: (model) =>
      round2((Number(model.totalAmount) || 0) * (1 - (Number(model.discount) || 0) / 100))
  }
]

export const emptyForm = () => ({
  name: '',
  customerName: '',
  customerId: null,
  ownerName: '',
  ownerUserId: null,
  stage: '初步接洽',
  expectDealTime: '',
  nextContactTime: '',
  totalAmount: 0,
  discount: 0,
  finalAmount: 0,
  // ⚠️ 必须留在 emptyForm 里：useFormDialog#pickFormFields 以 emptyForm 的键为准裁剪回填字段，
  //    少了它，列表行/详情里的 products 就进不了表单模型，「合计总价」也算不出明细汇总。
  //    它只是给弹窗算数用的，提交到 /crm/opportunity 时后端刻意不接收这个字段（明细只走
  //    POST/PUT /crm/opportunity/{id}/products），会被静默忽略。
  products: []
})
