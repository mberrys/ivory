/** @type {import('eslint').Linter.Config} */
module.exports = {
    extends: [
        '../../configs/build.eslintrc.json'
    ],
    parserOptions: {
        tsconfigRootDir: __dirname,
        project: 'tsconfig.json'
    },
    overrides: [
        {
            // Handlers run between BEGIN and COMMIT, so they must be synchronous.
            files: [
                'src/node/store/handlers/**/*.ts',
                'src/node/**/test/*-handlers.ts'
            ],
            rules: {
                'no-restricted-syntax': [
                    'error',
                    {
                        selector: ':function[async=true]',
                        message: 'Commit handlers run inside a SQLite transaction and must be synchronous: no async functions.'
                    },
                    {
                        selector: 'AwaitExpression',
                        message: 'Commit handlers run inside a SQLite transaction and must be synchronous: no await.'
                    },
                    {
                        selector: 'YieldExpression',
                        message: 'Commit handlers run inside a SQLite transaction and must be synchronous: no yield.'
                    },
                    {
                        selector: 'CallExpression[callee.property.name=\'then\']',
                        message: 'Commit handlers run inside a SQLite transaction and must be synchronous: no promise chains.'
                    }
                ],
                '@typescript-eslint/no-floating-promises': 'error',
                '@typescript-eslint/no-misused-promises': 'error'
            }
        },
        {
            files: ['src/**/*.ts'],
            excludedFiles: ['src/node/store/**'],
            rules: {
                'no-restricted-imports': [
                    'error',
                    '.',
                    './',
                    '..',
                    '../',
                    {
                        name: 'node:sqlite',
                        message: 'No SQL outside core/node/store'
                    }
                ]
            }
        }
    ]
};
