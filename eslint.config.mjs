import js from '@eslint/js';
import globals from 'globals';

export default [
    js.configs.recommended,
    {
        ignores: [
            'node_modules/**',
            'shared/vendor/**',
            '**/*.min.js',
            '.git/**',
            'coverage/**',
            '.claude/**'
        ]
    },
    {
        files: ['**/*.js'],
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: 'script',
            globals: {
                ...globals.browser,
                ...globals.node,
                ...globals.serviceworker
            }
        },
        rules: {
            // 静态多页应用允许跨文件顶层变量访问
            'no-undef': 'off',
            'no-redeclare': 'off',
            'no-unused-vars': 'off',
            'no-useless-assignment': 'warn',
            'no-empty': ['warn', { allowEmptyCatch: true }],
            // 核心代码正确性检查（拦截真正的逻辑 Bug）
            'no-dupe-keys': 'error',
            'no-duplicate-case': 'error',
            'no-unreachable': 'error',
            'valid-typeof': 'error',
            'no-constant-condition': 'warn',
            'no-self-assign': 'error'
        }
    },
    {
        files: ['tests/**/*.js'],
        languageOptions: {
            globals: {
                ...globals.node
            }
        },
        rules: {
            // 测试文件禁止未声明变量与未使用的死变量
            'no-undef': 'error',
            'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }]
        }
    }
];
