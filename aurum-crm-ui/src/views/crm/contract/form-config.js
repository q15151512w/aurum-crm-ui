import { dictOptions } from '@/composables/useDictOptions'
import { calcItemsTotal } from '@/utils/number'
import { getQuotationSimpleList } from '@/api/opportunity'
// 明细行映射与报价单表单共用一份（同一结构、同一个编辑器），别在这里再写一遍
import { toDocumentItems } from '@/utils/documentItems'

/**
 * 合同的新增/编辑表单配置
 *
 * 列表页与详情页共用（理由见 lead/form-config.js 的注释）。
 *
 * 字段名与后端 `ContractSaveReqVO` 对齐：
 *   contractName / customerId / opportunityId / quotationId / contractType(码值) /
 *   signDate / startDate / endDate / ownerUserId / customerSigner / companySigner /
 *   items（明细，**必填至少一行**）/ amount / remark
 *
 * ⚠️ **明细的字段名是 `items`，不是 `products`**。后端 `ContractSaveReqVO.items`
 *    标了 `@NotEmpty` —— 发 `products` 的话它会收到一个空列表，
 *    直接 400「不能为空」。这是 BUG-002 里合同新增失败的原因之一。
 *
 * ⚠️ **`contractType` 传码值**（1 销售合同 / 2 框架合同 / 3 补充协议）。
 *    后端是 `Integer`，发中文「销售合同」会触发 Jackson 反序列化失败。
 *
 * ⚠️ 整单最终价必须是明细汇总，服务端会二次校验，不一致直接拒绝
 *    （《02-建表文档》3.6 硬规则 2：contract.amount == Σ contract_item.amount）。
 *    服务端 `create()` 里就是 `contract.setAmount(sum(items))`，
 *    所以这一格**置灰由 compute 算**，不让手填。
 *
 * 「整单利润」不在表单里：文档 3.6 明确这一版**不计算利润**（全库无 profit 列），
 * 产品的 cost_price 也没纳入任何单据的利润计算。列表上那一列已一并移除。
 *
 * ⚠️ **客户 / 商机 / 报价单是三级联动，不是三个各选各的下拉**：
 *    · 选商机 → 带出客户，并带出产品（有报价单就是**最新一版**报价单的产品，
 *      没有报价单就是**商机自己的明细**）；报价单那一格只列这个商机的单子。
 *    · 选报价单 → 商机（该报价单挂了商机时）、客户、产品一起对齐成报价单上的值。
 *    · 换客户 → 下游（商机 / 报价单 / 产品）一起清空；客户在上游确定后置为只读。
 *    数据源都是选择器接口本身（`/crm/opportunity/simple-list`、
 *    `/crm/quotation/simple-list`），**不要**改成「选中后再懒调详情」。
 *    后端对应的一致性校验在 `support/ContractRelationSupport`（客户不一致 → 2304，**拒绝**而不是
 *    静默改写），两边规则必须一起改。
 */

// ---------------------------------------------------------------------------
//  客户 / 商机 / 报价单 三级联动
//
//  规则（与后端 support/ContractRelationSupport 的校验规则**逐条对应**，
//  改一边必须改另一边，否则会出现「界面显示 A、落库 B」或保存被 2304 拒掉）：
//
//    选/换客户        → 商机、报价单、产品全部清空
//    选商机           → 客户对齐成商机所属客户；产品先按商机自己的明细填，
//                      再异步取该商机**最新一版报价单**，取到就升级成报价单的编号与产品
//                      （产品优先级：报价单 > 商机）
//    清空商机         → 报价单、产品清空（客户保留，它是必填项，不该被连带清掉）
//    选报价单         → 商机（报价单挂了商机时才对齐）、客户一起对齐；产品整份替换
//    清空报价单       → 产品清空
//
//  ⚠️ 对齐只写 model 的字段，**不能再触发选择器的 onSelect** —— 两个 handler 互相触发
//     会绕成死循环（选了商机自动带出报价单，报价单又去对齐商机……）。
// ---------------------------------------------------------------------------

