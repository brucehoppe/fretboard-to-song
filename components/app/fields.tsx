'use client';
import { useState } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';

export function Choice({ label, value, onChange, items, hideLabel }: {
  label: string; value: string; onChange: (v: string) => void; items: [string, string][]; hideLabel?: boolean;
}) {
  return (
    <label className="choice">
      {!hideLabel && <span>{label}</span>}
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger aria-label={label}><SelectValue /></SelectTrigger>
        <SelectContent>{items.map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent>
      </Select>
    </label>
  );
}

/**
 * Number input that lets you type freely ("1" on the way to "120") and only
 * clamps when you leave the field or press Enter. The old input clamped on every
 * keystroke, which made typing most tempos impossible.
 */
export function NumberField({ value, onCommit, min, max, className, ...rest }: {
  value: number; onCommit: (v: number) => void; min: number; max: number; className?: string; 'aria-label'?: string;
}) {
  const [text, setText] = useState(String(value));
  const [synced, setSynced] = useState(value);
  if (synced !== value) { setSynced(value); setText(String(value)); } // external change (e.g. +5 button)
  const commit = () => {
    const n = Math.round(Number(text));
    const clamped = Number.isFinite(n) && text.trim() !== '' ? Math.max(min, Math.min(max, n)) : value;
    setText(String(clamped));
    if (clamped !== value) onCommit(clamped);
  };
  return (
    <Input {...rest} className={className} type="number" inputMode="numeric" min={min} max={max} value={text}
      onChange={e => setText(e.target.value)} onBlur={commit}
      onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); commit(); } }} />
  );
}

export const keyItems = (NOTES: string[]): [string, string][] => NOTES.map((n, i) => [String(i), `${n} minor`]);
