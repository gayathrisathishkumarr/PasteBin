import { Braces, Check, Expand, FileUp, LoaderCircle, Minimize, Save, Sparkles } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { Paste, PasteInput, Visibility } from '../types';
import { acceptedTextFiles, isSupportedTextFile, languageForFile } from '../fileTypes';

const templates: Record<string, { language: string; content: string }> = {
  JavaScript: { language: 'JavaScript', content: 'function main() {\n  console.log("Hello, PasteBin!");\n}\n\nmain();' },
  TypeScript: { language: 'TypeScript', content: 'type Result<T> = { data: T; ok: true };\n\nconst result: Result<string> = { data: "Hello", ok: true };' },
  React: { language: 'React', content: 'export function Welcome({ name }: { name: string }) {\n  return <h1>Hello, {name}!</h1>;\n}' },
  Python: { language: 'Python', content: 'def main() -> None:\n    print("Hello, PasteBin!")\n\nif __name__ == "__main__":\n    main()' },
  SQL: { language: 'SQL', content: 'SELECT language, COUNT(*) AS total\nFROM pastes\nGROUP BY language\nORDER BY total DESC;' },
  JSON: { language: 'JSON', content: '{\n  "name": "PasteBin",\n  "version": 2\n}' },
  YAML: { language: 'YAML', content: 'service:\n  name: pastebin\n  healthy: true' },
  Markdown: { language: 'Markdown', content: '# Notes\n\nA concise developer note with `inline code`.' },
  Bash: { language: 'Bash', content: '#!/usr/bin/env bash\nset -euo pipefail\n\necho "Ready"' },
  Dockerfile: { language: 'Dockerfile', content: 'FROM node:20-alpine\nWORKDIR /app\nCOPY . .\nRUN npm ci\nCMD ["npm", "start"]' },
  Environment: { language: 'Environment Variables', content: 'PORT=3001\nNODE_ENV=production' },
};
const languages = ['Plain Text', 'JavaScript', 'TypeScript', 'React', 'Java', 'Python', 'SQL', 'JSON', 'YAML', 'Markdown', 'Bash', 'Dockerfile', 'Environment Variables'];
const draftKey = 'pastebin:draft';
const legacyDraftKey = 'pasteforge:draft';
const empty: PasteInput = { title: '', description: '', content: '', language: 'Plain Text', visibility: 'public', tags: [], expiresAt: null };