/** 客户对齐：只写值，不触发级联清空（它是「派生」动作，不是用户改客户） */
function alignCustomer(model, row) {
  if (!row?.customerId) return
  model.customerId = row.customerId
  model.customerName = row.customerName ?? model.customerName
}

/** 报价单与产品一起清掉（换上游时要成对清，不能只清一半） */
function clearQuotationAndItems(model) {
  model.quotationNo = ''
  model.quotationId = null
  model.items = []
}

/** 换客户：下游（商机 / 报价单 / 产品）都不再属于新客户，一起清掉 */
function clearDownstream(model) {
  model.opportunityName = ''
  model.opportunityId = null
  clearQuotationAndItems(model)
}

/** 选/换客户 */
function onCustomerPicked(model, row) {
  // ⚠️ 只有「客户真的变了」才清下游：重选同一个客户不该把已填的商机/明细洗掉
  const changed = String(row?.id ?? '') !== String(model.customerId ?? '')
  model.customerName = row?.name ?? ''
  model.customerId = row?.id ?? null
  // 签约人挂在客户上，换客户必须重置（保留既有行为）
  model.customerSigner = ''
  model.customerSignerId = null
  if (changed) clearDownstream(model)
}

/** 选报价单：商机（有才对齐）、客户一起对齐，产品整份替换 */
function applyQuotation(model, row) {
  clearQuotationAndItems(model)
  if (!row) return
  model.quotationNo = row.quotationNo ?? ''
  model.quotationId = row.id ?? null
  model.items = toDocumentItems(row.products)
  alignCustomer(model, row)
  // 报价单没挂商机（crm_quotation.opportunity_id 可空）→ 保留用户已选的商机。
  // 与后端 ContractRelationSupport 的规则一致：报价单挂了商机才以它为准。
  if (row.opportunityId != null) {
    model.opportunityId = row.opportunityId
    model.opportunityName = row.opportunityName ?? ''
  }
}

/**
 * 选商机
 *
 * 先同步把「客户 + 商机自己的产品」填上（商机没有报价单时这就是最终结果，也保证
 * 自动带出报价单那一步失败时表单不会留空），再异步取最新一版报价单升级覆盖。
 *
 * 取「第一行」即最新一版：`simpleList` 的排序是 `create_time desc, quotation_id desc`，
 * 而 `version` 就是建单时的 `maxVersion + 1`，两者等价。
 */
async function onOpportunityPicked(model, row) {
  clearDownstream(model)
  if (!row) return
  const opportunityId = row.id
  model.opportunityName = row.name ?? ''
  model.opportunityId = opportunityId ?? null
  alignCustomer(model, row)
  model.items = toDocumentItems(row.products)
  // 没有 id（理论上选择器不会给出这种行）就不要去查报价单：
  // 不带 opportunityId 的 simple-list 是**不过滤**的，会带出别人家的报价单
  if (!opportunityId) return

  try {
    const page = await getQuotationSimpleList({ opportunityId, pageNo: 1, pageSize: 1 })
    const latest = page?.list?.[0]
    // ⚠️ 竞态守卫：等响应的这段时间里，用户可能又换了一个商机。
    //    那份响应此时已经过期 —— 套用上去会让报价单属于**上一个**商机，
    //    保存时轻则被 2304 拒掉，重则被后端按报价单静默对齐成另一个商机。
    if (!latest || String(model.opportunityId) !== String(opportunityId)) return
    applyQuotation(model, latest)
  } catch {
    // 失败提示已由 request.js 的响应拦截器统一弹出（api 层不碰 UI）；
    // 这里保持「商机自己的产品」这个兜底结果，用户也可以手动去选报价单。
  }
}

