/**
 * 菜单 mock 数据
 *
 * ⚠️ 本文件由 `npm run gen:menu` 从后端 sql/crm.sql 的 sys_menu 种子【自动生成】，
 *    请勿手工编辑 —— 改了也会被下次生成覆盖。
 *    当前节点数：131
 *
 * 用途：后端 /auth/me 尚未实现时，让前端动态菜单与路由守卫能端到端跑通。
 * 后端就绪后：
 *   1. 把 .env.development 里的 VITE_APP_USE_MOCK 改为 false
 *   2. 本文件即可删除
 *
 * 字段说明：
 *   menuType  1=目录（顶部一级导航，不产生路由） 2=菜单（对应一个路由页面） 3=按钮（不下发前端）
 *   path      目录为 null；菜单为绝对路径
 *   component 前端组件路径，相对 src/views，如 crm/lead/index
 *   visible   0=隐藏（可路由但不显示在导航里，如详情页）
 */
export const mockMenus = [
  {
    menuId: 1,
    parentId: 0,
    menuName: "首页",
    menuType: 2,
    path: "/dashboard",
    component: "dashboard/index",
    perms: "dashboard:view",
    icon: "HomeFilled",
    sort: 1,
    visible: 1,
    children: []
  },
  {
    menuId: 10,
    parentId: 0,
    menuName: "线索",
    menuType: 1,
    path: null,
    component: null,
    perms: "crm:lead",
    icon: "Promotion",
    sort: 2,
    visible: 1,
    children: [
      {
        menuId: 11,
        parentId: 10,
        menuName: "线索",
        menuType: 2,
        path: "/crm/lead",
        component: "crm/lead/index",
        perms: "crm:lead:list",
        icon: "Tickets",
        sort: 1,
        visible: 1,
        children: [
          {
            menuId: 1101,
            parentId: 11,
            menuName: "新增线索",
            menuType: 3,
            path: null,
            component: null,
            perms: "crm:lead:create",
            icon: null,
            sort: 1,
            visible: 1,
            children: []
          },
          {
            menuId: 1102,
            parentId: 11,
            menuName: "修改线索",
            menuType: 3,
            path: null,
            component: null,
            perms: "crm:lead:update",
            icon: null,
            sort: 2,
            visible: 1,
            children: []
          },
          {
            menuId: 1103,
            parentId: 11,
            menuName: "删除线索",
            menuType: 3,
            path: null,
            component: null,
            perms: "crm:lead:delete",
            icon: null,
            sort: 3,
            visible: 1,
            children: []
          },
          {
            menuId: 1104,
            parentId: 11,
            menuName: "导出线索",
            menuType: 3,
            path: null,
            component: null,
            perms: "crm:lead:export",
            icon: null,
            sort: 4,
            visible: 1,
            children: []
          },
          {
            menuId: 1105,
            parentId: 11,
            menuName: "放入线索池",
            menuType: 3,
            path: null,
            component: null,
            perms: "crm:lead:toPool",
            icon: null,
            sort: 5,
            visible: 1,
            children: []
          },
          {
            menuId: 1106,
            parentId: 11,
            menuName: "线索转客户",
            menuType: 3,
            path: null,
            component: null,
            perms: "crm:lead:convert",
            icon: null,
            sort: 6,
            visible: 1,
            children: []
          }
        ]
      },
      {
        menuId: 12,
        parentId: 10,
        menuName: "线索池",
        menuType: 2,
        path: "/crm/lead-pool",
        component: "crm/lead-pool/index",
        perms: "crm:leadPool:list",
        icon: "Box",
        sort: 2,
        visible: 1,
        children: [
          {
            menuId: 1201,
            parentId: 12,
            menuName: "分配",
            menuType: 3,
            path: null,
            component: null,
            perms: "crm:leadPool:assign",
            icon: null,
            sort: 1,
            visible: 1,
            children: []
          },
          {
            menuId: 1202,
            parentId: 12,
            menuName: "领取",
            menuType: 3,
            path: null,
            component: null,
            perms: "crm:leadPool:claim",
            icon: null,
            sort: 2,
            visible: 1,
            children: []
          },
          {
            menuId: 1203,
            parentId: 12,
            menuName: "删除",
            menuType: 3,
            path: null,
            component: null,
            perms: "crm:leadPool:delete",
            icon: null,
            sort: 3,
            visible: 1,
            children: []
          }
        ]
      },
      {
        menuId: 13,
        parentId: 10,
        menuName: "线索详情",
        menuType: 2,
        path: "/crm/lead/:id",
        component: "crm/lead/detail",
        perms: "crm:lead:list",
        icon: "Document",
        sort: 9,
        visible: 0,
        children: []
      }
    ]
  },
  {
    menuId: 20,
    parentId: 0,
    menuName: "客户",
    menuType: 1,
    path: null,
    component: null,
    perms: "crm:customer",
    icon: "User",
    sort: 3,
    visible: 1,
    children: [
      {
        menuId: 21,
        parentId: 20,
        menuName: "客户",
        menuType: 2,
        path: "/crm/customer",
        component: "crm/customer/index",
        perms: "crm:customer:list",
        icon: "User",
        sort: 1,
        visible: 1,
        children: [
          {
            menuId: 2101,
            parentId: 21,
            menuName: "新增客户",
            menuType: 3,
            path: null,
            component: null,
            perms: "crm:customer:create",
            icon: null,
            sort: 1,
            visible: 1,
            children: []
          },
          {
            menuId: 2102,
            parentId: 21,
            menuName: "修改客户",
            menuType: 3,
            path: null,
            component: null,
            perms: "crm:customer:update",
            icon: null,
            sort: 2,
            visible: 1,
            children: []
          },
          {
            menuId: 2103,
            parentId: 21,
            menuName: "删除客户",
            menuType: 3,
            path: null,
            component: null,
            perms: "crm:customer:delete",
            icon: null,
            sort: 3,
            visible: 1,
            children: []
          },
          {
            menuId: 2104,
            parentId: 21,
            menuName: "导出客户",
            menuType: 3,
            path: null,
            component: null,
            perms: "crm:customer:export",
            icon: null,
            sort: 4,
            visible: 1,
            children: []
          },
          {
            menuId: 2105,
            parentId: 21,
            menuName: "放入公海",
            menuType: 3,
            path: null,
            component: null,
            perms: "crm:customer:toPool",
            icon: null,
            sort: 5,
            visible: 1,
            children: []
          },
          {
            menuId: 2106,
            parentId: 21,
            menuName: "客户共享",
            menuType: 3,
            path: null,
            component: null,
            perms: "crm:customer:share",
            icon: null,
            sort: 6,
            visible: 1,
            children: []
          }
        ]
      },
      {
        menuId: 22,
        parentId: 20,
        menuName: "公海",
        menuType: 2,
        path: "/crm/customer-pool",
        component: "crm/customer-pool/index",
        perms: "crm:customerPool:list",
        icon: "Ship",
        sort: 2,
        visible: 1,
        children: [
          {
            menuId: 2201,
            parentId: 22,
            menuName: "分配",
            menuType: 3,
            path: null,
            component: null,
            perms: "crm:customerPool:assign",
            icon: null,
            sort: 1,
            visible: 1,
            children: []
          },
          {
            menuId: 2202,
            parentId: 22,
            menuName: "领取",
            menuType: 3,
            path: null,
            component: null,
            perms: "crm:customerPool:claim",
            icon: null,
            sort: 2,
            visible: 1,
            children: []
          },
          {
            menuId: 2203,
            parentId: 22,
            menuName: "删除",
            menuType: 3,
            path: null,
            component: null,
            perms: "crm:customerPool:delete",
            icon: null,
            sort: 3,
            visible: 1,
            children: []
          }
        ]
      },
      {
        menuId: 23,
        parentId: 20,
        menuName: "客户详情",
        menuType: 2,
        path: "/crm/customer/:id",
        component: "crm/customer/detail",
        perms: "crm:customer:list",
        icon: "Document",
        sort: 9,
        visible: 0,
        children: [
          {
            menuId: 2301,
            parentId: 23,
            menuName: "新增联系人",
            menuType: 3,
            path: null,
            component: null,
            perms: "crm:contact:create",
            icon: null,
            sort: 1,
            visible: 1,
            children: []
          },
          {
            menuId: 2302,
            parentId: 23,
            menuName: "修改联系人",
            menuType: 3,
            path: null,
            component: null,
            perms: "crm:contact:update",
            icon: null,
            sort: 2,
            visible: 1,
            children: []
          },
          {
            menuId: 2303,
            parentId: 23,
            menuName: "删除联系人",
            menuType: 3,
            path: null,
            component: null,
            perms: "crm:contact:delete",
            icon: null,
            sort: 3,
            visible: 1,
            children: []
          },
          {
            menuId: 2304,
            parentId: 23,
            menuName: "维护开票信息",
            menuType: 3,
            path: null,
            component: null,
            perms: "crm:invoiceInfo:update",
            icon: null,
            sort: 4,
            visible: 1,
            children: []
          }
        ]
      },
      {
        menuId: 24,
        parentId: 20,
        menuName: "公海规则",
        menuType: 2,
        path: "/crm/pool-rule",
        component: "crm/pool-rule/index",
        perms: "crm:poolRule:list",
        icon: "Setting",
        sort: 9,
        visible: 0,
        children: [
          {
            menuId: 2401,
            parentId: 24,
            menuName: "修改公海规则",
            menuType: 3,
            path: null,
            component: null,
            perms: "crm:poolRule:update",
            icon: null,
            sort: 1,
            visible: 1,
            children: []
          }
        ]
      }
    ]
  },
  {
    menuId: 30,
    parentId: 0,
    menuName: "商机",
    menuType: 1,
    path: null,
    component: null,
    perms: "crm:opportunity",
    icon: "TrendCharts",
    sort: 4,
    visible: 1,
    children: [
      {
        menuId: 31,
        parentId: 30,
        menuName: "商机",
        menuType: 2,
        path: "/crm/opportunity",
        component: "crm/opportunity/index",
        perms: "crm:opportunity:list",
        icon: "TrendCharts",
        sort: 1,
        visible: 1,
        children: [
          {
            menuId: 3101,
            parentId: 31,
            menuName: "新增商机",
            menuType: 3,
            path: null,
            component: null,
            perms: "crm:opportunity:create",
            icon: null,
            sort: 1,
            visible: 1,
            children: []
          },
          {
            menuId: 3102,
            parentId: 31,
            menuName: "修改商机",
            menuType: 3,
            path: null,
            component: null,
            perms: "crm:opportunity:update",
            icon: null,
            sort: 2,
            visible: 1,
            children: []
          },
          {
            menuId: 3103,
            parentId: 31,
            menuName: "删除商机",
            menuType: 3,
            path: null,
            component: null,
            perms: "crm:opportunity:delete",
            icon: null,
            sort: 3,
            visible: 1,
            children: []
          },
          {
            menuId: 3104,
            parentId: 31,
            menuName: "导出商机",
            menuType: 3,
            path: null,
            component: null,
            perms: "crm:opportunity:export",
            icon: null,
            sort: 4,
            visible: 1,
            children: []
          },
          {
            menuId: 3105,
            parentId: 31,
            menuName: "变更阶段",
            menuType: 3,
            path: null,
            component: null,
            perms: "crm:opportunity:changeStage",
            icon: null,
            sort: 5,
            visible: 1,
            children: []
          },
          {
            menuId: 3106,
            parentId: 31,
            menuName: "添加产品",
            menuType: 3,
            path: null,
            component: null,
            perms: "crm:opportunity:addProduct",
            icon: null,
            sort: 6,
            visible: 1,
            children: []
          }
        ]
      },
      {
        menuId: 33,
        parentId: 30,
        menuName: "商机报价单",
        menuType: 2,
        path: "/crm/quotation",
        component: "crm/quotation/index",
        perms: "crm:quotation:list",
        icon: "Tickets",
        sort: 2,
        visible: 1,
        children: [
          {
            menuId: 3301,
            parentId: 33,
            menuName: "新增报价单",
            menuType: 3,
            path: null,
            component: null,
            perms: "crm:quotation:create",
            icon: null,
            sort: 1,
            visible: 1,
            children: []
          },
          {
            menuId: 3302,
            parentId: 33,
            menuName: "修改报价单",
            menuType: 3,
            path: null,
            component: null,
            perms: "crm:quotation:update",
            icon: null,
            sort: 2,
            visible: 1,
            children: []
          },
          {
            menuId: 3303,
            parentId: 33,
            menuName: "删除报价单",
            menuType: 3,
            path: null,
            component: null,
            perms: "crm:quotation:delete",
            icon: null,
            sort: 3,
            visible: 1,
            children: []
          }
        ]
      },
      {
        menuId: 32,
        parentId: 30,
        menuName: "商机详情",
        menuType: 2,
        path: "/crm/opportunity/:id",
        component: "crm/opportunity/detail",
        perms: "crm:opportunity:list",
        icon: "Document",
        sort: 9,
        visible: 0,
        children: []
      },
      {
        menuId: 34,
        parentId: 30,
        menuName: "报价单详情",
        menuType: 2,
        path: "/crm/quotation/:id",
        component: "crm/quotation/detail",
        perms: "crm:quotation:list",
        icon: "Document",
        sort: 9,
        visible: 0,
        children: []
      }
    ]
  },
  {
    menuId: 40,
    parentId: 0,
    menuName: "合同",
    menuType: 1,
    path: null,
    component: null,
    perms: "crm:contract",
    icon: "Document",
    sort: 5,
    visible: 1,
    children: [
      {
        menuId: 41,
        parentId: 40,
        menuName: "合同",
        menuType: 2,
        path: "/crm/contract",
        component: "crm/contract/index",
        perms: "crm:contract:list",
        icon: "Document",
        sort: 1,
        visible: 1,
        children: [
          {
            menuId: 4101,
            parentId: 41,
            menuName: "新增合同",
            menuType: 3,
            path: null,
            component: null,
            perms: "crm:contract:create",
            icon: null,
            sort: 1,
            visible: 1,
            children: []
          },
          {
            menuId: 4102,
            parentId: 41,
            menuName: "修改合同",
            menuType: 3,
            path: null,
            component: null,
            perms: "crm:contract:update",
            icon: null,
            sort: 2,
            visible: 1,
            children: []
          },
          {
            menuId: 4103,
            parentId: 41,
            menuName: "删除合同",
            menuType: 3,
            path: null,
            component: null,
            perms: "crm:contract:delete",
            icon: null,
            sort: 3,
            visible: 1,
            children: []
          },
          {
            menuId: 4104,
            parentId: 41,
            menuName: "导出合同",
            menuType: 3,
            path: null,
            component: null,
            perms: "crm:contract:export",
            icon: null,
            sort: 4,
            visible: 1,
            children: []
          },
          {
            menuId: 4105,
            parentId: 41,
            menuName: "提交审核",
            menuType: 3,
            path: null,
            component: null,
            perms: "crm:contract:submit",
            icon: null,
            sort: 5,
            visible: 1,
            children: []
          },
          {
            menuId: 4106,
            parentId: 41,
            menuName: "作废合同",
            menuType: 3,
            path: null,
            component: null,
            perms: "crm:contract:void",
            icon: null,
            sort: 6,
            visible: 1,
            children: []
          }
        ]
      },
      {
        menuId: 42,
        parentId: 40,
        menuName: "合同审核",
        menuType: 2,
        path: "/crm/contract-audit",
        component: "crm/contract/audit",
        perms: "crm:contract:auditList",
        icon: "Stamp",
        sort: 2,
        visible: 1,
        children: [
          {
            menuId: 4201,
            parentId: 42,
            menuName: "审核",
            menuType: 3,
            path: null,
            component: null,
            perms: "crm:contract:audit",
            icon: null,
            sort: 1,
            visible: 1,
            children: []
          },
          {
            menuId: 4202,
            parentId: 42,
            menuName: "批量审核",
            menuType: 3,
            path: null,
            component: null,
            perms: "crm:contract:batchAudit",
            icon: null,
            sort: 2,
            visible: 1,
            children: []
          }
        ]
      },
      {
        menuId: 43,
        parentId: 40,
        menuName: "合同详情",
        menuType: 2,
        path: "/crm/contract/:id",
        component: "crm/contract/detail",
        perms: "crm:contract:list",
        icon: "Document",
        sort: 9,
        visible: 0,
        children: []
      }
    ]
  },
  {
    menuId: 50,
    parentId: 0,
    menuName: "产品类型",
    menuType: 1,
    path: null,
    component: null,
    perms: "crm:product",
    icon: "Goods",
    sort: 6,
    visible: 1,
    children: [
      {
        menuId: 51,
        parentId: 50,
        menuName: "产品",
        menuType: 2,
        path: "/crm/product",
        component: "crm/product/index",
        perms: "crm:product:list",
        icon: "Goods",
        sort: 1,
        visible: 1,
        children: [
          {
            menuId: 5101,
            parentId: 51,
            menuName: "新增产品",
            menuType: 3,
            path: null,
            component: null,
            perms: "crm:product:create",
            icon: null,
            sort: 1,
            visible: 1,
            children: []
          },
          {
            menuId: 5102,
            parentId: 51,
            menuName: "修改产品",
            menuType: 3,
            path: null,
            component: null,
            perms: "crm:product:update",
            icon: null,
            sort: 2,
            visible: 1,
            children: []
          },
          {
            menuId: 5103,
            parentId: 51,
            menuName: "删除产品",
            menuType: 3,
            path: null,
            component: null,
            perms: "crm:product:delete",
            icon: null,
            sort: 3,
            visible: 1,
            children: []
          },
          {
            menuId: 5104,
            parentId: 51,
            menuName: "上架",
            menuType: 3,
            path: null,
            component: null,
            perms: "crm:product:onShelf",
            icon: null,
            sort: 4,
            visible: 1,
            children: []
          },
          {
            menuId: 5105,
            parentId: 51,
            menuName: "下架",
            menuType: 3,
            path: null,
            component: null,
            perms: "crm:product:offShelf",
            icon: null,
            sort: 5,
            visible: 1,
            children: []
          }
        ]
      },
      {
        menuId: 52,
        parentId: 50,
        menuName: "产品分类",
        menuType: 2,
        path: "/crm/product-category",
        component: "crm/product/category",
        perms: "crm:productCategory:list",
        icon: "Menu",
        sort: 2,
        visible: 1,
        children: [
          {
            menuId: 5201,
            parentId: 52,
            menuName: "新增分类",
            menuType: 3,
            path: null,
            component: null,
            perms: "crm:productCategory:create",
            icon: null,
            sort: 1,
            visible: 1,
            children: []
          },
          {
            menuId: 5202,
            parentId: 52,
            menuName: "修改分类",
            menuType: 3,
            path: null,
            component: null,
            perms: "crm:productCategory:update",
            icon: null,
            sort: 2,
            visible: 1,
            children: []
          },
          {
            menuId: 5203,
            parentId: 52,
            menuName: "删除分类",
            menuType: 3,
            path: null,
            component: null,
            perms: "crm:productCategory:delete",
            icon: null,
            sort: 3,
            visible: 1,
            children: []
          }
        ]
      },
      {
        menuId: 53,
        parentId: 50,
        menuName: "产品详情",
        menuType: 2,
        path: "/crm/product/:id",
        component: "crm/product/detail",
        perms: "crm:product:list",
        icon: "Document",
        sort: 9,
        visible: 0,
        children: []
      }
    ]
  },
  {
    menuId: 60,
    parentId: 0,
    menuName: "财务",
    menuType: 1,
    path: null,
    component: null,
    perms: "fin:payment",
    icon: "Money",
    sort: 7,
    visible: 1,
    children: [
      {
        menuId: 61,
        parentId: 60,
        menuName: "回款登记",
        menuType: 2,
        path: "/finance/payment",
        component: "finance/payment/index",
        perms: "fin:payment:list",
        icon: "Money",
        sort: 1,
        visible: 1,
        children: [
          {
            menuId: 6101,
            parentId: 61,
            menuName: "新增回款",
            menuType: 3,
            path: null,
            component: null,
            perms: "fin:payment:create",
            icon: null,
            sort: 1,
            visible: 1,
            children: []
          },
          {
            menuId: 6102,
            parentId: 61,
            menuName: "修改回款",
            menuType: 3,
            path: null,
            component: null,
            perms: "fin:payment:update",
            icon: null,
            sort: 2,
            visible: 1,
            children: []
          },
          {
            menuId: 6103,
            parentId: 61,
            menuName: "删除回款",
            menuType: 3,
            path: null,
            component: null,
            perms: "fin:payment:delete",
            icon: null,
            sort: 3,
            visible: 1,
            children: []
          },
          {
            menuId: 6104,
            parentId: 61,
            menuName: "导出回款",
            menuType: 3,
            path: null,
            component: null,
            perms: "fin:payment:export",
            icon: null,
            sort: 4,
            visible: 1,
            children: []
          },
          {
            menuId: 6105,
            parentId: 61,
            menuName: "提交审核",
            menuType: 3,
            path: null,
            component: null,
            perms: "fin:payment:submit",
            icon: null,
            sort: 5,
            visible: 1,
            children: []
          }
        ]
      },
      {
        menuId: 62,
        parentId: 60,
        menuName: "回款审核",
        menuType: 2,
        path: "/finance/payment-audit",
        component: "finance/payment/audit",
        perms: "fin:payment:auditList",
        icon: "Stamp",
        sort: 2,
        visible: 1,
        children: [
          {
            menuId: 6201,
            parentId: 62,
            menuName: "审核",
            menuType: 3,
            path: null,
            component: null,
            perms: "fin:payment:audit",
            icon: null,
            sort: 1,
            visible: 1,
            children: []
          }
        ]
      },
      {
        menuId: 63,
        parentId: 60,
        menuName: "发票登记",
        menuType: 2,
        path: "/finance/invoice",
        component: "finance/invoice/index",
        perms: "fin:invoice:list",
        icon: "Tickets",
        sort: 3,
        visible: 1,
        children: [
          {
            menuId: 6301,
            parentId: 63,
            menuName: "新增发票",
            menuType: 3,
            path: null,
            component: null,
            perms: "fin:invoice:create",
            icon: null,
            sort: 1,
            visible: 1,
            children: []
          },
          {
            menuId: 6302,
            parentId: 63,
            menuName: "修改发票",
            menuType: 3,
            path: null,
            component: null,
            perms: "fin:invoice:update",
            icon: null,
            sort: 2,
            visible: 1,
            children: []
          },
          {
            menuId: 6303,
            parentId: 63,
            menuName: "删除发票",
            menuType: 3,
            path: null,
            component: null,
            perms: "fin:invoice:delete",
            icon: null,
            sort: 3,
            visible: 1,
            children: []
          },
          {
            menuId: 6304,
            parentId: 63,
            menuName: "导出发票",
            menuType: 3,
            path: null,
            component: null,
            perms: "fin:invoice:export",
            icon: null,
            sort: 4,
            visible: 1,
            children: []
          },
          {
            menuId: 6305,
            parentId: 63,
            menuName: "提交审核",
            menuType: 3,
            path: null,
            component: null,
            perms: "fin:invoice:submit",
            icon: null,
            sort: 5,
            visible: 1,
            children: []
          }
        ]
      },
      {
        menuId: 64,
        parentId: 60,
        menuName: "财务开票",
        menuType: 2,
        path: "/finance/invoice-issue",
        component: "finance/invoice/issue",
        perms: "fin:invoice:issueList",
        icon: "Stamp",
        sort: 4,
        visible: 1,
        children: [
          {
            menuId: 6401,
            parentId: 64,
            menuName: "开票",
            menuType: 3,
            path: null,
            component: null,
            perms: "fin:invoice:issue",
            icon: null,
            sort: 1,
            visible: 1,
            children: []
          },
          {
            menuId: 6402,
            parentId: 64,
            menuName: "作废发票",
            menuType: 3,
            path: null,
            component: null,
            perms: "fin:invoice:void",
            icon: null,
            sort: 2,
            visible: 1,
            children: []
          }
        ]
      },
      {
        menuId: 65,
        parentId: 60,
        menuName: "回款详情",
        menuType: 2,
        path: "/finance/payment/:id",
        component: "finance/payment/detail",
        perms: "fin:payment:list",
        icon: "Document",
        sort: 9,
        visible: 0,
        children: []
      },
      {
        menuId: 66,
        parentId: 60,
        menuName: "发票详情",
        menuType: 2,
        path: "/finance/invoice/:id",
        component: "finance/invoice/detail",
        perms: "fin:invoice:list",
        icon: "Document",
        sort: 10,
        visible: 0,
        children: []
      }
    ]
  },
  {
    menuId: 70,
    parentId: 0,
    menuName: "系统设置",
    menuType: 1,
    path: null,
    component: null,
    perms: "system:dept",
    icon: "OfficeBuilding",
    sort: 8,
    visible: 1,
    children: [
      {
        menuId: 71,
        parentId: 70,
        menuName: "组织架构",
        menuType: 2,
        path: "/system/dept",
        component: "system/dept/index",
        perms: "system:dept:list",
        icon: "OfficeBuilding",
        sort: 1,
        visible: 1,
        children: [
          {
            menuId: 7101,
            parentId: 71,
            menuName: "新增部门",
            menuType: 3,
            path: null,
            component: null,
            perms: "system:dept:create",
            icon: null,
            sort: 1,
            visible: 1,
            children: []
          },
          {
            menuId: 7102,
            parentId: 71,
            menuName: "修改部门",
            menuType: 3,
            path: null,
            component: null,
            perms: "system:dept:update",
            icon: null,
            sort: 2,
            visible: 1,
            children: []
          },
          {
            menuId: 7103,
            parentId: 71,
            menuName: "删除部门",
            menuType: 3,
            path: null,
            component: null,
            perms: "system:dept:delete",
            icon: null,
            sort: 3,
            visible: 1,
            children: []
          },
          {
            menuId: 7104,
            parentId: 71,
            menuName: "设置部门负责人",
            menuType: 3,
            path: null,
            component: null,
            perms: "system:dept:setLeader",
            icon: null,
            sort: 4,
            visible: 1,
            children: []
          }
        ]
      },
      {
        menuId: 72,
        parentId: 70,
        menuName: "人员管理",
        menuType: 2,
        path: "/system/user",
        component: "system/user/index",
        perms: "system:user:list",
        icon: "User",
        sort: 2,
        visible: 1,
        children: [
          {
            menuId: 7201,
            parentId: 72,
            menuName: "新增人员",
            menuType: 3,
            path: null,
            component: null,
            perms: "system:user:create",
            icon: null,
            sort: 1,
            visible: 1,
            children: []
          },
          {
            menuId: 7202,
            parentId: 72,
            menuName: "修改人员",
            menuType: 3,
            path: null,
            component: null,
            perms: "system:user:update",
            icon: null,
            sort: 2,
            visible: 1,
            children: []
          },
          {
            menuId: 7203,
            parentId: 72,
            menuName: "删除人员",
            menuType: 3,
            path: null,
            component: null,
            perms: "system:user:delete",
            icon: null,
            sort: 3,
            visible: 1,
            children: []
          },
          {
            menuId: 7204,
            parentId: 72,
            menuName: "重置密码",
            menuType: 3,
            path: null,
            component: null,
            perms: "system:user:resetPwd",
            icon: null,
            sort: 4,
            visible: 1,
            children: []
          },
          {
            menuId: 7205,
            parentId: 72,
            menuName: "启用/禁用",
            menuType: 3,
            path: null,
            component: null,
            perms: "system:user:changeStatus",
            icon: null,
            sort: 5,
            visible: 1,
            children: []
          },
          {
            menuId: 7206,
            parentId: 72,
            menuName: "操作离职",
            menuType: 3,
            path: null,
            component: null,
            perms: "system:user:resign",
            icon: null,
            sort: 6,
            visible: 1,
            children: []
          },
          {
            menuId: 7207,
            parentId: 72,
            menuName: "导入人员",
            menuType: 3,
            path: null,
            component: null,
            perms: "system:user:import",
            icon: null,
            sort: 7,
            visible: 1,
            children: []
          },
          {
            menuId: 7208,
            parentId: 72,
            menuName: "导出人员",
            menuType: 3,
            path: null,
            component: null,
            perms: "system:user:export",
            icon: null,
            sort: 8,
            visible: 1,
            children: []
          }
        ]
      },
      {
        menuId: 73,
        parentId: 70,
        menuName: "角色权限",
        menuType: 2,
        path: "/system/role",
        component: "system/role/index",
        perms: "system:role:list",
        icon: "Lock",
        sort: 3,
        visible: 1,
        children: [
          {
            menuId: 7301,
            parentId: 73,
            menuName: "新增角色",
            menuType: 3,
            path: null,
            component: null,
            perms: "system:role:create",
            icon: null,
            sort: 1,
            visible: 1,
            children: []
          },
          {
            menuId: 7302,
            parentId: 73,
            menuName: "修改角色",
            menuType: 3,
            path: null,
            component: null,
            perms: "system:role:update",
            icon: null,
            sort: 2,
            visible: 1,
            children: []
          },
          {
            menuId: 7303,
            parentId: 73,
            menuName: "删除角色",
            menuType: 3,
            path: null,
            component: null,
            perms: "system:role:delete",
            icon: null,
            sort: 3,
            visible: 1,
            children: []
          },
          {
            menuId: 7304,
            parentId: 73,
            menuName: "权限配置",
            menuType: 3,
            path: null,
            component: null,
            perms: "system:role:assignPermission",
            icon: null,
            sort: 4,
            visible: 1,
            children: []
          },
          {
            menuId: 7305,
            parentId: 73,
            menuName: "角色人员",
            menuType: 3,
            path: null,
            component: null,
            perms: "system:role:assignUser",
            icon: null,
            sort: 5,
            visible: 1,
            children: []
          },
          {
            menuId: 7306,
            parentId: 73,
            menuName: "新增角色组",
            menuType: 3,
            path: null,
            component: null,
            perms: "system:roleGroup:create",
            icon: null,
            sort: 6,
            visible: 1,
            children: []
          },
          {
            menuId: 7307,
            parentId: 73,
            menuName: "删除角色组",
            menuType: 3,
            path: null,
            component: null,
            perms: "system:roleGroup:delete",
            icon: null,
            sort: 7,
            visible: 1,
            children: []
          }
        ]
      },
      {
        menuId: 74,
        parentId: 70,
        menuName: "登陆日志",
        menuType: 2,
        path: "/system/login-log",
        component: "system/log/login",
        perms: "system:loginLog:list",
        icon: "Clock",
        sort: 4,
        visible: 1,
        children: [
          {
            menuId: 7401,
            parentId: 74,
            menuName: "导出日志",
            menuType: 3,
            path: null,
            component: null,
            perms: "system:loginLog:export",
            icon: null,
            sort: 1,
            visible: 1,
            children: []
          }
        ]
      },
      {
        menuId: 75,
        parentId: 70,
        menuName: "编号定义",
        menuType: 2,
        path: "/system/numbering-rule",
        component: "system/numbering-rule/index",
        perms: "system:numberingRule:list",
        icon: "Postcard",
        sort: 5,
        visible: 1,
        children: [
          {
            menuId: 7501,
            parentId: 75,
            menuName: "新增编号规则",
            menuType: 3,
            path: null,
            component: null,
            perms: "system:numberingRule:create",
            icon: null,
            sort: 1,
            visible: 1,
            children: []
          },
          {
            menuId: 7502,
            parentId: 75,
            menuName: "修改编号规则",
            menuType: 3,
            path: null,
            component: null,
            perms: "system:numberingRule:update",
            icon: null,
            sort: 2,
            visible: 1,
            children: []
          },
          {
            menuId: 7503,
            parentId: 75,
            menuName: "删除编号规则",
            menuType: 3,
            path: null,
            component: null,
            perms: "system:numberingRule:delete",
            icon: null,
            sort: 3,
            visible: 1,
            children: []
          }
        ]
      },
      {
        menuId: 76,
        parentId: 70,
        menuName: "计量单位",
        menuType: 2,
        path: "/system/unit",
        component: "system/unit/index",
        perms: "system:unit:list",
        icon: "ScaleToOriginal",
        sort: 6,
        visible: 1,
        children: [
          {
            menuId: 7601,
            parentId: 76,
            menuName: "新增单位",
            menuType: 3,
            path: null,
            component: null,
            perms: "system:unit:create",
            icon: null,
            sort: 1,
            visible: 1,
            children: []
          },
          {
            menuId: 7602,
            parentId: 76,
            menuName: "修改单位",
            menuType: 3,
            path: null,
            component: null,
            perms: "system:unit:update",
            icon: null,
            sort: 2,
            visible: 1,
            children: []
          },
          {
            menuId: 7603,
            parentId: 76,
            menuName: "删除单位",
            menuType: 3,
            path: null,
            component: null,
            perms: "system:unit:delete",
            icon: null,
            sort: 3,
            visible: 1,
            children: []
          }
        ]
      },
      {
        menuId: 78,
        parentId: 70,
        menuName: "字典管理",
        menuType: 2,
        path: "/system/dict",
        component: "system/dict/index",
        perms: "system:dict:list",
        icon: "Collection",
        sort: 7,
        visible: 1,
        children: [
          {
            menuId: 7801,
            parentId: 78,
            menuName: "新增字典",
            menuType: 3,
            path: null,
            component: null,
            perms: "system:dict:create",
            icon: null,
            sort: 1,
            visible: 1,
            children: []
          },
          {
            menuId: 7802,
            parentId: 78,
            menuName: "修改字典",
            menuType: 3,
            path: null,
            component: null,
            perms: "system:dict:update",
            icon: null,
            sort: 2,
            visible: 1,
            children: []
          },
          {
            menuId: 7803,
            parentId: 78,
            menuName: "删除字典",
            menuType: 3,
            path: null,
            component: null,
            perms: "system:dict:delete",
            icon: null,
            sort: 3,
            visible: 1,
            children: []
          }
        ]
      },
      {
        menuId: 77,
        parentId: 70,
        menuName: "操作日志",
        menuType: 2,
        path: "/system/operation-log",
        component: "system/log/operation",
        perms: "system:operationLog:list",
        icon: "Document",
        sort: 9,
        visible: 0,
        children: []
      }
    ]
  },
  {
    menuId: 80,
    parentId: 0,
    menuName: "AI小助手",
    menuType: 1,
    path: null,
    component: null,
    perms: "ai:chat",
    icon: "MagicStick",
    sort: 9,
    visible: 1,
    children: [
      {
        menuId: 8001,
        parentId: 80,
        menuName: "使用AI小助手",
        menuType: 3,
        path: null,
        component: null,
        perms: "ai:chat:use",
        icon: null,
        sort: 1,
        visible: 1,
        children: []
      }
    ]
  }
]

/** 超级管理员的权限标识 */
export const mockPermissions = ['*:*:*']

/**
 * mock 用户信息（对应后端 GET /auth/me 的响应）
 *
 * ⚠️ 这个对象是**可变的**：`api/auth.js` 的 `updateProfile` 在 mock 模式下
 *    会把改过的字段写回这里，这样「保存 → 关弹窗 → 再打开」能看到新值。
 *    别改成 `Object.freeze` 或换成 getter，那会让个人资料保存变成假成功。
 */
export const mockUserInfo = {
  userId: 1,
  username: 'admin',
  realName: '超级管理员',
  // 个人资料弹窗（ProfileDialog.vue）的回显值，与后端 UserInfoRespVO 的字段一一对应
  nickname: '超级管理员',
  phone: '13800008880',
  email: 'admin@aurum.com',
  avatar: '',
  deptId: 1,
  deptName: '总公司',
  roles: ['admin'],
  permissions: mockPermissions,
  menus: mockMenus
}
