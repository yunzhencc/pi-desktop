import antfu from '@antfu/eslint-config';

export default antfu({
  stylistic: {
    semi: true,
    indent: 2,
    quotes: 'single',
  },
  rules: {
    'react-refresh/only-export-components': [
      'warn',
      { allowConstantExport: true },
    ],
  },
  react: true,
  typescript: true,
  ignores: [],
});