export const FIELDS = [
  { prop: 'contractName', label: '合同名称', type: 'input', required: true, maxlength: 128 },
  {
    prop: 'contractNo',
    label: '合同编号',
    // 编号由后端的编号规则引擎生成（ContractServiceImpl.create 里的
    // businessNumberService.next("CONTRACT")），请求体里根本没有这个字段 ——
    // 所以这里只读展示，不要让用户以为填了有用。
    type: 'readonly',
    tip: '保存时由编号规则引擎自动生成'
  },
  {
    prop: 'customerName',
    label: '客户名称',
    type: 'selector',
    selector: 'customer',
    extraProp: 'customerId',
    required: true,
    // 选了商机/报价单后客户是**派生值**：置为只读，免得用户改成另一个客户
    // 又在保存时被后端 2304 拒掉（改客户会连带改数据权限，后端刻意不静默改写）。
    disabled: (model) => !!model.opportunityId || !!model.quotationId,
    tip: '选择商机 / 报价单后，客户会自动对齐为它们所属的客户（此时不可手改）',
    onSelect: onCustomerPicked
  },
  {
    prop: 'opportunityName',
    label: '商机名称',
    type: 'selector',
    selector: 'opportunity',
    extraProp: 'opportunityId',
    // 选中商机 → 带出客户，并带出产品（有报价单就是最新一版报价单的产品，
    // 没有报价单就是商机自己的明细）
    onSelect: onOpportunityPicked
  },
  {
    // 输入框里显示报价单名称给人看，落库的是编号（列表列要的就是编号）
    prop: 'quotationNo',
    label: '报价单编号',
    type: 'selector',
    selector: 'quotation',
    placeholder: '请选择报价单',
    // 只列「这个商机」（没选商机时只列「这个客户」）的报价单 ——
    // 否则很容易选中别家客户/别的商机的单子，保存时被后端 2304 拒掉。
    // 客户签约人也是用同一个机制传参的（见 FormField 的 requestParams）。
    requestParams: (model) =>
      model.opportunityId ? { opportunityId: model.opportunityId } : { customerId: model.customerId },
    onSelect: applyQuotation
  },
  {
    prop: 'contractType',
    label: '合同类型',
    type: 'select',
    options: () => dictOptions('crm_contract_type'),
    required: true
  },
  { prop: 'signDate', label: '签约日期', type: 'date' },
  { prop: 'startDate', label: '合同开始时间', type: 'date' },
  { prop: 'endDate', label: '合同结束时间', type: 'date' },
  { prop: 'ownerName', label: '负责人', type: 'selector', selector: 'owner', extraProp: 'ownerUserId' },
  {
    prop: 'customerSigner',
    label: '客户签约人',
    type: 'selector',
    selector: 'customerSigner',
    requestParams: (model) => ({ customerId: model.customerId }),
    onSelect: (model, row) => {
      model.customerSigner = row?.name ?? ''
      model.customerSignerId = row?.id ?? null
    }
  },
  {
    prop: 'companySigner',
    label: '公司签约人',
    type: 'selector',
    selector: 'companySigner',
    extraProp: 'companySignerId'
  },
  { prop: 'items', label: '产品明细', type: 'items', span: 24 },
  {
    prop: 'amount',
    label: '整单最终价（含税）',
    type: 'number',
    span: 24,
    precision: 2,
    disabled: true,
    tip: '等于明细行金额之和，由系统校验',
    compute: (model) => calcItemsTotal(model.items).totalWithTax
  },
  { prop: 'remark', label: '备注', type: 'textarea', span: 24, maxlength: 500 }
]

export const emptyForm = () => ({
  contractName: '',
  contractNo: '',
  customerName: '',
  customerId: null,
  opportunityName: '',
  opportunityId: null,
  quotationNo: '',
  quotationId: null,
  contractType: 1,
  signDate: '',
  startDate: '',
  endDate: '',
  ownerName: '',
  ownerUserId: null,
  customerSigner: '',
  customerSignerId: null,
  companySigner: '',
  companySignerId: null,
  items: [],
  amount: 0,
  remark: ''
})
