import { useCallback } from 'react';
import { msgIn, type MsgKey, type MsgParams } from '../services/messages';
import { useTranslation } from './useTranslation';

/** Pesan terjemahan yang ikut berubah saat bahasa aplikasi diganti. */
export function useMsg(): (key: MsgKey, params?: MsgParams) => string {
  const { language } = useTranslation();
  return useCallback((key, params) => msgIn(language, key, params), [language]);
}
