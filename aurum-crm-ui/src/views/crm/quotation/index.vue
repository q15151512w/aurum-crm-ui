<template>
  <pro-list
    ref="listRef"
    title="商机报价单"
    add-text="新增报价"
    :fetcher="getQuotationPage"
    :columns="columns"
    :filters="FILTERS"
    :toolbar="TOOLBAR"
    search-placeholder="报价单名称/商机名称"
    detail-path="/crm/quotation/:id"
    @add="onAdd"
    @action="onAction"
    @toggle-star="onToggleStar"
  >
    <!-- 报价单状态：报价中=进行中，已生成合同=成功，已失效=作废 -->
    <template #cell-status="{ value }">
      <el-tag :type="QUOTATION_STATUS_TAG[value] || 'info'" effect="plain" size="small">
        {{ value }}
      </el-tag>
    </template>

    <!--
      关联合同：本报价单转出来的合同（1:N，允许重复转换），指向**最新一份**。
      后端从 crm_contract.quotation_id 反查后补值；一份都没有时 contractId 为空 → 显示 --。

      这是本页唯一对原型 14 列表头的偏离。加它的理由：「已生成合同」如果只是个标签，
      用户看到状态变了却找不到合同，只能去合同列表里靠编号肉眼翻 —— 状态就成了死信息。
    -->
    <template #cell-contractNo="{ row }">
      <el-tooltip
        v-if="row.contractId"
        :content="
          row.contractCount > 1
            ? `共 ${row.contractCount} 份合同，点击查看最新一份`
            : '点击查看合同详情'
        "
        placement="top"
      >
        <el-button link type="primary" @click="openContract(row)">
          {{ row.contractNo || '查看合同' }}
        </el-button>
      </el-tooltip>
      <span v-else>--</span>
    </template>

    <!-- 整单折扣：库里存的是数字（如 15），原型上表头带 %，单元格显示成 15% -->
    <template #cell-discount="{ value }">
      {{ value === null || value === undefined || value === '' ? '--' : `${value}%` }}
    </template>
    <template #filter-right>

      <el-button @click="onExport">导出</el-button>

      <el-button @click="onAdvancedFilter">高级筛选</el-button>

    </template>

  </pro-list>

  <config-form-dialog
    v-model="visible"
    :title="title"
    :fields="FIELDS"
    :model="form"
    :submitting="submitting"
    width="1080px"
    label-width="110px"
    @submit="submit"
  />

  <!-- 导出下载弹窗：点「下载文件」才下载，点 X /「稍后再说」只关闭 -->
  <export-download-dialog v-model="exportVisible" :download-url="exportUrl" :filename="exportName" @downloaded="onDownloaded" />
</template>

