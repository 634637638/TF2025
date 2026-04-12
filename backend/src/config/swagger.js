/**
 * Swagger API 文档配置
 *
 * TF2025 项目 API 文档自动生成配置
 * 访问地址: http://localhost:3000/api-docs
 * 生产环境: http://your-domain/api-docs
 */

const swaggerJsdoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'TF2025 手机销售管理系统 API',
      version: '1.0.0',
      description: `
TF2025 手机销售管理系统后端 API 文档

## 主要功能模块
- 📱 **销售管理** - 销售订单、批发、划拨
- 📦 **库存管理** - 手机/配件库存、入库出库
- 👥 **客户管理** - 客户档案、会员体系
- 🏭 **供应商管理** - 供应商信息、采购、打款
- 👤 **员工管理** - 员工信息、考勤工资
- 🔐 **权限管理** - 用户、角色、权限控制

## 认证方式
本 API 使用 JWT Bearer Token 认证。
1. 登录获取 token
2. 在请求头添加: \`Authorization: Bearer <token>\`

## 响应格式
\`\`\`json
{
  "success": true,
  "data": {},
  "message": "操作成功",
  "timestamp": "2026-01-23T10:00:00.000Z"
}
\`\`\`
      `,
      contact: {
        name: 'TF2025 开发团队',
        email: 'support@tf2025.com'
      },
      license: {
        name: 'MIT',
        url: 'https://opensource.org/licenses/MIT'
      }
    },
    servers: [
      {
        url: process.env.API_BASE_URL || 'http://localhost:3000',
        description: process.env.NODE_ENV === 'production' ? '生产环境' : '开发环境'
      },
      {
        url: 'https://api.tf2025.com',
        description: '生产环境（备用）'
      }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'JWT 认证 Token，从登录接口获取'
        }
      },
      schemas: {
        // 通用响应
        ApiResponse: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              description: '请求是否成功',
              example: true
            },
            data: {
              type: 'object',
              description: '返回数据'
            },
            message: {
              type: 'string',
              description: '提示消息',
              example: '操作成功'
            },
            timestamp: {
              type: 'string',
              format: 'date-time',
              description: '响应时间戳'
            }
          }
        },
        // 分页响应
        PaginatedResponse: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: true
            },
            data: {
              type: 'array',
              items: {
                type: 'object'
              }
            },
            pagination: {
              type: 'object',
              properties: {
                page: {
                  type: 'integer',
                  description: '当前页码',
                  example: 1
                },
                pageSize: {
                  type: 'integer',
                  description: '每页数量',
                  example: 20
                },
                total: {
                  type: 'integer',
                  description: '总记录数',
                  example: 100
                },
                totalPages: {
                  type: 'integer',
                  description: '总页数',
                  example: 5
                }
              }
            },
            message: {
              type: 'string'
            },
            timestamp: {
              type: 'string',
              format: 'date-time'
            }
          }
        },
        // 错误响应
        ErrorResponse: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: false
            },
            error: {
              type: 'object',
              properties: {
                code: {
                  type: 'string',
                  description: '错误代码',
                  example: 'VALIDATION_ERROR'
                },
                message: {
                  type: 'string',
                  description: '错误消息',
                  example: '参数验证失败'
                },
                details: {
                  type: 'object',
                  description: '错误详情'
                }
              }
            },
            timestamp: {
              type: 'string',
              format: 'date-time'
            }
          }
        },
        // 用户实体
        User: {
          type: 'object',
          properties: {
            id: {
              type: 'integer',
              description: '用户ID'
            },
            username: {
              type: 'string',
              description: '用户名'
            },
            name: {
              type: 'string',
              description: '姓名'
            },
            email: {
              type: 'string',
              format: 'email',
              description: '邮箱'
            },
            phone: {
              type: 'string',
              description: '手机号'
            },
            roleId: {
              type: 'integer',
              description: '角色ID'
            },
            status: {
              type: 'string',
              enum: ['0', '1'],
              description: '状态：0-禁用，1-启用'
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
              description: '创建时间'
            }
          }
        },
        // 客户实体
        Customer: {
          type: 'object',
          properties: {
            id: {
              type: 'integer'
            },
            name: {
              type: 'string',
              description: '客户姓名'
            },
            phone: {
              type: 'string',
              description: '联系电话'
            },
            address: {
              type: 'string',
              description: '地址'
            },
            type: {
              type: 'string',
              enum: ['retail', 'wholesale'],
              description: '客户类型：retail-零售，wholesale-批发'
            },
            discount: {
              type: 'number',
              description: '折扣'
            },
            balance: {
              type: 'number',
              description: '余额'
            }
          }
        },
        // 手机库存实体
        Phone: {
          type: 'object',
          properties: {
            id: {
              type: 'integer'
            },
            imei: {
              type: 'string',
              description: 'IMEI 号'
            },
            serialNumber: {
              type: 'string',
              description: '序列号'
            },
            brandId: {
              type: 'integer',
              description: '品牌ID'
            },
            modelId: {
              type: 'integer',
              description: '型号ID'
            },
            colorId: {
              type: 'integer',
              description: '颜色ID'
            },
            purchaseCost: {
              type: 'number',
              description: '采购成本'
            },
            salePrice: {
              type: 'number',
              description: '销售价格'
            },
            status: {
              type: 'string',
              enum: ['in_stock', 'sold', 'reserved'],
              description: '状态：in_stock-在库，sold-已售，reserved-预留'
            },
            storeId: {
              type: 'integer',
              description: '门店ID'
            },
            supplierId: {
              type: 'integer',
              description: '供应商ID'
            }
          }
        }
      },
      parameters: {
        // 分页参数
        PageParam: {
          name: 'page',
          in: 'query',
          description: '页码',
          required: false,
          schema: {
            type: 'integer',
            minimum: 1,
            default: 1
          }
        },
        LimitParam: {
          name: 'limit',
          in: 'query',
          description: '每页数量',
          required: false,
          schema: {
            type: 'integer',
            minimum: 1,
            maximum: 100,
            default: 20
          }
        },
        SearchParam: {
          name: 'search',
          in: 'query',
          description: '搜索关键词',
          required: false,
          schema: {
            type: 'string'
          }
        }
      }
    },
    security: [
      {
        bearerAuth: []
      }
    ],
    tags: [
      {
        name: '认证',
        description: '用户登录、登出、Token 刷新'
      },
      {
        name: '用户管理',
        description: '用户 CRUD 操作'
      },
      {
        name: '角色权限',
        description: '角色和权限管理'
      },
      {
        name: '客户管理',
        description: '客户信息管理'
      },
      {
        name: '供应商管理',
        description: '供应商信息管理'
      },
      {
        name: '销售管理',
        description: '销售订单、批发、划拨'
      },
      {
        name: '库存管理',
        description: '手机/配件库存管理'
      },
      {
        name: '配件管理',
        description: '配件库存和销售'
      },
      {
        name: '门店管理',
        description: '门店信息管理'
      },
      {
        name: '考勤工资',
        description: '员工考勤和工资计算'
      },
      {
        name: '数据统计',
        description: '数据分析和报表'
      },
      {
        name: '系统设置',
        description: '系统配置和设置'
      }
    ]
  },
  apis: [
    './src/routes/*.js',
    './src/controllers/*.js'
  ]
};

const specs = swaggerJsdoc(options);

module.exports = specs;