export default function NewPasteForm({ saving, error, initial, autosave = true, tabSize = 2, defaults: preferred, onSubmit, onCancel }: {
  saving: boolean; error: string; initial?: Paste | null; autosave?: boolean; tabSize?: number;
  defaults?: Pick<PasteInput, 'language' | 'visibility'>;
  onSubmit: (data: PasteInput) => Promise<void>; onCancel?: () => void;
}) {
  const [data, setData] = useState<PasteInput>(() => initial ? { ...initial, expiresAt: initial.expires_at } : { ...empty, ...preferred });
  const [tag, setTag] = useState('');
  const [fileError, setFileError] = useState('');
  const [fullscreen, setFullscreen] = useState(false);
  const [mode, setMode] = useState<'write' | 'preview' | 'raw'>('write');
  const [draftRecovered, setDraftRecovered] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const textarea = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (initial) setData({ ...initial, expiresAt: initial.expires_at });
    else if (autosave) {
      const saved = localStorage.getItem(draftKey) || localStorage.getItem(legacyDraftKey);
      if (saved) try { setData(JSON.parse(saved)); setDraftRecovered(true); } catch { localStorage.removeItem(draftKey); localStorage.removeItem(legacyDraftKey); }
    }
  }, [initial, autosave]);
  useEffect(() => {
    if (!initial && autosave && (data.title || data.content)) localStorage.setItem(draftKey, JSON.stringify(data));
  }, [data, initial, autosave]);
  useEffect(() => {
    const save = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') { event.preventDefault(); document.getElementById('paste-form')?.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true })); }
    };
    window.addEventListener('keydown', save); return () => window.removeEventListener('keydown', save);
  }, []);

  const set = <K extends keyof PasteInput>(key: K, value: PasteInput[K]) => setData((current) => ({ ...current, [key]: value }));
  async function loadFile(file?: File) {
    if (!file) return;
    if (!isSupportedTextFile(file)) return setFileError('That file type is not supported. Choose a text or source-code file.');
    if (file.size > 100_000) return setFileError('Choose a text file smaller than 100 KB.');
    try {
      const content = await file.text();
      setData((current) => ({ ...current, title: file.name.replace(/\.[^.]+$/, ''), content, language: languageForFile(file) }));
      setFileError('');
    } catch { setFileError('This file could not be read as text.'); }
  }
  function addTag() {
    const value = tag.trim().toLowerCase();
    if (value && !data.tags.includes(value) && data.tags.length < 10) set('tags', [...data.tags, value]);
    setTag('');
  }
  const lines = data.content ? data.content.split('\n').length : 0;
  const size = new Blob([data.content]).size;

  return <section className={`${fullscreen ? 'fixed inset-0 z-50 overflow-y-auto bg-dark-950 p-4 sm:p-8' : 'mx-auto max-w-6xl'}`}>
    <div className="mb-5 flex items-start justify-between gap-4"><div><p className="text-sm font-semibold text-violet-400">{initial ? `Editing v${initial.version}` : 'New Paste Studio'}</p><h1 className="mt-1 text-2xl font-bold sm:text-3xl">{initial ? 'Refine your snippet' : 'Build something worth sharing'}</h1><p className="mt-2 text-sm text-gray-400">Drafts save locally. Press <kbd className="kbd">⌘/Ctrl S</kbd> to publish.</p></div><button type="button" onClick={() => setFullscreen(!fullscreen)} className="icon-button" aria-label={fullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}>{fullscreen ? <Minimize className="h-5 w-5" /> : <Expand className="h-5 w-5" />}</button></div>
    {draftRecovered && !initial && <div role="status" className="mb-4 flex items-center gap-2 rounded-xl border border-cyan-500/20 bg-cyan-500/10 px-4 py-3 text-sm text-cyan-200"><Check className="h-4 w-4" />Unsaved draft recovered from this browser.<button onClick={() => { setData(empty); localStorage.removeItem(draftKey); setDraftRecovered(false); }} className="ml-auto underline">Discard</button></div>}
    <form id="paste-form" className="grid gap-5 xl:grid-cols-[1fr_280px]" onSubmit={(event) => { event.preventDefault(); void onSubmit(data).then(() => { if (!initial) localStorage.removeItem(draftKey); }); }}>
      <div className="glass-card overflow-hidden">
        {error && <div role="alert" className="error-banner m-4">{error}</div>}
        <div className="grid gap-4 border-b border-white/[0.06] p-4 sm:grid-cols-2 sm:p-5">
          <div><label htmlFor="paste-title" className="field-label">Title</label><input id="paste-title" required maxLength={120} autoFocus className="field" value={data.title} onChange={(e) => set('title', e.target.value)} placeholder="What does this snippet do?" /></div>
          <div><label htmlFor="paste-description" className="field-label">Description</label><input id="paste-description" maxLength={500} className="field" value={data.description} onChange={(e) => set('description', e.target.value)} placeholder="Optional context for readers" /></div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/[0.06] bg-white/[0.015] px-4 py-2">
          <div className="flex gap-1">{(['write', 'preview', 'raw'] as const).map((item) => <button type="button" key={item} onClick={() => setMode(item)} className={`rounded-lg px-3 py-1.5 text-xs font-semibold capitalize ${mode === item ? 'bg-violet-500/20 text-violet-300' : 'text-gray-500 hover:text-white'}`}>{item}</button>)}</div>
          <button type="button" onClick={() => fileInput.current?.click()} className="focus-ring flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs font-semibold text-violet-400"><FileUp className="h-4 w-4" />Upload</button>
          <input ref={fileInput} className="sr-only" type="file" accept={acceptedTextFiles} onChange={(e) => void loadFile(e.target.files?.[0])} />
        </div>
        {fileError && <p role="alert" className="px-5 pt-3 text-sm text-red-300">{fileError}</p>}
        <div onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add('bg-violet-500/5'); }} onDragLeave={(e) => e.currentTarget.classList.remove('bg-violet-500/5')} onDrop={(e) => { e.preventDefault(); e.currentTarget.classList.remove('bg-violet-500/5'); void loadFile(e.dataTransfer.files[0]); }} className="relative min-h-[430px]">
          {mode === 'write' ? <div className="flex min-h-[430px] bg-dark-900/60"><pre aria-hidden="true" className="select-none border-r border-white/[0.05] px-3 py-4 text-right font-mono text-[13px] leading-6 text-gray-700">{Array.from({ length: Math.max(1, lines) }, (_, i) => i + 1).join('\n')}</pre><textarea ref={textarea} id="paste-content" required maxLength={100_000} spellCheck={false} value={data.content} onChange={(e) => set('content', e.target.value)} onKeyDown={(e) => { if (e.key === 'Tab') { e.preventDefault(); const start = e.currentTarget.selectionStart; const next = `${data.content.slice(0, start)}${' '.repeat(tabSize)}${data.content.slice(e.currentTarget.selectionEnd)}`; set('content', next); requestAnimationFrame(() => { if (textarea.current) textarea.current.selectionStart = textarea.current.selectionEnd = start + tabSize; }); } }} className="min-h-[430px] flex-1 resize-none bg-transparent p-4 font-mono text-[13px] leading-6 text-gray-200 outline-none" placeholder="Drop a file or start typing…" /></div> : <pre className={`min-h-[430px] overflow-auto whitespace-pre-wrap break-words p-5 font-mono text-[13px] leading-6 ${mode === 'preview' ? 'code-preview' : 'text-gray-300'}`}><code>{data.content || 'Nothing to preview yet.'}</code></pre>}
        </div>
        <div className="flex flex-wrap items-center gap-3 border-t border-white/[0.06] px-4 py-3 text-xs text-gray-500"><span>{data.content.length.toLocaleString()} characters</span><span>{lines} lines</span><span>{size < 1024 ? `${size} B` : `${(size / 1024).toFixed(1)} KB`}</span><span className="ml-auto">Drop a text file anywhere in the editor</span></div>
      </div>
      <aside className="space-y-4">
        <div className="glass-card space-y-4 p-4">
          <div><label htmlFor="language" className="field-label">Language</label><select id="language" className="field" value={data.language} onChange={(e) => set('language', e.target.value)}>{languages.map((item) => <option key={item}>{item}</option>)}</select></div>
          <div><label htmlFor="visibility" className="field-label">Visibility</label><select id="visibility" className="field" value={data.visibility} onChange={(e) => set('visibility', e.target.value as Visibility)}><option value="public">Public · appears in Explore</option><option value="unlisted">Unlisted · direct URL only</option><option value="secret">Secret · burns after opening</option></select>{data.visibility === 'secret' && <p className="mt-2 text-xs leading-5 text-amber-300">Secret pastes are deleted atomically after their first successful retrieval.</p>}</div>
          <div><label htmlFor="expiration" className="field-label">Expiration</label><select id="expiration" className="field" value={data.expiresAt ? String(Math.round((new Date(data.expiresAt).getTime() - Date.now()) / 60000)) : 'never'} onChange={(e) => set('expiresAt', e.target.value === 'never' ? null : new Date(Date.now() + Number(e.target.value) * 60_000).toISOString())}><option value="never">Never</option><option value="10">10 minutes</option><option value="60">1 hour</option><option value="1440">1 day</option><option value="10080">7 days</option><option value="43200">30 days</option></select></div>
          <div><label htmlFor="tags" className="field-label">Tags</label><div className="flex gap-2"><input id="tags" maxLength={30} className="field" value={tag} onChange={(e) => setTag(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addTag(); } }} placeholder="Add tag" /><button type="button" onClick={addTag} className="btn-secondary !px-3">Add</button></div><div className="mt-2 flex flex-wrap gap-1">{data.tags.map((item) => <button type="button" key={item} onClick={() => set('tags', data.tags.filter((value) => value !== item))} className="badge bg-violet-500/10 text-violet-300">#{item} ×</button>)}</div></div>
        </div>
        {!initial && <div className="glass-card p-4"><p className="mb-3 flex items-center gap-2 text-sm font-semibold"><Sparkles className="h-4 w-4 text-violet-400" />Starter templates</p><div className="grid grid-cols-2 gap-2">{Object.entries(templates).map(([name, template]) => <button type="button" key={name} onClick={() => setData((current) => ({ ...current, language: template.language, content: template.content, title: current.title || `${name} starter` }))} className="focus-ring rounded-lg border border-white/[0.05] bg-white/[0.025] px-2 py-2 text-left text-xs text-gray-400 hover:border-violet-500/30 hover:text-white">{name}</button>)}</div></div>}
        <div className="flex gap-2">{onCancel && <button type="button" onClick={onCancel} className="btn-secondary flex-1">Cancel</button>}<button disabled={saving || !data.title.trim() || !data.content} className="btn-primary focus-ring flex flex-1 items-center justify-center gap-2 disabled:cursor-not-allowed disabled:opacity-50">{saving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : initial ? <Save className="h-4 w-4" /> : <Braces className="h-4 w-4" />}{saving ? 'Saving…' : initial ? 'Save version' : 'Create paste'}</button></div>
      </aside>
    </form>
  </section>;
}
