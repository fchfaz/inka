import { useMsg } from '../context/useMsg';
import React, { useEffect, useMemo, useState } from 'react';
import { ImageOff, Music, VideoOff } from 'lucide-react';
import { parseRich, type RichNode } from '../services/richText';
import { getMediaUrl } from '../services/media';

function useMediaUrl(key: string): { url: string | null; failed: boolean } {
  const [state, setState] = useState<{ key: string; url: string | null; done: boolean }>({ key, url: null, done: false });
  useEffect(() => {
    let alive = true;
    void getMediaUrl(key).then((u) => alive && setState({ key, url: u, done: true }));
    return () => {
      alive = false;
    };
  }, [key]);
  const cur = state.key === key;
  return { url: cur ? state.url : null, failed: cur && state.done && !state.url };
}

const stop = (e: React.SyntheticEvent) => e.stopPropagation(); // jangan membalik kartu saat menyentuh pemutar

const MediaView: React.FC<{ kind: 'img' | 'sound' | 'video'; mediaKey: string }> = ({ kind, mediaKey }) => {
  const m = useMsg();
  const { url, failed } = useMediaUrl(mediaKey);
  if (failed) {
    const Icon = kind === 'img' ? ImageOff : kind === 'video' ? VideoOff : Music;
    return (
      <span className="inline-flex items-center gap-1 text-xs text-slate-400" title={m('media.missingTitle')}>
        <Icon className="w-4 h-4" /> {m('media.missing')}
      </span>
    );
  }
  if (!url) return <span className="inline-block w-8 h-8 align-middle rounded bg-slate-100 dark:bg-slate-800 animate-pulse" aria-hidden />;
  if (kind === 'img') {
    return <img src={url} alt="" loading="lazy" className="max-h-44 max-w-full rounded-lg inline-block align-middle object-contain" draggable={false} />;
  }
  if (kind === 'video') {
    return (
      <video src={url} controls playsInline preload="metadata" onClick={stop} className="max-h-48 max-w-full rounded-lg block mx-auto" />
    );
  }
  return <audio src={url} controls preload="none" onClick={stop} className="h-8 max-w-full inline-block align-middle" />;
};

function renderNodes(nodes: RichNode[], prefix = ''): React.ReactNode[] {
  return nodes.map((n, i) => {
    const k = `${prefix}${i}`;
    switch (n.t) {
      case 'text':
        return <React.Fragment key={k}>{n.v}</React.Fragment>;
      case 'br':
        return <br key={k} />;
      case 'media':
        return <MediaView key={k} kind={n.kind} mediaKey={n.key} />;
      case 'el': {
        const Tag = n.tag;
        return <Tag key={k}>{renderNodes(n.c, k + '.')}</Tag>;
      }
    }
  });
}

/** Render isi kartu (teks + sedikit HTML aman + media) tanpa innerHTML. */
export const RichText: React.FC<{ text: string | undefined; className?: string }> = ({ text, className }) => {
  const nodes = useMemo(() => parseRich(text ?? ''), [text]);
  if (!text) return null;
  return (
    <span className={`notranslate ${className ?? ''}`} translate="no">
      {renderNodes(nodes)}
    </span>
  );
};
