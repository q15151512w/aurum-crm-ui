import { getUserOptions, getRolePage, getRoleGroupList } from "@/api/system";
import {
  getCustomerSimpleList,
  getCustomerOwnerOptions,
  getContactOptions,
} from "@/api/customer";
import { getLeadSimpleList } from "@/api/lead";
import {
  getOpportunitySimpleList,
  getQuotationSimpleList,
} from "@/api/opportunity";
import { getPaymentSimpleList } from "@/api/finance";
import { getContractPage } from "@/api/contract";
import { getProductSimpleList, getProductCategoryTree } from "@/api/product";

/**
 * 通用选择器注册表 ⭐
 *
 * 原型里出现 30 多次的「选择客户 / 选择商机 / 选择报价单 / 负责人 / 直属上级 / …」
 * 本质是**同一个组件、不同数据源**（《01-原型梳理》第 7 节的复用洞察，
 * 《05-接口文档》第十节把后端也统一成了 `GET /{模块}/{资源}/simple-list`）。
 *
 * 所以这里只写「数据源 + 列 + 单选还是多选」，选择器组件本身一份。
 *
 * ⚠️ 已知的契约缺口（下一轮处理）
 *    文档第十节约定 simple-list 返回精简字段 `{ id, name, extra }`，
 *    但 mock 下 `queryPage` 返回的是**完整行**，所以下面这些列在 mock 里都有值。
 *    接真实接口时，`extra` 之外的列会全变成「--」——
 *    届时要给每个资源明确 `extra` 的格式（如产品为 `编码 / 单位 / 售价 / 成本价`），
 *    或者让明细编辑器按需懒调详情接口。已记入遗留清单。
 */

