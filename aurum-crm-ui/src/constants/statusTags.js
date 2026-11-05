/**
 * 状态标签配色（列表页与详情页共用一份）
 *
 * 为什么要单独一个文件：
 *   同一个「报价中」，列表里是橙色标签；详情页若自己再写一套映射，两处迟早会不一样。
 *   颜色一旦有两个来源就会漂移 —— 这个项目已经吃过「一个项目两个 mock 开关」的亏
 *   （见《开发注意事项》第 25 条），所以这里只留一份，改配色只改这里。
 *
 * 用法：
 *   <el-tag :type="QUOTATION_STATUS_TAG[value] || 'info'">{{ value }}</el-tag>
 */

/**
 * 报价单状态 → el-tag type
 *
 * 报价中 = 进行中（橙）、已生成合同 = 成功（绿）、已失效 = 作废（灰）。
 * 后端下发的是**中文标签**（QuotationRespVO.status），所以这里直接用中文做键。
 */
export const QUOTATION_STATUS_TAG = {
  报价中: 'warning',
  已生成合同: 'success',
  已失效: 'info'
}

/**
 * 产品是否上架 → el-tag type
 *
 * 上架 = 绿、下架 = 灰。产品列表页与产品详情页共用同一个函数，
 * 免得两处各写一遍三元表达式后颜色对不上。
 */
export const shelfTagType = (onShelf) => (onShelf ? 'success' : 'info')
