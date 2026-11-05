import { dictOptions } from '@/composables/useDictOptions'

/**
 * 线索的新增/编辑表单配置
 *
 * ⚠️ 列表页（index.vue）与详情页（detail.vue）**共用这一份**。
 *    两边各写一份的话，字段口径迟早漂移 —— 而字段名一旦和列表列的 prop 对不上，
 *    新增的行在列表里就是一片「--」，且不会有任何报错。
 *
 * 字段名与后端 `LeadSaveReqDTO` 对齐：
 *   leadName / source(码值) / ownerUserId(负责人) / level(码值，与客户同一套字典) /
 *   industry(码值) / phone / email / nextContactTime / province / city / district /
 *   address / remark
 *
 * ⚠️ **字典字段一律传码值，不传中文**。后端 `LeadSaveReqDTO.source` 是 `Integer`，
 *    发中文（如 `'广告'`）会让 Jackson 反序列化失败 —— 这正是 BUG-002 的直接原因，
 *    见 `crm/docs/07-测试BUG记录.md`。列表上的中文由 index.vue 的 `#cell-xxx` slot 映射。
 *
 * 负责人用选择器：左列显示姓名（ownerName），同时把 id 写进 ownerUserId。
 *
 * 必填项按原型（新增线索弹窗）：线索名称 / 联系电话 / 客户行业 / 负责人 / 地区 / 详细地址；
 * 其余（来源 / 邮箱 / 级别 / 下次联系时间 / 客户说明）选填。
 */
export const FIELDS = [
  {
    prop: "leadName",
    label: "线索名称",
    type: "input",
    required: true,
    maxlength: 128,
    placeholder: "公司或个人名称",
  },
  {
    prop: "source",
    label: "线索来源",
    type: "select",
    // 写成函数：字典管理页改了字典，下拉立刻跟着变（见 customer/form-config.js 的说明）
    options: () => dictOptions("crm_source"),
  },
  {
    prop: "phone",
    label: "联系电话",
    type: "input",
    required: true,
    maxlength: 32,
    placeholder: "请输入电话号码",
  },
  {
    prop: "email",
    label: "邮箱",
    type: "input",
    maxlength: 128,
    rules: [{ type: "email", message: "邮箱格式不正确", trigger: "blur" }],
  },
  {
    prop: "industry",
    label: "客户行业",
    type: "select",
    required: true,
    options: () => dictOptions("crm_industry"),
  },
  {
    prop: "ownerName",
    label: "负责人",
    type: "selector",
    selector: "owner",
    extraProp: "ownerUserId",
    required: true,
    placeholder: "请选择",
  },
  {
    prop: "level",
    label: "客户级别",
    type: "select",
    options: () => dictOptions("crm_customer_level"),
  },
  { prop: "nextContactTime", label: "下次联系时间", type: "date" },
  { prop: "region", label: "地区", type: "region", required: true },
  {
    prop: "address",
    label: "详细地址",
    type: "input",
    required: true,
    maxlength: 255,
  },
  {
    prop: "remark",
    label: "客户说明",
    type: "textarea",
    span: 24,
    maxlength: 500,
    placeholder: "请输入内容",
  },
];

export const emptyForm = () => ({
  leadName: "",
  source: null,
  ownerName: "",
  ownerUserId: null,
  level: null,
  industry: null,
  phone: "",
  email: "",
  nextContactTime: "",
  region: "",
  address: "",
  remark: "",
});
