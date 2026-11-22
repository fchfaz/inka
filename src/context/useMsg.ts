import { useCallback } from 'react';
import { msgIn, type MsgKey, type MsgParams } from '../services/messages';
import { useTranslation } from './useTranslation';


export function useMsg(): (key: MsgKey, params?: MsgParams) => string {
  const { language } = useTranslation();
  return useCallback((key, params) => msgIn(language, key, params), [language]);
}
