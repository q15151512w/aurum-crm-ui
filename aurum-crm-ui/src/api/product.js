import request from '@/utils/request'
import { USE_MOCK, delay, mockNotImplemented } from './_mock'
import { product, productCategory, queryPage, findById, removeById, insertRow, updateById } from '@/mock/db'

/**
 * 产品与分类 —— 对应《05-接口文档.md》5.3
 */

const BASE = '/crm/product'
const CATEGORY = '/crm/product-category'

// ---------------------------------------------------------------------------
//  产品
// ---------------------------------------------------------------------------
export async function getProductPage(params) {
  if (USE_MOCK) {
    await delay()
    return queryPage(product, params)
  }
  return request({ url: BASE, method: 'get', params })
}

export async function getProductDetail(id) {
  if (USE_MOCK) {
    await delay()
    return findById(product, id)
  }
  return request({ url: `${BASE}/${id}`, method: 'get' })
}

export async function createProduct(data) {
  if (USE_MOCK) {
    await delay()
    return insertRow(product, data)
  }
  return request({ url: BASE, method: 'post', data })
}

export async function updateProduct(id, data) {
  if (USE_MOCK) {
    await delay()
    return updateById(product, id, data)
  }
  return request({ url: `${BASE}/${id}`, method: 'put', data })
}

export async function deleteProduct(id) {
  if (USE_MOCK) {
    await delay()
    return removeById(product, id)
  }
  return request({ url: `${BASE}/${id}`, method: 'delete' })
}

/**
 * 上架
 * ⚠️ mock 下必须真的改 onShelf —— 只返回 null 的话会弹「上架成功」但列表里的
 *    标签纹丝不动（这页的两个批量按钮之前就是这样）。
 */
export async function onShelfProduct(id) {
  if (USE_MOCK) {
    await delay()
    return updateById(product, id, { onShelf: true })
  }
  return request({ url: `${BASE}/${id}/on-shelf`, method: 'put' })
}

/** 下架 */
export async function offShelfProduct(id) {
  if (USE_MOCK) {
    await delay()
    return updateById(product, id, { onShelf: false })
  }
  return request({ url: `${BASE}/${id}/off-shelf`, method: 'put' })
}

/** 选择器专用 */
export async function getProductSimpleList(params) {
  if (USE_MOCK) {
    await delay()
    return queryPage(product, params)
  }
  return request({ url: `${BASE}/simple-list`, method: 'get', params })
}

/**
 * 上传产品图片（OSS）
 *
 * 对应后端《08-产品模块接口文档》4.7：multipart/form-data，字段名固定 `file`，
 * 只允许 jpg/jpeg/png/webp/gif 且 ≤5MB，返回 `{ url, objectKey }` 两个字段。
 *
 * ⚠️ **Content-Type 必须显式覆盖成 multipart/form-data**：
 *    utils/request.js 里这个 axios 实例的默认头是 `application/json;charset=utf-8`，
 *    而 axios 1.x 的 transformRequest 只要看到「FormData + application/json」，
 *    就会把 FormData **JSON 化**（见 node_modules/axios/lib/defaults/index.js 的
 *    `if (isFormData) return hasJSONContentType ? JSON.stringify(...) : data`）——
 *    结果是文件被丢掉、后端只收到 `{"file":{}}`，报 400「图片不能为空」，
 *    看起来像后端 bug，实际是请求头没覆盖。**别"顺手"删掉这个 header。**
 *    覆盖之后 axios 会把这个头交还给浏览器，由浏览器补 `boundary`。
 *
 * ⚠️ 为什么不用 /system/file/upload：
 *    产品图片是「先传图、再建产品」，此刻还没有 productId；而那个通用接口传了
 *    bizType+bizId 会写 sys_attachment，产品图片的真相却是 crm_product.image。
 *    专用接口还额外限定了「仅图片 + 5MB + 固定 crm/product/ 目录」。
 *
 * @param {File} file 用户选中的图片文件
 * @returns {Promise<{ url: string, objectKey: string }>}
 */
export async function uploadProductImage(file) {
  if (USE_MOCK) {
    await delay(600)
    console.info('[MOCK] 产品图片上传（未真正上传）：', file?.name)
    // mock 没有 OSS，用浏览器本地对象 URL 顶上，让预览与列表缩略图在 mock 下也能显示。
    // 该 URL 只在当前页面生命周期内有效；Node 环境（check:mock）没有它，所以先探测。
    const canObjectUrl =
      typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function'
    return {
      url: canObjectUrl && file ? URL.createObjectURL(file) : '',
      objectKey: `mock/product/${file?.name ?? 'image'}`
    }
  }

  const data = new FormData()
  data.append('file', file)
  return request({
    url: `${BASE}/image`,
    method: 'post',
    data,
    headers: { 'Content-Type': 'multipart/form-data' },
    // 单图最大 5MB，弱网下 30s 的默认超时不够，这一个请求单独放宽
    timeout: 60000
  })
}

/** 产品导出 */
export function exportProduct(params) {
  if (USE_MOCK) return mockNotImplemented('导出产品')
  return request({ url: `${BASE}/export`, method: 'get', params })
}

// ---------------------------------------------------------------------------
//  产品分类
// ---------------------------------------------------------------------------
export async function getProductCategoryTree(params) {
  if (USE_MOCK) {
    await delay()
    // mock 里分类是平铺的（没有 children），走 queryPage 好让关键字搜索真的能筛
    return queryPage(productCategory, params)
  }
  return request({ url: `${CATEGORY}/tree`, method: 'get', params })
}

export async function createProductCategory(data) {
  if (USE_MOCK) {
    await delay()
    return insertRow(productCategory, data)
  }
  return request({ url: CATEGORY, method: 'post', data })
}

export async function updateProductCategory(id, data) {
  if (USE_MOCK) {
    await delay()
    return updateById(productCategory, id, data)
  }
  return request({ url: `${CATEGORY}/${id}`, method: 'put', data })
}

export async function deleteProductCategory(id) {
  if (USE_MOCK) {
    await delay()
    return removeById(productCategory, id)
  }
  return request({ url: `${CATEGORY}/${id}`, method: 'delete' })
}

/** 产品类型导出 */
export function exportProductCategory(params) {
  if (USE_MOCK) return mockNotImplemented('导出产品类型')
  return request({ url: `${CATEGORY}/export`, method: 'get', params })
}