/** 金额列的格式化，避免在列定义里重复写 */
const money = (v) => {
  const n = Number(v);
  return Number.isFinite(n)
    ? n.toLocaleString("zh-CN", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
    : "--";
};

/**
 * 百分比列的格式化（税率这类库里的 DECIMAL(5,2)）
 *
 * ⚠️ 先判空再 Number：`Number('')` 是 0、`Number(null)` 也是 0，
 * 直接算会把「没填税率」显示成 `0%`，看起来像产品真的配了零税率。
 */
const percent = (v) => {
  if (v === null || v === undefined || v === "") return "--";
  const n = Number(v);
  return Number.isFinite(n) ? `${n}%` : "--";
};

/**
 * 人员类选择器（负责人 / 直属上级 / 部门负责人 / 客户签约人 / 公司签约人 / 选择角色人员）
 * 这 6 处共用 `GET /system/user/options`，列的差别只是「签约人只要姓名」
 *
 * ⚠️ 数据源必须是 `/system/user/options`（**仅需登录**），
 *    **不要**改回 `/system/user/simple-list` —— 那条要求 `system:user:list`，
 *    种子里只有超管有，销售角色调用会 403。
 *    症状是：线索/商机/报价单/合同表单里的「负责人」下拉加载不出来，
 *    既选不了也回显不了，且**看起来像前端 bug**（下拉空白，没有明显报错）。
 */
/**
 * `withDeptTree`：弹窗左侧带「组织架构」树面板（原型上负责人就是左树右表的布局），
 * 点击部门节点按子树过滤右侧人员。EntitySelectorDialog 见该字段。
 */
const userSelector = (title, columns) => ({
  api: getUserOptions,
  title,
  searchPlaceholder: "姓名 / 手机号码 / 部门",
  columns,
  multiple: false,
  withDeptTree: true,
});

/** 列口径与原型一致：姓名 / 编号 / 角色 / 联系电话 */
const USER_COLUMNS = [
  { prop: "name", label: "姓名", minWidth: 90 },
  { prop: "username", label: "编号", minWidth: 100 },
  { prop: "roleName", label: "角色", minWidth: 100 },
  { prop: "phone", label: "联系电话", minWidth: 130 },
];

/** 签约人只需要姓名，列多了反而难选 */
const SIGNER_COLUMNS = [
  { prop: "name", label: "姓名", minWidth: 120 },
  { prop: "deptName", label: "部门", minWidth: 120 },
];

export const SELECTOR_REGISTRY = {
  // —— 人员类 ——
  owner: userSelector("负责人", USER_COLUMNS),
  superior: userSelector("选择直属上级", USER_COLUMNS),
  deptLeader: userSelector("选择部门负责人", USER_COLUMNS),
  customerSigner: {
    api: getContactOptions,
    title: "选择客户签约人",
    searchPlaceholder: "姓名 / 手机号码 / 职务",
    columns: [
      { prop: "name", label: "姓名", minWidth: 120 },
      { prop: "title", label: "职务", minWidth: 120 },
      { prop: "phone", label: "手机号码", minWidth: 130 },
    ],
    multiple: false,
  },
  companySigner: userSelector("选择公司签约人", SIGNER_COLUMNS),
  /** 分配角色成员，一处多选 */
  roleUser: { ...userSelector("选择角色人员", USER_COLUMNS), multiple: true },

  /**
   * 销售负责人（客户新增/修改、公海分配用）。
   * 数据源是 GET /crm/customer/owner-options → SalesOwnerRespVO，
   * 只含销售角色用户；api 层已映射成通用 { id, name }。
   *
   * 与 owner 同款左树右表布局（withDeptTree），列口径也对齐 USER_COLUMNS ——
   * mock 下数据来自 user 表所以有编号/角色；真实后端 SalesOwnerRespVO 若没有
   * 这些字段就显示「--」，与注册表顶部「已知契约缺口」同一处理。
   */
  salesOwner: {
    api: getCustomerOwnerOptions,
    title: "负责人",
    searchPlaceholder: "姓名 / 手机号码 / 部门",
    multiple: false,
    withDeptTree: true,
    columns: USER_COLUMNS,
  },

  // —— 客户 ——
  customer: {
    api: getCustomerSimpleList,
    title: "选择客户",
    searchPlaceholder: "客户名称 / 负责人",
    multiple: false,
    columns: [
      { prop: "name", label: "客户名称", minWidth: 160 },
      { prop: "ownerName", label: "负责人", minWidth: 90 },
      { prop: "phone", label: "联系电话", minWidth: 130 },
      { prop: "level", label: "客户级别", minWidth: 100 },
    ],
  },

  // —— 线索 ——
  lead: {
    api: getLeadSimpleList,
    title: "选择线索",
    searchPlaceholder: "线索名称",
    multiple: false,
    columns: [
      { prop: "name", label: "线索名称", minWidth: 140 },
      { prop: "ownerName", label: "负责人", minWidth: 90 },
      { prop: "phone", label: "联系电话", minWidth: 130 },
    ],
  },

  // —— 商机 ——
  opportunity: {
    api: getOpportunitySimpleList,
    title: "选择商机",
    searchPlaceholder: "商机名称",
    multiple: false,
    columns: [
      { prop: "name", label: "商机名称", minWidth: 160 },
      { prop: "customerName", label: "客户", minWidth: 150 },
      { prop: "ownerName", label: "负责人", minWidth: 90 },
    ],
  },

  // —— 报价单 ——
  quotation: {
    api: getQuotationSimpleList,
    title: "选择报价单",
    searchPlaceholder: "报价单名称 / 商机名称",
    multiple: false,
    columns: [
      { prop: "name", label: "报价单名称", minWidth: 170 },
      { prop: "quotationNo", label: "报价单编号", minWidth: 120 },
      { prop: "customerName", label: "客户", minWidth: 140 },
    ],
  },

  // —— 角色（人员表单选角色用；没有 simple-list 接口，直接用分页列表） ——
  role: {
    api: getRolePage,
    title: "选择角色",
    searchPlaceholder: "角色名称 / 权限字符",
    multiple: false,
    columns: [
      { prop: "name", label: "角色名称", minWidth: 140 },
      { prop: "roleKey", label: "权限字符", minWidth: 140 },
      { prop: "dataScope", label: "数据范围", minWidth: 130 },
    ],
  },

  // —— 角色组（「删除角色组」要先选中一个组） ——
  roleGroup: {
    api: getRoleGroupList,
    title: "选择角色组",
    searchPlaceholder: "角色组名称",
    multiple: false,
    columns: [
      { prop: "name", label: "角色组名称", minWidth: 180 },
      { prop: "roleCount", label: "角色数", minWidth: 100 },
      { prop: "remark", label: "备注", minWidth: 160 },
    ],
  },

  // —— 合同（回款 / 发票表单关联合同用） ——
  // 文档第十节没有给 /crm/contract/simple-list，直接用分页列表接口
  contract: {
    api: getContractPage,
    title: "选择合同",
    searchPlaceholder: "合同名称 / 合同编号 / 客户",
    multiple: false,
    columns: [
      { prop: "name", label: "合同名称", minWidth: 170 },
      { prop: "contractNo", label: "合同编号", minWidth: 130 },
      { prop: "customerName", label: "客户", minWidth: 150 },
      { prop: "finalAmount", label: "合同金额", minWidth: 120, format: money },
    ],
  },

  payment: {
    api: getPaymentSimpleList,
    title: "选择已确认回款",
    searchPlaceholder: "回款编号 / 客户 / 合同",
    multiple: false,
    columns: [
      { prop: "paymentNo", label: "回款编号", minWidth: 170 },
      { prop: "customerName", label: "客户", minWidth: 140 },
      { prop: "contractName", label: "合同", minWidth: 160 },
      { prop: "amount", label: "回款金额", minWidth: 120, format: money },
    ],
  },

  // —— 产品分类（产品表单选类型用；树接口没有 simple-list 版本） ——
  productCategory: {
    api: getProductCategoryTree,
    title: "选择产品类型",
    searchPlaceholder: "类型名称 / 类型编号",
    multiple: false,
    columns: [
      { prop: "name", label: "类型名称", minWidth: 160 },
      { prop: "code", label: "类型编号", minWidth: 140 },
    ],
  },

  // —— 产品（报价单/合同的「添加产品」用，多选一次加多行） ——
  product: {
    api: getProductSimpleList,
    title: "添加产品",
    searchPlaceholder: "产品名称",
    multiple: true,
    columns: [
      { prop: "name", label: "产品名称", minWidth: 120 },
      { prop: "code", label: "产品编号", minWidth: 110 },
      { prop: "categoryName", label: "产品分类", minWidth: 110 },
      { prop: "unitName", label: "单位", minWidth: 70 },
      { prop: "salePrice", label: "售价", minWidth: 100, format: money },
      // 税率：选中产品后它会自动写进明细行的 tax_rate（见 ProductItemEditor.onProductsPicked），
      // 放在售价右边，选产品时能同时看到价格与税率
      { prop: "taxRate", label: "税率(%)", minWidth: 90, format: percent },
      { prop: "costPrice", label: "成本价", minWidth: 100, format: money },
    ],
  },
};

/** 取配置；key 写错时返回 null，让调用方给个明确的提示而不是整页崩掉 */
export function getSelectorConfig(key) {
  return SELECTOR_REGISTRY[key] || null;
}

/** 一行数据在选择器里显示什么文字 */
export function selectorLabel(row) {
  return row?.name ?? row?.label ?? "";
}
