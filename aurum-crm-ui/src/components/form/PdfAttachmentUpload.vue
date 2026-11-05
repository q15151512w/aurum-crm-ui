<template>
  <el-upload
    v-model:file-list="fileList"
    accept="application/pdf,.pdf"
    :http-request="doUpload"
    :before-upload="beforeUpload"
    :on-remove="onRemove"
    :limit="10"
    multiple
  >
    <el-button :loading="uploading">上传 PDF</el-button>
    <template #tip>
      <div class="pdf-upload__tip">仅支持 PDF，单个文件不超过 20MB</div>
    </template>
  </el-upload>
</template>

<script setup>
import { ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { uploadFile } from '@/api/system'

const props = defineProps({
  modelValue: { type: Array, default: () => [] },
  /**
   * 业务绑定：与 bizId 同时提供时，上传会把文件写进 sys_attachment 并返回 attachmentId
   * （后端 FileServiceImpl：bizType + bizId 都在才落库）。财务开票的附件必须绑定到发票上，
   * 否则拿不到真实的 attachmentId，issue 接口会以 ATTACHMENT_NOT_EXISTS 拒绝。
   */
  bizType: { type: String, default: '' },
  bizId: { type: [Number, String], default: null }
})

const emit = defineEmits(['update:modelValue'])
const uploading = ref(false)
const fileList = ref([])

watch(
  () => props.modelValue,
  (ids) => {
    const current = new Set(fileList.value.map((f) => String(f.attachmentId)))
    fileList.value = (ids || []).map((id) => {
      const existing = fileList.value.find((f) => String(f.attachmentId) === String(id))
      return existing || { name: `附件-${id}.pdf`, attachmentId: id, status: 'success' }
    })
    if (!ids?.length && current.size) fileList.value = []
  },
  { immediate: true }
)

function beforeUpload(file) {
  const isPdf = file?.type === 'application/pdf' || (file?.name || '').toLowerCase().endsWith('.pdf')
  if (!isPdf) {
    ElMessage.warning('开票资料只支持 PDF 文件')
    return false
  }
  if (file.size > 20 * 1024 * 1024) {
    ElMessage.warning('单个 PDF 不能超过 20MB')
    return false
  }
  return true
}

async function doUpload({ file }) {
  uploading.value = true
  try {
    const resp = await uploadFile(file, { bizType: props.bizType, bizId: props.bizId })
    const id = resp?.attachmentId ?? resp?.id
    if (id == null) throw new Error('上传响应缺少附件ID')
    const item = fileList.value.find((f) => f.uid === file.uid)
    if (item) item.attachmentId = id
    emitIds()
    ElMessage.success('PDF 上传成功')
    return resp
  } finally {
    uploading.value = false
  }
}

function onRemove() {
  emitIds()
}

function emitIds() {
  emit('update:modelValue', fileList.value.map((f) => f.attachmentId).filter((id) => id != null))
}
</script>

<style scoped>
.pdf-upload__tip {
  color: var(--crm-text-secondary);
  font-size: 12px;
}
</style>
