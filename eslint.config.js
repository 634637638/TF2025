const js = require('@eslint/js')
const vue = require('eslint-plugin-vue')
const vueParser = require('vue-eslint-parser')
const tseslint = require('@typescript-eslint/eslint-plugin')
const tsparser = require('@typescript-eslint/parser')
const unusedImports = require('eslint-plugin-unused-imports')

module.exports = [
  // 忽略文件配置（替代 .eslintignore）
  {
    ignores: [
      'node_modules/**',
      'frontend/node_modules/**',
      'backend/node_modules/**',
      'dist/**',
      'frontend/dist/**',
      'build/**',
      'logs/**',
      '*.log',
      'uploads/**',
      'backend/uploads/**',
      '.env*',
      '*.tmp',
      '*.temp',
      '*.bak',
      '*.backup',
      '*.patch',
      '*.crt',
      '*.key',
      '*.pem',
      'ssl/**',
      'docs/**',
      '*.md',
      '.eslintrc.js',
      'vite.config.ts',
      '.DS_Store',
      'Thumbs.db',
      '*.test.js',
      '*.spec.js',
      'coverage/**',
      // unplugin 自动生成的声明文件，含 @ts-nocheck 属预期行为，不参与 lint
      'frontend/src/auto-imports.d.ts',
      'frontend/src/components.d.ts',
      'ecosystem.config.js',
      'nginx-*.conf'
    ]
  },

  // 全局配置
  {
    files: ['**/*.{js,mjs,cjs,vue,ts,tsx}'],
    ...js.configs.recommended,
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        console: 'readonly',
        process: 'readonly',
        Buffer: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
        module: 'readonly',
        require: 'readonly',
        exports: 'readonly'
      }
    },
    rules: {
      // 代码质量
      'no-console': process.env.NODE_ENV === 'production' ? 'warn' : 'off',
      'no-debugger': process.env.NODE_ENV === 'production' ? 'error' : 'off',
      'no-var': 'error',
      'prefer-const': 'warn',
      'no-unused-vars': ['warn', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        caughtErrors: 'none',
        ignoreRestSiblings: true
      }],

      // 代码风格
      'indent': ['warn', 2],
      'quotes': ['warn', 'single', { avoidEscape: true }],
      'semi': ['warn', 'never'],
      'comma-dangle': ['warn', 'never'],
      'object-curly-spacing': ['warn', 'always'],
      'array-bracket-spacing': ['warn', 'never'],

      // 最佳实践
      'eqeqeq': ['error', 'always'],
      'no-eval': 'error',
      'no-implied-eval': 'error',
      'no-new-wrappers': 'error',
      'no-throw-literal': 'error',
      'prefer-promise-reject-errors': 'error',

      // 安全性
      'no-unsafe-optional-chaining': 'error',
      'no-unsafe-negation': 'error'
    }
  },

  // Vue 文件配置
  ...vue.configs['flat/recommended'],
  {
    files: ['**/*.vue'],
    languageOptions: {
      parser: vueParser,
      parserOptions: {
        parser: tsparser,
        ecmaVersion: 'latest',
        sourceType: 'module'
      }
    },
    rules: {
      'vue/multi-word-component-names': 'off',
      // 表单分区组件接收同一个 reactive 模型；允许修改模型字段，但仍禁止替换整个 prop。
      'vue/no-mutating-props': ['error', { shallowOnly: true }],
      'vue/no-v-html': 'warn'
    }
  },

  // TypeScript 文件配置
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module'
      }
    },
    plugins: {
      '@typescript-eslint': tseslint
    },
    rules: {
      ...tseslint.configs.recommended.rules,
        '@typescript-eslint/no-unused-vars': ['warn', {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrors: 'none',
          ignoreRestSiblings: true
      }],
      '@typescript-eslint/no-explicit-any': 'warn'
    }
  },

  // 后端 Node.js 文件配置
  {
    files: ['backend/**/*.js'],
    languageOptions: {
      globals: {
        console: 'writable'
      }
    },
    rules: {
      'no-console': 'off' // 后端可以使用 console
    }
  },

  // 前端文件配置
  {
    files: ['frontend/**/*.{js,vue,ts}', 'src/**/*.{js,vue,ts}'],
    languageOptions: {
      globals: {
        window: 'readonly',
        document: 'readonly',
        navigator: 'readonly',
        localStorage: 'readonly',
        sessionStorage: 'readonly',
        fetch: 'readonly',
        XMLHttpRequest: 'readonly',
        FormData: 'readonly',
        URLSearchParams: 'readonly'
      }
    }
  },

  // 全局组件注册文件：模板中统一使用 <Image> 单词组件名（全站刻意保留），
  // 行内豁免注释会被格式类 --fix 反复挤掉，故在配置层面持久豁免。
  {
    files: ['frontend/src/components/index.ts'],
    rules: {
      'vue/multi-word-component-names': 'off',
      'vue/no-reserved-component-names': 'off'
    }
  },

  // 未用 import 自动清理：no-unused-vars 无法自动修复，该插件可安全删除未用 import。
  // 未用局部变量/参数仍需人工判断（可能有副作用或预留语义），不启用自动规则。
  {
    files: ['frontend/src/**/*.{js,ts,vue}', 'backend/src/**/*.js'],
    plugins: {
      'unused-imports': unusedImports
    },
    rules: {
      'unused-imports/no-unused-imports': 'warn'
    }
  },

  // global.d.ts describes browser and vendor APIs that are intentionally dynamic.
  // These declarations are the type boundary for untyped runtime globals; forcing
  // every vendor member to `unknown` would make the public API unusable without
  // adding unsafe casts throughout the application.
  {
    files: ['frontend/src/types/global.d.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off'
    }
  },

  // v-html 已审计豁免：以下文件的 v-html 均只消费经 escapeHtml + DOMPurify 净化的
  // 白名单生产者（safeSvg/highlightText/getMatchSnippet/renderRichText），
  // 与 config/runtime-pattern-audit.json 的 allowedVHtmlProducers 一致，故关闭报警。
  {
    files: [
      'frontend/src/components/IconRenderer.vue',
      'frontend/src/views/customers/CustomersView.vue',
      'frontend/src/views/shared/SharedView.vue'
    ],
    rules: {
      'vue/no-v-html': 'off'
    }
  },

  // emits 误报豁免：以下组件的事件均已在 types/component.ts 的共享 mixin
  // （UpdateModelValueEmits/CloseEmits/CancelEmits/UpdateVisibleEmits/ConfirmEmits）中声明，
  // vue/require-explicit-emits 无法解析跨文件类型继承，属已知规则局限，故关闭报警。
  {
    files: [
      'frontend/src/components/InventoryDetailModal.vue',
      'frontend/src/components/MemorySelector.vue',
      'frontend/src/components/MobileDialog.vue',
      'frontend/src/components/MobileForm.vue',
      'frontend/src/components/OptimizedScanner.vue',
      'frontend/src/components/PriceMarkupConfig.vue',
      'frontend/src/components/ProfessionalScanner.vue',
      'frontend/src/components/mobile/MobileSlideMenu.vue',
      'frontend/src/components/query/QueryDetailDialog.vue',
      'frontend/src/components/query/SalesReceipt.vue'
    ],
    rules: {
      'vue/require-explicit-emits': 'off'
    }
  }
]
