<template>
  <!--
    个人信息页（顶栏用户下拉 → 「个人信息」跳转到这里）

    按原型是**纯只读展示**：全部字段用禁用输入框呈现（灰底），唯一可操作的是「修改头像」。
    资料编辑（姓名/手机号/邮箱）不在本页 —— 原型没给编辑入口。

    数据全部来自 userStore.userInfo（GET /auth/me 的结果，进页面时已经在内存里），
    所以本页不发取数请求；唯一的异步是「角色标识 → 角色名称」的映射和头像上传。
  -->
  <div class="profile-page">
    <h2 class="profile-page__title">个人信息</h2>

    <!-- 头像行：圆形头像 + 修改头像 -->
    <div class="profile-page__row">
      <div class="profile-page__label">头像</div>
      <div class="profile-page__value profile-page__avatar">
        <el-image
          v-if="userInfo.avatar"
          :src="userInfo.avatar"
          :preview-src-list="[userInfo.avatar]"
          preview-teleported
          fit="cover"
          class="profile-page__avatar-img"
        />
        <!-- 没设头像时用图标兜底，与顶栏 el-avatar 的回退行为一致 -->
        <el-avatar v-else :size="88" :icon="UserFilled" class="profile-page__avatar-img" />

        <el-upload
          action="#"
          :show-file-list="false"
          accept=".jpg,.jpeg,.png,.webp"
          :before-upload="beforeAvatarUpload"
          :http-request="doAvatarUpload"
        >
          <el-button size="small" type="primary" plain :loading="avatarSaving">修改头像</el-button>
        </el-upload>
      </div>
    </div>

    <div v-for="row in ROWS" :key="row.label" class="profile-page__row">
      <div class="profile-page__label">{{ row.label }}</div>
      <div class="profile-page__value">
        <el-input :model-value="row.value" disabled />
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { UserFilled } from '@element-plus/icons-vue'
import { updateProfile } from '@/api/auth'
import { uploadFile, getRolePage } from '@/api/system'
import { useUserStore } from '@/store/user'

const userStore = useUserStore()
const userInfo = computed(() => userStore.userInfo || {})

/**
 * 角色展示文本
 *
 * /auth/me 下发的 roles 是**角色标识**（如 ["admin"]），不是名称。
 * 这里拉一次角色列表把标识翻译成名称（超级管理员…）；
 * 翻译不了（接口 403 / 网络失败 / 标识没命中）就退回显示标识本身。
 */
const roleText = ref('')

onMounted(async () => {
  const keys = userInfo.value.roles || []
  if (!keys.length) return
  roleText.value = keys.join('、')
  try {
    const { list } = await getRolePage({ pageNo: 1, pageSize: 100 })
    const nameByKey = new Map((list || []).map((r) => [r.roleKey, r.name]))
    roleText.value = keys.map((k) => nameByKey.get(k) || k).join('、')
  } catch {
    // 拉不到角色列表就保持标识展示，不打断页面
  }
})

/**
 * 只读字段清单
 *
 * ⚠️ 员工编号：sys_user 没有独立的工号列，这里用登录账号（username）顶位。
 *
 * ⚠️ 这里**只剩下 /auth/me 真的会下发的字段**。早先还有一行「出生日期」
 *    （取 userInfo.birthDate），但 `sys_user` 表里根本没有这一列、DO 里也没有 ——
 *    那个值恒为 undefined，界面上永远显示「—」。要去掉的就是它，别再加回来。
 *    真要做出生日期，得先动 DDL，属于另一个量级的改动。
 *
 * 性别来自 `UserInfoRespVO.gender`，是**中文**（男 / 女 / 未知），
 * 由后端的 DisplayEnumTranslator 转好再下发，前端直接显示即可。
 */
const ROWS = computed(() => [
  { label: '姓名', value: userInfo.value.realName || '—' },
  { label: '员工编号', value: userInfo.value.username || '—' },
  { label: '性别', value: userInfo.value.gender || '—' },
  { label: '联系电话', value: userInfo.value.phone || '—' },
  { label: '邮箱', value: userInfo.value.email || '—' },
  { label: '角色', value: roleText.value || '—' },
  { label: '所属部门', value: userInfo.value.deptName || '—' }
])

// ---------------------------------------------------------------------------
// 修改头像：选图 → 通用上传接口拿 URL → PUT /auth/profile 只提交 avatar
// ---------------------------------------------------------------------------

const MAX_MB = 2

/** 本地校验口径与 AvatarUpload.vue 一致（jpg/jpeg/png/webp，≤2MB，不含 svg） */
function beforeAvatarUpload(file) {
  const name = (file?.name || '').toLowerCase()
  const ext = name.slice(name.lastIndexOf('.'))
  if (!['.jpg', '.jpeg', '.png', '.webp'].includes(ext)) {
    ElMessage.warning('只支持 jpg / jpeg / png / webp 格式的图片')
    return false
  }
  if (file.size > MAX_MB * 1024 * 1024) {
    ElMessage.warning(`图片大小 ${(file.size / 1024 / 1024).toFixed(2)}MB，超过 ${MAX_MB}MB 上限`)
    return false
  }
  return true
}

const avatarSaving = ref(false)

async function doAvatarUpload({ file }) {
  avatarSaving.value = true
  try {
    // 不传 bizType / bizId：临时上传分支，不写 sys_attachment
    const { url } = await uploadFile(file)
    if (!url) throw new Error('上传接口未返回地址')
    await updateProfile({ avatar: url })
    // 就地更新 store，顶栏头像立即跟着变（不重拉 /auth/me，代价太大）
    userStore.updateUserInfo({ avatar: url })
    ElMessage.success('头像已更新')
  } catch (e) {
    // 上传/保存失败的提示 request.js 已弹过；这里补一条说明当前状态
    console.warn('[个人信息] 头像更新失败', e?.message || e)
    ElMessage.warning('头像更新失败，请重试')
  } finally {
    avatarSaving.value = false
  }
}
</script>

<style scoped lang="scss">
.profile-page {
  max-width: 640px;
  margin: 0 auto;
  padding: 48px 24px 64px;

  &__title {
    margin: 0 0 32px;
    padding-left: 88px;
    font-size: 20px;
    font-weight: 600;
    color: var(--crm-text-primary, #303133);
  }

  &__row {
    display: flex;
    align-items: center;
    margin-bottom: 20px;
  }

  &__label {
    flex-shrink: 0;
    width: 88px;
    padding-right: 12px;
    text-align: right;
    font-size: 14px;
    color: var(--crm-text-regular, #606266);
  }

  &__value {
    flex: 1;
    min-width: 0;
  }

  &__avatar {
    display: flex;
    align-items: center;
    gap: 16px;
  }

  &__avatar-img {
    width: 88px;
    height: 88px;
    border-radius: 50%;
    border: 1px solid var(--crm-border, #dcdfe6);
  }
}
</style>
