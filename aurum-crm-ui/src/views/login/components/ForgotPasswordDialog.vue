<template>
  <!--
    忘记密码

    用邮箱 + 邮箱验证码重置。原型上也是独立一页，这里按弹窗做。
  -->
  <el-dialog
    :model-value="modelValue"
    title="忘记密码"
    width="460px"
    :close-on-click-modal="false"
    @update:model-value="emit('update:modelValue', $event)"
    @open="handleOpen"
  >
    <el-form ref="formRef" :model="form" :rules="rules" label-width="86px" size="large">
      <el-form-item label="邮箱" prop="email">
        <el-input
          v-model="form.email"
          placeholder="请输入注册时的邮箱"
          maxlength="128"
          autocomplete="off"
          clearable
        />
      </el-form-item>

      <el-form-item label="验证码" prop="emailCode">
        <div class="code-row">
          <el-input
            v-model="form.emailCode"
            placeholder="6 位验证码"
            maxlength="6"
            autocomplete="off"
          />
          <el-button
            :disabled="!canSend(form.email)"
            :loading="sending"
            @click="send(form.email)"
          >
            {{ buttonText(form.email) }}
          </el-button>
        </div>
      </el-form-item>

      <!-- 这里是「设新密码」，autocomplete 必须用 new-password（理由见 RegisterDialog 的注释） -->
      <el-form-item label="新密码" prop="newPassword">
        <el-input
          v-model="form.newPassword"
          type="password"
          placeholder="6-20 位"
          autocomplete="new-password"
          show-password
        />
      </el-form-item>

      <el-form-item label="确认密码" prop="confirmPassword">
        <el-input
          v-model="form.confirmPassword"
          type="password"
          placeholder="再次输入新密码"
          autocomplete="new-password"
          show-password
        />
      </el-form-item>
    </el-form>

    <template #footer>
      <div class="dialog-footer">
        <el-button @click="emit('update:modelValue', false)">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="handleSubmit">重置密码</el-button>
      </div>
    </template>
  </el-dialog>
</template>

<script setup>
import { ref, reactive, nextTick } from 'vue'
import { ElMessage } from 'element-plus'
import { forgotPassword } from '@/api/auth'
import { useEmailCountdown, isValidEmail } from '@/composables/useEmailCountdown'

defineProps({
  modelValue: { type: Boolean, default: false }
})

const emit = defineEmits(['update:modelValue'])

const { sending, buttonText, canSend, send } = useEmailCountdown()

const formRef = ref(null)
const submitting = ref(false)

/** 表单初始值（空白表单）。抽出来供 handleOpen 重置，理由同 RegisterDialog 的 EMPTY_FORM */
const EMPTY_FORM = {
  email: '',
  emailCode: '',
  newPassword: '',
  confirmPassword: ''
}

const form = reactive({ ...EMPTY_FORM })

const validateConfirm = (rule, value, callback) => {
  if (value !== form.newPassword) return callback(new Error('两次输入的密码不一致'))
  callback()
}

const rules = {
  email: [
    { required: true, message: '请输入邮箱', trigger: 'blur' },
    {
      validator: (rule, value, callback) =>
        isValidEmail(value) ? callback() : callback(new Error('请输入正确的邮箱地址')),
      trigger: 'blur'
    }
  ],
  emailCode: [
    { required: true, message: '请输入验证码', trigger: 'blur' },
    { len: 6, message: '验证码为 6 位', trigger: 'blur' }
  ],
  newPassword: [
    { required: true, message: '请输入新密码', trigger: 'blur' },
    { min: 6, max: 20, message: '密码长度为 6 到 20 个字符', trigger: 'blur' }
  ],
  confirmPassword: [
    { required: true, message: '请再次输入新密码', trigger: 'blur' },
    { validator: validateConfirm, trigger: 'blur' }
  ]
}

function handleOpen() {
  // 清空值 + 清校验：el-dialog 不销毁内容，「填一半取消」再打开会留着上次的输入
  Object.assign(form, EMPTY_FORM)
  nextTick(() => formRef.value?.clearValidate())
}

async function handleSubmit() {
  const valid = await formRef.value?.validate().catch(() => false)
  if (!valid) return

  submitting.value = true
  try {
    await forgotPassword({
      email: form.email,
      emailCode: form.emailCode,
      newPassword: form.newPassword
    })
    ElMessage.success('密码已重置，请用新密码登录')
    emit('update:modelValue', false)
    form.newPassword = ''
    form.confirmPassword = ''
    form.emailCode = ''
  } catch {
    // 失败提示已由 request.js 统一处理
  } finally {
    submitting.value = false
  }
}
</script>

<style scoped lang="scss">
.code-row {
  display: flex;
  gap: 8px;
  width: 100%;
}
</style>
