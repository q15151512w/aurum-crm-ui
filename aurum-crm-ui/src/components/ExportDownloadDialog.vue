<template>
  <!--
    导出下载弹窗：所有「导出」按钮共用的收尾。

    后端导出的流程是「数据 → 序列化成 Excel(xlsx) → 上传 OSS → 返回一个下载 URL」。
    所以前端拿到的是 URL 字符串，不是文件本体。这个弹窗把 URL 展示给用户：
      · 点「下载文件」→ 真正把这个 URL 的内容下载到本地（.xlsx），下载后自动关闭
      · 点右上角 X 或「稍后再说」→ 只关闭弹窗，不触发下载

    ⚠️ 为什么不用 ElMessageBox.alert + callback：
      它的 callback 会在**所有**关闭动作（确定/右上X/点遮罩/ESC）里触发，
      导致「点关闭」也下载 —— 这正是要修掉的 bug。这里换成自己控制的两个动作，
      下载只绑定在「下载文件」按钮上。
  -->
  <el-dialog
    :model-value="modelValue"
    title="导出成功"
    width="420px"
    :close-on-click-modal="false"
    :close-on-press-escape="false"
    append-to-body
    align-center
    @update:model-value="emit('update:modelValue', $event)"
  >
    <div class="export-dialog">
      <el-icon class="export-dialog__icon"><CircleCheckFilled /></el-icon>
      <div class="export-dialog__body">
        <p class="export-dialog__tip">文件已生成，点击下方按钮下载到本地（.xlsx 格式）。</p>
        <p v-if="modelValue" class="export-dialog__url" :title="downloadUrl">
          {{ downloadUrl }}
        </p>
      </div>
    </div>

    <template #footer>
      <el-button @click="emit('update:modelValue', false)">稍后再说</el-button>
      <el-button type="primary" :loading="downloading" @click="onDownload">下载文件</el-button>
    </template>
  </el-dialog>
</template>

<script setup>
import { ref } from 'vue'
import { CircleCheckFilled } from '@element-plus/icons-vue'
import request from '@/utils/request'

const props = defineProps({
  /** 弹窗开关 */
  modelValue: { type: Boolean, default: false },
  /** 后端导出的下载 URL（CommonResult.data） */
  downloadUrl: { type: String, default: '' },
  /** 下载文件名（不含扩展名），如「客户」「我的关注客户」；留空则用「导出」 */
  filename: { type: String, default: '' }
})

const emit = defineEmits(['update:modelValue', 'downloaded'])

/** 正在生成下载文件（拉流 + 落盘） */
const downloading = ref(false)

/**
 * 下载：经后端流式转发取到 Excel 字节，命名成「文件名.xlsx」落到本地。
 *
 * ⚠️ 不能 <a href=OSS_URL download>——OSS 是跨域公网 URL，浏览器对跨域地址忽略
 * download 属性、退回用 URL 末尾 uuid 当文件名（正是「下载出来是一串 uuid.xlsx」
 * 的根因）；直接 fetch 该 URL 又受 OSS CORS 限制会失败。
 * 所以走同源的 `GET /system/export/download`（后端转发 + Content-Disposition），
 * 前端用 responseType:'blob' 接收，再 URL.createObjectURL 生成同源 blob: 链接落盘。
 *
 * 下载成功后弹窗关闭，并向上 emit，父页面据此弹「下载完成」。
 */
async function onDownload() {
  if (!props.downloadUrl || downloading.value) return
  downloading.value = true
  try {
    const blob = await request({
      url: '/system/export/download',
      method: 'get',
      params: { url: props.downloadUrl, filename: props.filename || '导出' },
      responseType: 'blob'
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${props.filename || '导出'}.xlsx`
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
    emit('update:modelValue', false)
    emit('downloaded')
  } finally {
    downloading.value = false
  }
}
</script>

<style scoped lang="scss">
.export-dialog {
  display: flex;
  gap: 14px;
  align-items: flex-start;
}

.export-dialog__icon {
  flex-shrink: 0;
  font-size: 40px;
  color: var(--el-color-success, #67c23a);
}

.export-dialog__body {
  min-width: 0;
}

.export-dialog__tip {
  margin: 4px 0 10px;
  font-size: 14px;
  line-height: 1.6;
  color: var(--el-text-color-regular, #606266);
}

.export-dialog__url {
  margin: 0;
  padding: 8px 10px;
  font-size: 12px;
  line-height: 1.5;
  color: var(--el-text-color-secondary, #909399);
  background: var(--el-fill-color-light, #f5f7fa);
  border-radius: 6px;
  word-break: break-all;
  user-select: all;
}
</style>
