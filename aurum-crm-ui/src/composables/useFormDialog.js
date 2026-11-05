import { ref, computed } from 'vue'

/**
 * 新增/编辑弹窗的状态管理
 *
 * 16 个列表页的弹窗要做的事完全一样：开关、区分新增还是编辑、表单模型、
 * 提交中标记、成功后的回调。抽在这里，页面只写「调哪个接口」。
 *
 * 配合 `components/form/ConfigFormDialog.vue` 使用：
 *
 *   const { visible, form, title, openAdd, openEdit, submit, submitting } = useFormDialog({
 *     label: '计量单位',
 *     emptyForm: () => ({ name: '', remark: '' }),
 *     create: createUnit,
 *     update: updateUnit,
 *     onSuccess: () => { listRef.value?.clearSelection(); listRef.value?.reload() }
 *   })
 */

/**
 * 深拷贝一行数据当表单模型
 *
 * ⚠️ 必须拷贝，不能直接用列表行对象 —— 表单里没有 v-model 绑定的字段会原地改到
 *    列表行上，用户点「取消」之后表格里的值已经变了。
 *
 * 用 JSON 往返而不是 structuredClone：项目里的日期时间全是字符串，
 * JSON 的行为更可预测，也不依赖运行时的版本。
 */
export function deepClone(value) {
  if (value == null) return value
  return JSON.parse(JSON.stringify(value))
}

/**
 * @param {Object}   options
 * @param {string}   options.label      实体的中文名，用于拼「新增xx / 编辑xx」标题
 * @param {Function} options.emptyForm  返回一份空表单（新增时的初始值）
 * @param {Function} options.create     (payload) => Promise，新增接口
 * @param {Function} options.update     (id, payload) => Promise，修改接口
 * @param {Function} options.onSuccess  (mode) => void，提交成功后调用，通常在这里 reload
 * @param {string}   options.width      弹窗宽度（部分表单需要更宽，如报价单）
 */
export function useFormDialog(options = {}) {
  const { label = '记录', emptyForm = () => ({}), create, update, onSuccess, width = '640px' } = options

  const visible = ref(false)
  /** 'add' | 'edit' */
  const mode = ref('add')
  const editingId = ref(null)
  const submitting = ref(false)
  const form = ref(emptyForm())

  const isEdit = computed(() => mode.value === 'edit')
  const title = computed(() => `${isEdit.value ? '编辑' : '新增'}${label}`)

  /**
   * 只挑出表单声明过的字段
   *
   * 传进来的行/详情对象往往比表单大得多：列表行带 creator / createTime / starred，
   * 详情对象还带明细、附件、时间线。整坨塞进表单模型的话，提交时全会发给后端。
   * 以 emptyForm 的键为准做一次筛选，payload 就只包含表单字段。
   */
  function pickFormFields(source) {
    const picked = {}
    for (const key of Object.keys(emptyForm())) {
      if (key in source) picked[key] = source[key]
    }
    // ⚠️ id 要单独放行（它不在 emptyForm 里）：字段配置靠 `model.id` 判断
    //    「这是编辑不是新增」，用来禁用不该改的字段（人员的账号、字典的类型、角色的标识）。
    //    不放行的话那个判断恒为 false，禁用形同虚设。
    //    提交时 submit() 会把 id 摘掉，不会发给后端。
    if (source.id !== undefined) picked.id = source.id
    return picked
  }

  /**
   * 打开新增弹窗
   * @param {Object} preset 预填值，如部门页「在某个节点下新增」时要带上 parentId
   */
  function openAdd(preset = {}) {
    mode.value = 'add'
    editingId.value = null
    form.value = { ...emptyForm(), ...preset }
    visible.value = true
  }

  /**
   * 打开编辑弹窗
   * @param {Object} row 列表行或详情对象，深拷贝后按表单字段裁剪回填
   */
  function openEdit(row) {
    mode.value = 'edit'
    editingId.value = row?.id ?? null
    form.value = { ...emptyForm(), ...pickFormFields(deepClone(row) || {}) }
    visible.value = true
  }

  /**
   * 提交
   *
   * 失败时**不关弹窗**，让用户改完重试；也不再弹提示 —— request.js 的响应拦截器
   * 已经统一弹过了，这里重复弹会出两条。
   *
   * 必须自己吞掉异常：这个函数是直接绑在 `@submit` 上的，Vue 不会 await 它，
   * 抛出去就是一个没人处理的 unhandledrejection。
   *
   * @param {string} [action] 透传给 create/update 的动作标识，用于「同一个表单、
   *   不同的收尾动作」的场景（发票登记的『保存草稿』与『提交审核』共用一份表单，
   *   差别只是存完之后要不要接着调 submit）。不传时行为与以前完全一致。
   *
   *   ⚠️ 这里拿不到 create 的返回值，所以「先存草稿拿到 id、再提交」的串联
   *   必须在调用方自己的 create 包装函数里完成，不要指望这里把 id 传出来。
   */
  async function submit(action) {
    submitting.value = true
    try {
      // id 不参与提交，后端从路径里拿
      const { id, ...payload } = form.value
      if (isEdit.value) {
        await update?.(editingId.value, payload, action)
      } else {
        await create?.(payload, action)
      }
      visible.value = false
      onSuccess?.(mode.value, action)
    } catch {
      // 错误提示已由 request.js 统一处理，保持弹窗打开等用户修改
    } finally {
      submitting.value = false
    }
  }

  return {
    visible,
    mode,
    isEdit,
    editingId,
    submitting,
    form,
    title,
    width,
    openAdd,
    openEdit,
    submit
  }
}
