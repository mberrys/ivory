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
            files: ['src/**/*.ts'],
            rules: {
                'no-restricted-imports': [
                    'error',
                    '.',
                    './',
                    '..',
                    '../',
                    {
                        name: 'node:sqlite',
                        message: 'The qualification harness has no SQL: it talks to the store through @ivory/core'
                    }
                ]
            }
        }
    ]
};
