import '@testing-library/jest-dom/vitest';

Object.defineProperties(navigator, {
  language: { configurable: true, value: 'zh-CN' },
  languages: { configurable: true, value: ['zh-CN', 'zh'] },
});
