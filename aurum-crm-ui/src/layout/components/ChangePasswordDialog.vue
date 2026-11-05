<template>
  <!--
    修改密码（顶栏用户下拉）

    复用配置驱动的 ConfigFormDialog —— 与登录页的注册/找回密码不同，
    这里三个字段都是普通密码框，不需要短信验证码。

    开关状态完全由内部持有，父组件通过 ref 调 open() 打开。
    不对外暴露 v-model —— 那样就变成父子两份状态，得额外做同步。
  -->
  <config-form-dialog
    v-model="visible"
    title="修改密码"
    :fields="FIELDS"
    :model="form"
    :submitting="submitting"
    width="480px"
    label-width="96px"
    @submit="submit"
  />
</template>

<script setup>
import { ElMessage } from 'element-plus'
import ConfigFormDialog from '@/components/form/ConfigFormDialog.vue'
import { changePassword } from '@/api/auth'
import { useFormDialog } from '@/composables/useFormDialog'

const { visible, form, submitting, openAdd, submit } = useFormDialog({
  label: '密码',
  emptyForm: () => ({ oldPassword: '', newPassword: '', confirmPassword: '' }),
  create: async (payload) => {
    // 确认密码只是前端校验用的，不发给后端
    await changePassword({
      oldPassword: payload.oldPassword,
      newPassword: payload.newPassword
    })
  },
  onSuccess: () => ElMessage.success('密码已修改，下次登录请使用新密码')
})

/**
 * 校验规则
 *
 * 定义在 useFormDialog 之后，因为「两次输入一致」要读到表单模型里的 newPassword。
 * 这条跨字段校验不能放进 ConfigFormDialog 的通用推导 —— 它是这张表单特有的。
 */
const FIELDS = [
  {
    prop: 'oldPassword',
    label: '原密码',
    type: 'password',
    required: true,
    span: 24,
    maxlength: 32
  },
  {
    prop: 'newPassword',
    label: '新密码',
    type: 'password',
    required: true,
    span: 24,
    maxlength: 32,
    rules: [{ min: 6, max: 20, message: '密码长度为 6 到 20 个字符', trigger: 'blur' }]
  },
  {
    prop: 'confirmPassword',
    label: '确认新密码',
    type: 'password',
    required: true,
    span: 24,
    maxlength: 32,
    rules: [
      {
        validator: (rule, value, callback) =>
          value === form.value.newPassword
            ? callback()
            : callback(new Error('两次输入的密码不一致')),
        trigger: 'blur'
      }
    ]
  }
]

defineExpose({ open: openAdd })
</script>
