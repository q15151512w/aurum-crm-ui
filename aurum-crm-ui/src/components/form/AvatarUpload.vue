<template>
  <!--
    头像上传控件（单图，圆形预览）

    放在 el-form-item 里用，v-model 就是表单里的 `avatar` 字段（一个 URL 字符串）。
    上传成功即把接口返回的 url 写回模型；点「保存」时随其它资料字段一起提交。

    ⚠️ 与 ProductImageUpload 的关键差别是**走哪个上传接口**：
       产品图片有专用接口 `POST /crm/product/image`（额外限定了目录与图片类型，
       且产品图片的真相是 `crm_product.image`）；
       头像没有专用接口，走通用的 `POST /system/file/upload`，并且
       **不传 bizType / bizId** —— 命中后端的「临时上传」分支：
       只回 url，不写 `sys_attachment` 表，不留无人引用的行。
       与「新增产品」表单里的产品图片是同一套取舍（见 FileUploadReqVO 的类注释）。

    ⚠️ 头像地址最终存进 `sys_user.avatar`，是个**字符串**，不是附件 ID ——
       所以这里没有 attachmentId 可用，删除也走不了 DELETE /system/file/{id}，
       「移除」只是把表单里的地址清空（与产品图片同理）。
  -->
  <div class="avatar-upload">
    <!-- ---------------- 已有头像：圆形缩略图 + 重新上传 / 移除 ---------------- -->
    <div v-if="modelValue" class="avatar-upload__preview">
      <el-image
        :src="modelValue"
        :preview-src-list="[modelValue]"
        preview-teleported
        fit="cover"
        class="avatar-upload__thumb"
      />

      <div class="avatar-upload__ops">
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

    <!-- ---------------- 没有头像：虚线圆，点击即选文件 ---------------- -->
    <el-upload
      v-else
      action="#"
      :show-file-list="false"
      :accept="ACCEPT"
      :disabled="!canEdit"
      :before-upload="beforeUpload"
      :http-request="doUpload"
      class="avatar-upload__uploader"
    >
      <div v-loading="uploading" class="avatar-upload__empty">
        <el-icon class="avatar-upload__plus"><Plus /></el-icon>
        <span>{{ uploading ? '上传中…' : '上传头像' }}</span>
      </div>
    </el-upload>

    <div class="avatar-upload__tip">
      支持 jpg / jpeg / png / webp，不超过 {{ MAX_MB }}MB。
      移除只清空表单里的地址，OSS 上的原图不会被删除。
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { ElMessage } from 'element-plus'
import { Delete, Plus, UploadFilled } from '@element-plus/icons-vue'
import { uploadFile } from '@/api/system'

/**
 * 允许的扩展名与大小上限
 *
 * ⚠️ 这里**没有**后端对应物可比对：通用上传接口 `POST /system/file/upload`
 *    刻意不做文件类型白名单（官方说明是「哪个模块用哪种文件，由那个模块自己校验」，
 *    放全局白名单只会让不同业务互相牵制）。所以这个白名单是**本控件自己的口径**，
 *    改它就是改这一处的行为，不会影响到别处。
 *    刻意不含 svg：SVG 可内嵌脚本，而 bucket 是公共读 = 存储型 XSS。
 */
const ACCEPT = '.jpg,.jpeg,.png,.webp'
const ALLOWED_EXTENSIONS = ACCEPT.split(',')
const MAX_MB = 2

const props = defineProps({
  /** 头像 URL（表单里的 avatar）；空串表示还没传 */
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
    // 不传 bizType / bizId：临时上传，不写 sys_attachment，避免产生无人引用的行
    const resp = await uploadFile(file)
    emit('update:modelValue', resp?.url || '')
    ElMessage.success('上传成功')
  } catch (e) {
    console.warn('[头像] 上传失败', e?.message || e)
  } finally {
    uploading.value = false
  }
}

/** 移除：只清空表单字段，不删 OSS 对象（后端没有反向引用，删了可能误伤） */
function remove() {
  emit('update:modelValue', '')
  ElMessage.info('已移除头像，保存后生效；OSS 上的原图不会被删除')
}
</script>

<style scoped lang="scss">
.avatar-upload {
  width: 100%;
}

.avatar-upload__preview {
  display: flex;
  align-items: center;
  gap: 16px;
}

.avatar-upload__thumb {
  flex-shrink: 0;
  width: 88px;
  height: 88px;
  // 圆形 —— 顶栏 el-avatar 也是圆的，两处形状要对得上
  border-radius: 50%;
  border: 1px solid var(--crm-border);
  cursor: zoom-in;
}

.avatar-upload__ops {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 8px;
}

.avatar-upload__empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  width: 88px;
  height: 88px;
  border: 1px dashed var(--crm-border);
  border-radius: 50%;
  color: var(--crm-text-secondary);
  font-size: 12px;
  cursor: pointer;
  transition: border-color 0.2s, color 0.2s;

  &:hover {
    border-color: var(--crm-primary);
    color: var(--crm-primary);
  }
}

.avatar-upload__plus {
  font-size: 20px;
}

.avatar-upload__tip {
  margin-top: 6px;
  font-size: 12px;
  line-height: 1.5;
  color: var(--crm-text-secondary);
}
</style>
