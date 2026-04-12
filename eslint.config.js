import js from '@eslint/js'
import vue from 'eslint-plugin-vue'
import tseslint from '@typescript-eslint/eslint-plugin'
import tsparser from '@typescript-eslint/parser'

export default [
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
        varsIgnorePattern: '^_'
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
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module'
      }
    },
    rules: {
      'vue/multi-word-component-names': 'off',
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
        varsIgnorePattern: '^_'
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
  }
]
