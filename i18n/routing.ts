import {defineRouting} from 'next-intl/routing';

export const routing = defineRouting({
  locales: ['ko', 'en', 'zh'],
  defaultLocale: 'ko',
  localePrefix: 'always', // /ko, /en, /zh
});
