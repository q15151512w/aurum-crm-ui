<template>
  <!--
    注册账号

    原型「登陆」页上「注册账号」是独立一页，开发时应做成弹窗（《01-原型梳理》第 8 节第 2 点）。
  -->
  <!--
    ⚠️ autocomplete 的取值是刻意区分的，别随手改成 off 或删掉：

    浏览器（尤其 Chrome）看到「文本输入框 + 密码框」的组合就会当成登录框来填充，
    于是打开注册弹窗时，账号 / 密码 / 确认密码会被填上**之前保存的登录凭据**。
    用户看到的是「刚点注册，输入框里就有东西了」。

    - `autocomplete="new-password"`（两个密码框）：告诉浏览器这是**设新密码**，
      不要填已保存的旧密码。Chrome 对 `off` 在密码框上基本不理，**必须**用这个值。
    - `autocomplete="off"`（账号 / 邮箱 / 验证码）：这三个不是凭据，不该被填充。
      其中验证码是「一次性的」`emailCode` 语义，`attr="off"` 也挡住安卓/iOS 的自动填充。

    与登录页是一对：登录页标 `username` / `current-password`（让密码管理器**正确地**
    记住并填充登录凭据），注册弹窗标 `new-password` —— 两边都标清楚，浏览器才不会
    把「注册」当成「登录」来填。
  -->
  <el-dialog
    :model-value="modelValue"
    title="注册账号"
    width="460px"
    :close-on-click-modal="false"
    @update:model-value="emit('update:modelValue', $event)"
    @open="handleOpen"
  >
    <el-form ref="formRef" :model="form" :rules="rules" label-width="86px" size="large">
      <el-form-item label="账号" prop="username">
        <el-input
          v-model="form.username"
          placeholder="2-32 位，用于登录"
          autocomplete="off"
          clearable
        />
      </el-form-item>

      <el-form-item label="邮箱" prop="email">
        <el-input
          v-model="form.email"
          placeholder="用于登录与找回密码"
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

      <el-form-item label="密码" prop="password">
        <el-input
          v-model="form.password"
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
          placeholder="再次输入密码"
          autocomplete="new-password"
          show-password
        />
      </el-form-item>
    </el-form>

    <template #footer>
      <div class="dialog-footer">
        <el-button @click="emit('update:modelValue', false)">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="handleSubmit">注册</el-button>
      </div>
    </template>
  </el-dialog>
</template>

<script setup>
import { ref, reactive, nextTick } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { register } from '@/api/auth'
import { useEmailCountdown, isValidEmail } from '@/composables/useEmailCountdown'

defineProps({
  modelValue: { type: Boolean, default: false }
})

/** success 带上账号，让登录页回填到账号输入框 */
const emit = defineEmits(['update:modelValue', 'success'])

const { sending, buttonText, canSend, send } = useEmailCountdown()

const formRef = ref(null)
const submitting = ref(false)

/**
 * 表单初始值（= 空白表单）。
 *
 * ⚠️ 抽成常量是为了 handleOpen 里能**真正回到空白**，而不是把字面量再抄一遍 ——
 *    抄一遍的话，将来加字段时必然有一处忘记同步。
 */
const EMPTY_FORM = {
  username: '',
  email: '',
  emailCode: '',
  password: '',
  confirmPassword: ''
}

const form = reactive({ ...EMPTY_FORM })

const validateConfirm = (rule, value, callback) => {
  if (value !== form.password) return callback(new Error('两次输入的密码不一致'))
  callback()
}

const rules = {
  username: [
    { required: true, message: '请输入账号', trigger: 'blur' },
    { min: 2, max: 32, message: '账号长度为 2 到 32 个字符', trigger: 'blur' }
  ],
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
  password: [
    { required: true, message: '请输入密码', trigger: 'blur' },
    { min: 6, max: 20, message: '密码长度为 6 到 20 个字符', trigger: 'blur' }
  ],
  confirmPassword: [
    { required: true, message: '请再次输入密码', trigger: 'blur' },
    { validator: validateConfirm, trigger: 'blur' }
  ]
}

function handleOpen() {
  // ⚠️ 必须清空表单值，不能只 clearValidate。
  //
  //    el-dialog 默认 `destroy-on-close=false`，弹窗内容**不会销毁**，
  //    而 form 是在 setup 里创建的 reactive 对象 —— 于是「填一半 → 取消 → 再打开」
  //    会把上次的内容原样留在输入框里。用户看到的就是「刚点注册，输入框里就有值」。
  //
  //    （另一个来源是浏览器的密码管理器自动填充，那个由模板上的 autocomplete 处理，
  //      两者是独立的，都得治。）
  Object.assign(form, EMPTY_FORM)
  nextTick(() => formRef.value?.clearValidate())
}

async function handleSubmit() {
  const valid = await formRef.value?.validate().catch(() => false)
  if (!valid) return

  submitting.value = true
  try {
    await register({
      username: form.username,
      email: form.email,
      emailCode: form.emailCode,
      password: form.password
    })
    // 注册只是「投递申请」：账号是禁用状态，要等管理员分配角色并激活才能登录
    await ElMessageBox.alert(
      `账号「${form.username}」已创建，但暂时还不能登录。\n\n` +
        '企业系统里的人是先入职、角色已定，才有账号。请联系管理员在「人员管理」里为你分配角色并启用账号。',
      '注册成功',
      { confirmButtonText: '知道了' }
    )
    emit('success', form.username)
    emit('update:modelValue', false)
    // 清掉密码类字段，别把明文留在内存里等着下次打开
    form.password = ''
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
