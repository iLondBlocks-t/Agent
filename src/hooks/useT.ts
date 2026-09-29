import { useStore } from '@/store/useStore';
import { t as translate, type StringKey } from '@/i18n/strings';

export function useT() {
  const lang = useStore((s) => s.settings.language);
  return { t: (k: StringKey) => translate(lang, k), lang, rtl: lang === 'ar' };
}