<script setup>
import { ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import ProList from '@/components/ProList.vue'
import ConfigFormDialog from '@/components/form/ConfigFormDialog.vue'
import ExportDownloadDialog from '@/components/ExportDownloadDialog.vue'
import { exportNameOf } from '@/utils/exportName'
import {
  getQuotationPage,
  deleteQuotation,
  exportQuotation,
  getQuotationDetail,
  createQuotation,
  updateQuotation,
  starQuotation,
  unstarQuotation,
  convertQuotationToContract,
  voidQuotation,
  // ⚠️ 原先漏了这个 import，而下面 watch(form.opportunityId) 一直在调它 ——
  //    在报价单表单里选/换一次「报价商机」就抛 ReferenceError。
  //    vite.config.js 的 AutoImport 只自动导入 vue / vue-router / pinia，兜不住 api 函数；
  //    `npm run build` 也不会报（rollup 不检查未声明的全局变量）——
  //    正是《开发注意事项》第 19 条记的那类坑，靠 check:mock 才抓得住。
  getOpportunityDetail
} from '@/api/opportunity'
import { useFormDialog } from '@/composables/useFormDialog'
import { calcItemsTotal, round2 } from '@/utils/number'
// 明细行映射与合同表单共用一份（同一结构、同一个编辑器），别在这里再写一遍
import { toDocumentItems } from '@/utils/documentItems'
import { QUOTATION_STATUS_TAG } from '@/constants/statusTags'

const listRef = ref(null)
const router = useRouter()

/**
 * 表格列
 *
 * 顺序与宽度取自原型「商机报价单」页的表头（按元件绝对坐标的 left 升序提取）。
 * 一律用 minWidth，让表格自适应内容区宽度。
 *
 * ⚠️ 「关联合同」是本页**唯一**偏离原型的列（原型 14 列），插在「状态」右侧 ——
 *    理由见模板里 #cell-contractNo 的注释。
 */
const columns = [
  { prop: 'name', label: '报价单名称', minWidth: 116, link: true },
  { prop: 'quotationNo', label: '报价单编号', minWidth: 117 },
  { prop: 'opportunityName', label: '报价商机', minWidth: 117 },
  { prop: 'quoteDate', label: '报价日期', minWidth: 162 },
  { prop: 'customerName', label: '客户名称', minWidth: 119 },
  { prop: 'ownerName', label: '负责人', minWidth: 80 },
  { prop: 'status', label: '状态', minWidth: 100 },
  { prop: 'contractNo', label: '关联合同', minWidth: 120 },
  { prop: 'productCount', label: '商品总数', minWidth: 80 },
  { prop: 'totalAmount', label: '合计价格', minWidth: 104, money: true },
  { prop: 'discount', label: '整单折扣(%)', minWidth: 120 },
  { prop: 'finalAmount', label: '整单最终价', minWidth: 119, money: true },
  { prop: 'profit', label: '整单利润', minWidth: 99, money: true },
  { prop: 'creator', label: '创建人', minWidth: 80 },
  { prop: 'createTime', label: '创建时间', minWidth: 171 }
]

// 状态配色抽到 constants/statusTags.js：报价单**详情页**也要显示同一个状态标签，
// 两处引同一份映射，颜色才不会各写一套后漂移（详情页见 views/crm/quotation/detail.vue）。
// 列表模板里的 #cell-status 与下面 FIELDS 的 tagType 都用它。

/** 原型筛选胶囊：数据范围 + 三种报价单状态 */
const FILTERS = [
  { label: '全部报价', value: 'all' },
  { label: '我负责的报价', value: 'mine' },
  { label: '下属负责的报价', value: 'subordinate' },
  { label: '我关注的报价', value: 'starred' },
  { label: '报价中', value: 'quoting' },
  { label: '已生成合同', value: 'contracted' },
  { label: '已失效', value: 'expired' }
]

/**
 * 批量按钮
 *
 * 原型报价单页只有「编辑 / 删除」。**「转合同 / 作废」是本轮新增的两个状态动作** ——
 * 报价单的状态现在只能由这两个动作驱动（表单里的状态下拉已改成只读展示），
 * 不给入口就等于状态永远停在「报价中」。
 *
 * 「转合同」为什么必须单选：接口返回的是**一个**合同 ID
 * （`POST /crm/quotation/{id}/convert-contract`），批量转合同既没有接口也没有语义
 * （一次转出多份合同，用户无法知道哪份对应哪个报价单）。
 * 「作废」支持批量，与「删除」同一形态。
 */
const TOOLBAR = [
  { key: 'edit', perm: 'crm:quotation:update', label: '编辑' },
  { key: 'convert', perm: 'crm:quotation:update', label: '转合同' },
  { key: 'void', perm: 'crm:quotation:update', label: '作废' },
  { key: 'delete', perm: 'crm:quotation:delete', label: '删除' }
]

async function onExport() {
  try {
    const q = listRef.value?.getQuery?.() || {}
    const url = await exportQuotation({ ...q })
    exportUrl.value = url || ''
    exportName.value = exportNameOf(FILTERS, q.scope, '商机报价单')
    exportVisible.value = true
  } catch {
    // mock 模式下会提示「接口尚未实现」；真实环境的失败提示由 request.js 统一处理
  }
}

const exportVisible = ref(false)
const exportUrl = ref('')
const exportName = ref('')

function onDownloaded() {
  ElMessage.success('下载完成')
}

function onAdvancedFilter() {
  ElMessage.info('高级筛选尚未实现')
}

/**
 * 跳到这份报价单生成的合同详情
 *
 * 不用 ProList 的 `detail-path`：那个机制是「跳本行自己的详情」（用 :id 替换本行 id），
 * 这里要跳的是**另一个资源**（合同），只能自己拼路径。
 */
function openContract(row) {
  if (!row.contractId) return
  router.push(`/crm/contract/${row.contractId}`)
}

/**
 * 关注 / 取消关注
 *
 * 与线索列表（views/crm/lead/index.vue#onToggleStar）同一套做法：
 * **先翻转图标再发请求**（乐观更新），且**不再无条件整表重取**。
 * 接口是幂等的 star/unstar 一对（刻意不用 toggle），所以即使 row.starred 过期，
 * 也只会多打一次等价请求，不会把 crm_star（biz_type = 4）里的记录翻错；失败时回滚图标即可。
 *
 * ⚠️ 别再改回「发完请求 → reload()」：
 *   ① reload() 会重新拉一整页（多一次远程库往返，图标要等两次请求才变，像"点了没反应"）；
 *   ② useTable.reload() 会把 pageNo 归 1 —— 在第 3 页点个星标就被踢回第 1 页。
 * 只有「我关注的报价」口径下行的**集合**才会随关注态改变，那时才需要重新取数。
 */
async function onToggleStar(row) {
  const wasStarred = row.starred
  // 「我关注的报价」口径下，取消关注会让这一行从结果集里消失，必须重新取数；
  // 其余口径星标只影响图标本身，本地翻转就够。
  const needReload = listRef.value?.getQuery?.().scope === 'starred'

  row.starred = !wasStarred   // 乐观翻转：先给反馈，失败再回滚
  try {
    if (wasStarred) {
      await unstarQuotation(row.id)
    } else {
      await starQuotation(row.id)
    }
    if (needReload) {
      listRef.value?.reload()
    }
  } catch {
    row.starred = wasStarred   // 回滚，别让图标和库里的状态对不上
    // 失败提示已由 request.js 统一处理
  }
}

/**
 * 整单折扣：**来自关联商机**，本单不存折扣
 *
 * crm_quotation 没有折扣列、表单里也没有这一项 —— 折扣是商务条件，全系统只在商机里
 * 维护一处（crm_opportunity.discount_rate）。所以弹窗里的折后价必须用「同一个来源 +
 * 同一个公式」算出来，否则就会出现「弹窗显示 10000、列表显示 9000」这种同名不同值。
 * 口径总览见 docs/13-商机与报价单金额口径总览.md。
 */
const currentDiscount = ref(0)

/**
 * 新增/编辑表单字段
 *
 * ⚠️ 金额口径 = 《02-建表文档》3.6 + 关联商机的整单折扣：
 *      totalAmount  = 不含税合计（Σ 行不含税）
 *      taxAmount    = 税额（Σ 行税额）
 *      finalAmount  = **折后**价税合计 = Σ 行金额 ×(1 − 商机折扣/100)
 *    列表列「合计价格（不含税）」显示 totalAmount、「整单最终价」显示 finalAmount（折后），
 *    与后端 QuotationRespVO 的同名字段是同一口径、同一算法。
 *    三个都由明细算出来、置灰不让手填：服务端会按 3.6 从明细重算并覆盖
 *    （文档 3.6 硬规则 2：单据金额必须等于明细汇总）。
 *
 * ⚠️ FIELDS 保持**普通数组**（不要改成 computed）：`npm run check:static` 靠
 *    `const X_FIELDS = [` 这个形状抽取字段块来做「type 有没有控件 / selector 有没有注册 /
 *    prop 有没有进 emptyForm」三项检查，换成 computed 会让这些检查**静默跳过**这个文件。
 *    需要随运行时变化的那一项（折扣来源提示）用 getter 表达。
 */
const FIELDS = [
  { prop: 'name', label: '报价单名称', type: 'input', required: true, maxlength: 128 },
  {
    prop: 'customerName',
    label: '客户名称',
    type: 'selector',
    selector: 'customer',
    extraProp: 'customerId',
    required: true,
    // 选了「报价商机」后客户是**派生值**：置为只读。
    // 后端会校验「报价单的客户 == 所选商机的客户」（不一致 → 2253），
    // 允许手改就等于让用户必然撞一次报错弹窗。要换客户先清空商机。
    disabled: (model) => !!model.opportunityId,
    tip: '选择报价商机后，客户会自动对齐为该商机的客户（此时不可手改）'
  },
  {
    prop: 'opportunityName',
    label: '报价商机',
    type: 'selector',
    selector: 'opportunity',
    extraProp: 'opportunityId',
    // 选中商机 → 带出客户 / 负责人 / 产品明细 / 备注（只在**用户选中**时发生，
    // 编辑回填不走这条路，见 onOpportunityPicked 的注释）
    onSelect: onOpportunityPicked
  },
  { prop: 'quoteDate', label: '报价日期', type: 'date', required: true },
  { prop: 'ownerName', label: '负责人', type: 'selector', selector: 'owner', extraProp: 'ownerUserId' },
  {
    prop: 'status',
    label: '状态',
    // ⚠️ **只读回显，不是下拉**。状态只能由「转合同 / 作废」两个动作驱动。
    //
    //    原先这里是可选的下拉，等于留了个后门：能把一张报价单直接改成「已生成合同」
    //    而根本没有合同（列表上看着正常，合同却不存在），也能把「已失效」改回「报价中」。
    //
    //    改成只读后，「回显当前值 + 原样提交」也不会把状态洗掉：后端 update 会拿请求标签
    //    与**当前库值的归并标签**比对，相同就不写 status 列
    //    （QuotationServiceImpl#resolveStatusUpdate 的防漂移）。
    //
    //    type 用 statusTag 而不是 readonly：读出来的要是**和列表同色的标签**。
    //    颜色用 constants/statusTags.js 里那一份，列表 / 弹窗 / 详情页三个地方同一个来源。
    type: 'statusTag',
    tagType: QUOTATION_STATUS_TAG,
    tip: '状态由「转合同 / 作废」动作驱动，不能手改'
  },
  { prop: 'products', label: '产品明细', type: 'items', span: 24 },
  {
    prop: 'totalAmount',
    label: '合计价格（不含税）',
    type: 'number',
    span: 8,
    precision: 2,
    disabled: true,
    compute: (model) => calcItemsTotal(model.products).totalAmount
  },
  {
    prop: 'taxAmount',
    label: '税额',
    type: 'number',
    span: 8,
    precision: 2,
    disabled: true,
    compute: (model) => calcItemsTotal(model.products).taxAmount
  },
  {
    prop: 'finalAmount',
    label: '整单最终价（含税）',
    type: 'number',
    span: 8,
    precision: 2,
    disabled: true,
    // 折后价 = 明细价税合计 ×(1 − 商机整单折扣/100)，与后端 finalAmount 是同一公式。
    // ⚠️ 早先这里是「不打折」的 totalWithTax，于是弹窗与列表的同名列显示两个不同的数。
    compute: (model) =>
      round2(calcItemsTotal(model.products).totalWithTax * (1 - currentDiscount.value / 100)),
    // 用 getter 而不是静态字符串：折扣与商机名会在弹窗里变（选商机、编辑回填），
    // 字符串只会在模块加载时求值一次，写死就成了错的提示。
    get tip() {
      const source = form.value.opportunityId
        ? `商机《${form.value.opportunityName || '—'}》`
        : '关联商机（未选商机时按不打折）'
      return `整单折扣 ${currentDiscount.value}% 来自${source}；折扣只在商机里维护，本单不单独存折扣`
    }
  },
  { prop: 'remark', label: '备注', type: 'textarea', span: 24, maxlength: 500 }
]

const { visible, form, title, submitting, openAdd, openEdit, submit } = useFormDialog({
  label: '报价单',
  emptyForm: () => ({
    name: '',
    customerName: '',
    customerId: null,
    opportunityName: '',
    opportunityId: null,
    quoteDate: '',
    ownerName: '',
    ownerUserId: null,
    status: '报价中',
    products: [],
    totalAmount: 0,
    taxAmount: 0,
    finalAmount: 0,
    remark: ''
  }),
  create: createQuotation,
  update: updateQuotation,
  onSuccess: (mode) => {
    ElMessage.success(mode === 'add' ? '新增成功' : '修改成功')
    listRef.value?.clearSelection()
    listRef.value?.reload()
  }
})

/**
 * 选了（或换了）商机：取它的整单折扣 + **带出报价单要用的信息**
 *
 * 后端 QuotationRespVO.discount 也是这么取的（一次查询同时取商机名与折扣），
 * 这里多发一次详情请求，是为了让「整单最终价」在**保存之前**就是折后价 ——
 * 否则用户在弹窗里看到的还是不打折的数，一保存列表又变了，只能怀疑算错了。
 * 取不到（商机已删 / 不在自己数据范围内）时按 0（不打折），与后端 loadOpportunities 的兜底一致。
 *
 * ⚠️ **回显只在「用户选中商机」时发生**（下面 onOpportunityPicked 置的标记）。
 *    form.opportunityId 在**编辑回填**时同样会变 —— 那时若把商机的客户/负责人/产品写进表单，
 *    用户一打开编辑弹窗、什么都没做，已保存的数据就会被商机上的值顶掉（产品明细尤其致命）。
 *
 * ⚠️ 保留 watch 而不是把折扣搬进 onSelect：编辑回填时 currentDiscount 必须被刷新，
 *    而它是独立 ref、不是从 form 派生的 —— 拿掉 watch 会让「编辑打开后折后价显示成不打折」。
 */

/** 这次 opportunityId 变化是不是「用户刚选的」（编辑回填不是）—— 见上面那条注释 */
const pickedOpportunity = ref(false)

/**
 * 商机选择器选中回调
 *
 * 这里**只置标记**、不做取数：取数统一在下面的 watch 里，一次变化只发一个请求
 * （onSelect 与 watch 各取一次的话，选一次商机就是两个重复请求）。
 */
function onOpportunityPicked(model, row) {
  const nextId = row?.id ?? null
  // 重选同一个商机：什么都不用做（连着点两次确定不该再跑一遍回显）
  if (String(nextId ?? '') === String(model.opportunityId ?? '')) return
  model.opportunityId = nextId
  pickedOpportunity.value = true
}

/**
 * 把商机上「报价单也要用」的信息填进表单
 *
 * 只在用户选中商机时调用（理由见上面那段说明）。
 */
function applyOpportunityToForm(model, detail) {
  // 客户：报价单必须报给商机所属客户。后端会校验这一点（不一致 → 2253），前端先对齐掉，
  // 免得用户白填一遍再被拒。客户选择器此时已置为只读，两边不会打架。
  model.customerId = detail.customerId ?? null
  model.customerName = detail.customerName ?? ''

  // 负责人：不填的话后端缺省成**登录人**，主管替下属报价时报价单会静默变成主管的
  // （与 QuotationServiceImpl#buildContractReq「归属人传报价单的负责人，不传当前登录人」同一取向）。
  // 商机没负责人时不动，保持后端的缺省行为。
  if (detail.ownerUserId != null) {
    model.ownerUserId = detail.ownerUserId
    model.ownerName = detail.ownerName ?? ''
  }

  // 产品明细：整份替换成商机明细（与合同表单「选报价单 → 带出产品」同一条规则：
  // 两份上游的产品混在一起没有意义）。没有明细时是空数组，报价单允许只有表头。
  model.products = toDocumentItems(detail.products)

  // 备注：**只在报价单备注为空时**预填，绝不覆盖用户已经写好的文字
  if (!model.remark) model.remark = detail.remark ?? ''
}

watch(
  () => form.value.opportunityId,
  async (opportunityId) => {
    // 先取再清：这一次变化该不该回显，只由「是不是用户选的」决定
    const echo = pickedOpportunity.value
    pickedOpportunity.value = false

    if (!opportunityId) {
      // 清空商机：只把折扣归 0。客户 / 负责人 / 产品 / 备注都**保留** ——
      // crm_quotation.opportunity_id 可空是合法数据（可以直接给客户报价），
      // 解除关联不该顺手毁掉已经填好的明细。
      currentDiscount.value = 0
      return
    }

    try {
      const detail = await getOpportunityDetail(opportunityId)
      // 竞态守卫：等响应的这段时间里用户可能又换了一个商机，
      // 那份响应此时已经过期 —— 套用上去会让折扣与产品属于**上一个**商机
      if (String(form.value.opportunityId ?? '') !== String(opportunityId)) return
      currentDiscount.value = Number(detail?.discount) || 0
      if (echo) applyOpportunityToForm(form.value, detail)
    } catch {
      // request.js 已经统一提示过失败；折扣按 0 处理，口径与后端一致
      currentDiscount.value = 0
    }
  }
)

function onAdd() {
  openAdd()
}

async function onAction({ key, rows, ids, clear }) {
  if (key === 'edit') {
    if (ids.length !== 1) return ElMessage.warning('请选择一条记录编辑')
    // 明细行不在列表列里，必须取详情；列表行本身也拿来用，省一次字段拼装
    const detail = await getQuotationDetail(rows[0].id)
    openEdit({ ...rows[0], ...detail, products: detail?.products || [] })
    return
  }

  // ---------- 转合同：报价中 / 已生成合同 → 已生成合同 ----------
  if (key === 'convert') {
    if (ids.length !== 1) return ElMessage.warning('请选择一条报价单转合同')

    const row = rows[0]
    // 前端这道是**提示**，不是准绳：真正的守卫在后端（2252）。
    // 有它用户才能立刻知道为什么点不动，而不用等一个报错弹窗。
    if (row.status === '已失效') {
      return ElMessage.warning('已失效的报价单不能生成合同')
    }

    try {
      await ElMessageBox.confirm(
        `将按《${row.name}》的产品明细生成一份合同草稿，报价单状态变为「已生成合同」。确定吗？`,
        '转合同',
        { confirmButtonText: '确定', cancelButtonText: '取消', type: 'warning' }
      )
    } catch {
      return
    }

    let contractId = null
    try {
      contractId = await convertQuotationToContract(row.id)
    } catch {
      // 失败提示已由 request.js 统一处理（例如 2252「报价单没有产品明细，无法生成合同」）
      return
    }

    clear()
    await listRef.value?.reload()

    // 转换完直接给一个去合同详情的入口：新合同号在列表「关联合同」列也能看到，
    // 但用户此刻往往接着就要去补签约日期、签约人这些报价单上没有的信息
    try {
      await ElMessageBox.confirm('已生成合同，是否前往查看？', '转换成功', {
        confirmButtonText: '查看合同',
        cancelButtonText: '留在本页',
        type: 'success'
      })
    } catch {
      return
    }
    router.push(`/crm/contract/${contractId}`)
    return
  }

  // ---------- 作废：报价中 → 已失效 ----------
  if (key === 'void') {
    // 只有「报价中」（后端归并了 0 草稿 / 1 已发出）可以作废。
    // 已生成合同的单子有下游合同，先处理合同；已失效是终态 —— 与后端口径一致。
    if (rows.some((r) => r.status !== '报价中')) {
      return ElMessage.warning('只有「报价中」的报价单可以作废；已生成合同的请先处理关联合同')
    }
    try {
      await ElMessageBox.confirm(
        `作废后选中的 ${ids.length} 条报价单将变为「已失效」，且不能再转合同。确定吗？`,
        '提示',
        { confirmButtonText: '确定', cancelButtonText: '取消', type: 'warning' }
      )
    } catch {
      return
    }
    try {
      await Promise.all(ids.map((id) => voidQuotation(id)))
    } catch {
      return
    }
    ElMessage.success('作废成功')
    clear()
    listRef.value?.reload()
    return
  }

  if (key === 'delete') {
    try {
      await ElMessageBox.confirm(`确定删除选中的 ${ids.length} 条报价单吗？`, '提示', {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      })
    } catch {
      return
    }
    await Promise.all(ids.map((id) => deleteQuotation(id)))
    ElMessage.success('删除成功')
    clear()
    listRef.value?.reload()
  }
}
</script>
