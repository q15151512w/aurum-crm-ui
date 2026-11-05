<template>
  <!--
    登陆日志

    纯查询页：没有新增、没有批量操作。只有「导出」一个动作。
  -->
  <pro-list
    ref="listRef"
    title="登陆日志"
    :fetcher="getLoginLogPage"
    :columns="columns"
    :filters="[]"
    :toolbar="[]"
    :selectable="false"
    :starrable="false"
    search-placeholder="登陆人/工号/IP"
  >
    <template #filter-right>
      <el-button @click="onExport">导出</el-button>
    </template>
  </pro-list>

  <!-- 导出下载弹窗：点「下载文件」才下载，点 X /「稍后再说」只关闭 -->
  <export-download-dialog v-model="exportVisible" :download-url="exportUrl" :filename="exportName" @downloaded="onDownloaded" />
</template>

<script setup>
import { ref } from 'vue'
import ProList from '@/components/ProList.vue'
import ExportDownloadDialog from '@/components/ExportDownloadDialog.vue'
import { getLoginLogPage, exportLoginLog } from '@/api/system'

const listRef = ref(null)

/** 列取自原型「登陆日志」页表头，prop 与 mock/db.js 的 loginLog 一致 */
const columns = [
  { prop: 'userName', label: '登陆人', minWidth: 110, link: true },
  { prop: 'username', label: '工号（登陆账号）', minWidth: 140 },
  { prop: 'phone', label: '手机号码', minWidth: 130 },
  { prop: 'loginTime', label: '登陆时间', minWidth: 150 },
  { prop: 'ip', label: 'IP地址', minWidth: 140 },
  { prop: 'browser', label: '浏览器', minWidth: 120 },
  { prop: 'os', label: '操作系统', minWidth: 120 },
  { prop: 'duration', label: '登陆时长（小时）', minWidth: 140 }
]

async function onExport() {
  try {
    const url = await exportLoginLog({ ...listRef.value?.getQuery?.() })
    exportUrl.value = url || ''
    exportName.value = '登陆日志导出'
    exportVisible.value = true
  } catch {
    // 失败提示已由 request.js 统一处理
  }
}

const exportVisible = ref(false)
const exportUrl = ref('')
const exportName = ref('')

function onDownloaded() {
  ElMessage.success('下载完成')
}

// 「登陆时长」为空是常态（用户关浏览器不触发登出），前端留空即可，不是错误。
</script>
