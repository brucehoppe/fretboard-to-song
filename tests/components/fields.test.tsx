import { render, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { Choice, NumberField, keyItems } from '@/components/app/fields';
import { NOTES } from '@/lib/music';
import { choose, optionsOf, selected, setup } from '../helpers/ui';

describe('Choice', () => {
  it('lists every option and reports each selection', async () => {
    const user = setup();
    const onChange = vi.fn();
    function Harness() { const [v, setV] = useState('4'); return <Choice label="Key" value={v} onChange={x => { setV(x); onChange(x); }} items={keyItems(NOTES)} />; }
    render(<Harness />);
    expect(await optionsOf(user, 'Key')).toEqual(NOTES.map(n => `${n} minor`));
    for (const [i, n] of NOTES.entries()) {
      await choose(user, 'Key', `${n} minor`);
      expect(selected('Key')).toBe(`${n} minor`);
      if (i !== 4) expect(onChange).toHaveBeenLastCalledWith(String(i));
    }
  });
  it('can hide its visible label but keeps the accessible name', () => {
    render(<Choice label="Hidden" hideLabel value="a" onChange={() => {}} items={[['a', 'A']]} />);
    expect(screen.getByRole('combobox', { name: 'Hidden' })).toBeInTheDocument();
    expect(screen.queryByText('Hidden')).toBeNull();
  });
});

describe('NumberField', () => {
  function Harness({ initial = 75, onCommit = vi.fn() }) {
    const [v, setV] = useState(initial);
    return <><NumberField aria-label="Tempo" min={30} max={240} value={v} onCommit={n => { setV(n); onCommit(n); }} /><button onClick={() => setV(v + 5)}>external</button><output>{v}</output></>;
  }
  it('lets you type multi-digit values without clamping mid-way (regression)', async () => {
    const user = setup(); const onCommit = vi.fn();
    render(<Harness onCommit={onCommit} />);
    const input = screen.getByLabelText('Tempo');
    await user.clear(input); await user.type(input, '1');
    expect(input).toHaveValue(1); // old input jumped to 30 here
    await user.type(input, '20{Enter}');
    expect(onCommit).toHaveBeenLastCalledWith(120);
  });
  it('commits on blur', async () => {
    const user = setup(); const onCommit = vi.fn();
    render(<Harness onCommit={onCommit} />);
    const input = screen.getByLabelText('Tempo');
    await user.clear(input); await user.type(input, '90'); await user.tab();
    expect(onCommit).toHaveBeenCalledWith(90);
  });
  it.each([['10', 30], ['999', 240], ['30', 30], ['240', 240], ['95.6', 96]])('clamps %s → %i', async (typed, expected) => {
    const user = setup(); const onCommit = vi.fn();
    render(<Harness onCommit={onCommit} />);
    const input = screen.getByLabelText('Tempo');
    await user.clear(input); await user.type(input, `${typed}{Enter}`);
    expect(input).toHaveValue(expected);
  });
  it('restores the previous value when left blank', async () => {
    const user = setup(); const onCommit = vi.fn();
    render(<Harness onCommit={onCommit} />);
    const input = screen.getByLabelText('Tempo');
    await user.clear(input); await user.tab();
    expect(input).toHaveValue(75);
    expect(onCommit).not.toHaveBeenCalled();
  });
  it('does not commit when the value is unchanged', async () => {
    const user = setup(); const onCommit = vi.fn();
    render(<Harness onCommit={onCommit} />);
    await user.type(screen.getByLabelText('Tempo'), '{Enter}');
    expect(onCommit).not.toHaveBeenCalled();
  });
  it('follows external value changes (e.g. the +5 button)', async () => {
    const user = setup();
    render(<Harness />);
    await user.click(screen.getByText('external'));
    expect(screen.getByLabelText('Tempo')).toHaveValue(80);
  });
});
