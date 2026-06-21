import React, { useRef, useState } from 'react';
import { Upload, X, Loader2, Plus, FileCheck2, Wand2 } from 'lucide-react';

const ACCEPT = 'image/*,.docx,.txt';
const MAX_FILE_SIZE = 5 * 1024 * 1024;

// Pick a saved "exam style" blueprint to shape generation, or build a new one from an
// uploaded past exam (photo / .docx / .txt). Presentational: the parent owns the list and
// performs the extract/delete API calls via callbacks.
export default function BlueprintPicker({ blueprints, selectedId, onSelect, onCreate, onDelete, creating, onError }) {
  const [adding, setAdding] = useState(false);
  const [file, setFile] = useState(null);
  const [name, setName] = useState('');
  const fileRef = useRef(null);

  const handleFile = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > MAX_FILE_SIZE) { onError?.('File must be under 5MB'); return; }
    const reader = new FileReader();
    reader.onload = () => setFile({ data: String(reader.result).split(',')[1], mimeType: f.type, name: f.name });
    reader.readAsDataURL(f);
  };

  const submit = async () => {
    if (!file) { onError?.('Upload a photo or file of the past exam'); return; }
    const ok = await onCreate({ file, name: name.trim() || file.name });
    if (ok) { setAdding(false); setFile(null); setName(''); }
  };

  return (
    <div>
      <label className="block text-[10px] font-mono font-bold uppercase tracking-widest text-claude-secondary mb-1">Exam style (optional)</label>
      <p className="text-claude-secondary/70 text-xs font-serif italic mb-3">Generate in the shape of a past paper.</p>

      <div className="flex flex-wrap gap-2">
        {blueprints.map((bp) => {
          const active = bp.id === selectedId;
          return (
            <span
              key={bp.id}
              className={`group inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-[11px] font-mono font-bold transition-all ${active ? 'bg-claude-accent/20 border-claude-accent text-claude-accent' : 'glass-panel border-claude-border text-claude-secondary'}`}
            >
              <button type="button" onClick={() => onSelect(active ? null : bp.id)} className="tap-action max-w-[10rem] truncate">
                {bp.name}
              </button>
              <button type="button" onClick={() => onDelete(bp.id)} className="text-claude-secondary/50 hover:text-red-400 tap-action" aria-label="Delete blueprint">
                <X className="w-3 h-3" />
              </button>
            </span>
          );
        })}

        {!adding && (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-dashed border-claude-border px-3 py-2 text-[11px] font-mono font-bold uppercase tracking-wider text-claude-secondary hover:border-claude-accent/40 hover:text-claude-accent transition-colors tap-action"
          >
            <Plus className="w-3.5 h-3.5" /> Past exam
          </button>
        )}
      </div>

      {adding && (
        <div className="mt-3 space-y-3 glass-panel rounded-2xl border border-claude-border p-4">
          {file ? (
            <div className="flex items-center gap-3 p-3 bg-claude-bg/40 rounded-xl border border-claude-border">
              <FileCheck2 className="w-4 h-4 text-claude-accent shrink-0" />
              <span className="font-mono text-xs text-claude-text truncate flex-1">{file.name}</span>
              <button type="button" onClick={() => { setFile(null); if (fileRef.current) fileRef.current.value = ''; }} className="text-claude-secondary hover:text-red-400 tap-action"><X className="w-4 h-4" /></button>
            </div>
          ) : (
            <label className="block p-5 border-2 border-dashed border-claude-border rounded-xl text-center cursor-pointer hover:border-claude-accent/30 transition-colors">
              <Upload className="w-6 h-6 text-claude-secondary mx-auto mb-1.5" />
              <p className="text-[10px] font-mono uppercase tracking-widest text-claude-secondary">Photo of the exam, or .docx / .txt</p>
              <input ref={fileRef} type="file" accept={ACCEPT} onChange={handleFile} className="hidden" />
            </label>
          )}

          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Name (e.g. Calc Final 2025)"
            className="w-full glass-panel border border-claude-border rounded-xl p-3 font-mono text-sm text-claude-text focus:border-claude-accent outline-none"
            style={{ fontSize: '16px' }}
          />

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={submit}
              disabled={creating || !file}
              className="flex-1 claude-button-primary py-3 flex items-center justify-center gap-2 text-sm font-bold disabled:opacity-50"
            >
              {creating ? <><Loader2 className="w-4 h-4 animate-spin" /> Reading exam...</> : <><Wand2 className="w-4 h-4" /> Analyze</>}
            </button>
            <button type="button" onClick={() => { setAdding(false); setFile(null); setName(''); }} className="px-4 py-3 text-claude-secondary font-mono text-[10px] uppercase tracking-widest font-bold tap-action">
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
