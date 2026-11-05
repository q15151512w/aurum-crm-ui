/**
 * 省市区三级数据（静态小数据集）
 *
 * ⚠️ 这是临时数据源
 *
 * 后端 `/crm/region`（表 crm_region，《02-建表文档》第四节第 7 项，标注「可选」）还没实现，
 * 所以先内置一份够用的。等接口就绪后，把 `REGION_OPTIONS` 换成一次接口请求的结果即可，
 * 组件（RegionCascader.vue）不用改。
 *
 * 选这份数据的原则：**必须覆盖 `src/mock/db.js` 里 REGIONS 用到的全部地区**，
 * 否则打开编辑弹窗时地区字段回填不出来。
 *   - 广东省广州市天河区 / 浙江省宁波市鄞州区 / 浙江省宁波市奉化区
 *   - 江苏省苏州市工业园区 / 山东省潍坊市寒亭区
 * 注意「工业园区」不是标准行政区划，但 mock 数据里有 —— 特意保留，别当脏数据删掉。
 *
 * 原型的示例数据是「山东省潍坊市寒亭区 / 江西省上饶市信州区」，也一并覆盖了。
 */

const region = (label, children) => ({ value: label, label, children })

const leaf = (label) => ({ value: label, label })

export const REGION_OPTIONS = [
  region('山东省', [
    region('潍坊市', [leaf('寒亭区'), leaf('奎文区'), leaf('潍城区'), leaf('坊子区')]),
    region('济南市', [leaf('历下区'), leaf('市中区'), leaf('天桥区')]),
    region('青岛市', [leaf('市南区'), leaf('崂山区'), leaf('黄岛区')])
  ]),
  region('江西省', [
    region('上饶市', [leaf('信州区'), leaf('广丰区'), leaf('婺源县')]),
    region('南昌市', [leaf('东湖区'), leaf('西湖区'), leaf('青山湖区')])
  ]),
  region('广东省', [
    region('广州市', [leaf('天河区'), leaf('越秀区'), leaf('海珠区'), leaf('白云区')]),
    region('深圳市', [leaf('南山区'), leaf('福田区'), leaf('宝安区'), leaf('龙岗区')])
  ]),
  region('浙江省', [
    region('宁波市', [leaf('鄞州区'), leaf('奉化区'), leaf('海曙区'), leaf('江北区')]),
    region('杭州市', [leaf('西湖区'), leaf('余杭区'), leaf('滨江区')])
  ]),
  region('江苏省', [
    region('苏州市', [leaf('工业园区'), leaf('姑苏区'), leaf('吴中区'), leaf('昆山市')]),
    region('南京市', [leaf('玄武区'), leaf('鼓楼区'), leaf('江宁区')])
  ])
]

/** 级联选择器的值 → '广东省广州市天河区' */
export function regionToText(path) {
  if (!Array.isArray(path) || !path.length) return ''
  return path.join('')
}

/**
 * '广东省广州市天河区' → ['广东省', '广州市', '天河区']
 *
 * 解析不出来时返回空数组。调用方（RegionCascader）**必须保留原值**，
 * 否则用户打开编辑弹窗、只改了个别的字段就保存，地区就悄悄没了。
 */
export function parseRegion(text) {
  if (!text || typeof text !== 'string') return []

  for (const province of REGION_OPTIONS) {
    if (!text.startsWith(province.label)) continue

    for (const city of province.children) {
      if (!text.startsWith(province.label + city.label)) continue

      const district = city.children.find(
        (d) => text === province.label + city.label + d.label
      )
      if (district) return [province.label, city.label, district.label]

      // 省市能对上但区县对不上（数据源里没有这个区）→ 退回到省市两级，
      // 让选择器至少不丢已经认出来的部分
      return [province.label, city.label]
    }

    return [province.label]
  }

  return []
}
