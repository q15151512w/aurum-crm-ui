<template>
  <!--
    产品图片上传控件（单图）

    放在 el-form-item 里用，v-model 就是表单里的 imageUrl 字段（一个字符串 URL）。
    上传成功即把接口返回的 url 写回模型；点「保存」时随产品的其它字段一起提交。

    ⚠️ 这里**只上传、不落库**：后端 POST /crm/product/image 不写 sys_attachment，
       产品图片的真相是 crm_product.image。所以：
       · 没有 attachmentId，删除走不了 DELETE /system/file/{id}
       · 后端明确「不删除旧图对象」（同一 URL 可能被多个产品引用）
       「移除」因此只是把表单里的地址清空，不是删文件。
  -->
  <div class="product-image-upload">
    <!-- ---------------- 已有图片：缩略图 + 预览 + 重新上传 / 移除 ---------------- -->
    <div v-if="modelValue" class="product-image-upload__preview">
      <el-image
        :src="modelValue"
        :preview-src-list="[modelValue]"
        preview-teleported
        fit="cover"
        class="product-image-upload__thumb"
      />

      <div class="product-image-upload__ops">
        <!-- 点「重新上传」直接选新图，选完立刻上传并覆盖旧地址 -->
        <el-upload
          action="#"
          :show-file-list="false"
          :accept="ACCEPT"
          :disabled="!canEdit"
          :before-upload="beforeUpload"
          :http-request="doUpload"
        >
          <el-button size="small" :icon="UploadFilled" :disabled="!canEdit">
            {{ uploading ? '上传中…' : '重新上传' }}
          </el-button>
        </el-upload>

        <el-button
          size="small"
          link
          type="danger"
          :icon="Delete"
          :disabled="!canEdit"
          @click="remove"
        >
          移除
        </el-button>
      </div>
    </div>

    <!-- ---------------- 没有图片：虚线框，点击即选文件 ---------------- -->
    <el-upload
      v-else
      action="#"
      :show-file-list="false"
      :accept="ACCEPT"
      :disabled="!canEdit"
      :before-upload="beforeUpload"
      :http-request="doUpload"
      class="product-image-upload__uploader"
    >
      <div v-loading="uploading" class="product-image-upload__empty">
        <el-icon class="product-image-upload__plus"><Plus /></el-icon>
        <span>{{ uploading ? '上传中…' : '点击上传' }}</span>
      </div>
    </el-upload>

    <div class="product-image-upload__tip">
      支持 jpg / jpeg / png / webp / gif，单张不超过 {{ MAX_MB }}MB。
      移除只清空表单里的地址，OSS 上的原图不会被删除。
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { ElMessage } from 'element-plus'
import { Delete, Plus, UploadFilled } from '@element-plus/icons-vue'
import { uploadProductImage } from '@/api/product'

/**
 * 允许的扩展名与大小上限
 *
 * ⚠️ 必须与后端 `ProductServiceImpl` 的 `IMAGE_EXTENSIONS` / `MAX_IMAGE_SIZE_MB` 一致：
 *    前端校验只是为了早点给提示、少一次白跑的网络请求，**后端才是真正的那道门**。
 *    两边不同步时，用户会看到「前端说可以、后端报 400」这种最难解释的现象。
 *    注意后端刻意**不含 svg**（SVG 可内嵌脚本，而 bucket 是公共读 = 存储型 XSS）。
 */
const ACCEPT = '.jpg,.jpeg,.png,.webp,.gif'
const ALLOWED_EXTENSIONS = ACCEPT.split(',')
const MAX_MB = 5

const props = defineProps({
  /** 图片 URL（表单里的 imageUrl）；空串表示还没传 */
  modelValue: { type: String, default: '' },
  disabled: { type: Boolean, default: false }
})

const emit = defineEmits(['update:modelValue'])

const uploading = ref(false)

/** 上传中也不允许再点，避免同一字段被并发覆盖 */
const canEdit = computed(() => !props.disabled && !uploading.value)

/**
 * 上传前的本地校验
 *
 * 返回 false 会同时阻止 http-request 被调用 —— 提示由这里给，请求根本不发。
 */
function beforeUpload(file) {
  const name = (file?.name || '').toLowerCase()
  const ext = name.slice(name.lastIndexOf('.'))
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    ElMessage.warning(`只支持 ${ALLOWED_EXTENSIONS.join(' / ')} 格式的图片`)
    return false
  }
  if (file.size > MAX_MB * 1024 * 1024) {
    const sizeMb = (file.size / 1024 / 1024).toFixed(2)
    ElMessage.warning(`图片大小 ${sizeMb}MB，超过 ${MAX_MB}MB 上限`)
    return false
  }
  return true
}

/**
 * 自定义上传
 *
 * 走 api 层（而不是 el-upload 自己的 ajax），这样 token 注入、code 判断、
 * 401 跳登录页、错误提示全都复用 request.js，不必在这里再实现一遍。
 *
 * ⚠️ 不要再显式调 onSuccess/onError：el-upload 对返回 Promise 的 http-request
 *    会自动 `.then(onSuccess, onError)`，显式调会调两次。
 *    失败也不在这里弹提示 —— request.js 的响应拦截器已经弹过了，再弹就是两条。
 */
async function doUpload({ file }) {
  uploading.value = true
  try {
    const resp = await uploadProductImage(file)
    emit('update:modelValue', resp?.url || '')
    ElMessage.success('上传成功')
  } catch (e) {
    console.warn('[产品图片] 上传失败', e?.message || e)
  } finally {
    uploading.value = false
  }
}

/** 移除：只清空表单字段，不删 OSS 对象（后端有意不删） */
function remove() {
  emit('update:modelValue', '')
  ElMessage.info('已从表单移除，保存后生效；OSS 上的原图不会被删除')
}
</script>

<style scoped lang="scss">
.product-image-upload {
  width: 100%;
}

.product-image-upload__preview {
  display: flex;
  align-items: flex-start;
  gap: 12px;
}

.product-image-upload__thumb {
  width: 96px;
  height: 96px;
  border: 1px solid var(--crm-border);
  border-radius: 4px;
  cursor: zoom-in;
}

.product-image-upload__ops {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 8px;
  padding-top: 4px;
}

.product-image-upload__empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  width: 96px;
  height: 96px;
  border: 1px dashed var(--crm-border);
  border-radius: 4px;
  color: var(--crm-text-secondary);
  font-size: 12px;
  cursor: pointer;
  transition: border-color 0.2s, color 0.2s;

  &:hover {
    border-color: var(--crm-primary);
    color: var(--crm-primary);
  }
}

.product-image-upload__plus {
  font-size: 20px;
}

.product-image-upload__tip {
  margin-top: 6px;
  font-size: 12px;
  line-height: 1.5;
  color: var(--crm-text-secondary);
}
</style>
