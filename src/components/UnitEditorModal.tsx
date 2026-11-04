import React, { useEffect, useMemo, useState } from 'react';
import { ApiUnit } from '../services/api';

const SYMBOL_OPTIONS = ['L', 'ml', 'kg', 'g', 'btl', 'can', 'pch', 'drm', 'bkt', 'pc', 'box', 'ctn', 'pkt', 'set', 'pair'];

const NAMED_SYMBOLS: Record<string, string> = {
  bottle: 'btl', can: 'can', pouch: 'pch', drum: 'drm', bucket: 'bkt', piece: 'pc', box: 'box',
  litre: 'L', liter: 'L', kilogram: 'kg', carton: 'ctn', millilitre: 'ml', milliliter: 'ml', gram: 'g',
  packet: 'pkt', set: 'set', pair: 'pair',
};

const suggestedSymbol = (name: string) => {
  const normalized = name.trim().toLowerCase();
  if (!normalized) return '';
  return NAMED_SYMBOLS[normalized] || normalized.replace(/[^a-z0-9]/g, '').slice(0, 5);
};

interface UnitEditorModalProps {
  units: ApiUnit[];
  unit?: ApiUnit;
  onSave: (payload: { id?: string; name: string; symbol: string | null; allowsDecimals: boolean }) => Promise<void>;
  onClose: () => void;
}

export const UnitEditorModal: React.FC<UnitEditorModalProps> = ({ units, unit, onSave, onClose }) => {
  const [name, setName] = useState(unit?.name ?? '');
  const [symbol, setSymbol] = useState(unit?.symbol ?? '');
  const [symbolTouched, setSymbolTouched] = useState(Boolean(unit?.symbol));
  const [allowsDecimals, setAllowsDecimals] = useState(unit?.allowsDecimals ?? false);
  const [decimalsTouched, setDecimalsTouched] = useState(Boolean(unit));
  const [symbolMenuOpen, setSymbolMenuOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [nameError, setNameError] = useState('');
  const [symbolError, setSymbolError] = useState('');
  const [formError, setFormError] = useState('');

  useEffect(() => {
    if (!symbolTouched) setSymbol(suggestedSymbol(name));
  }, [name, symbolTouched]);

  useEffect(() => {
    if (!decimalsTouched) setAllowsDecimals(['litre', 'liter', 'kilogram'].includes(name.trim().toLowerCase()));
  }, [name, decimalsTouched]);

  const inUseUnit = useMemo(() => {
    const normalizedSymbol = symbol.trim().toLowerCase();
    if (!normalizedSymbol) return undefined;
    return units.find((candidate) => candidate.id !== unit?.id && candidate.symbol?.trim().toLowerCase() === normalizedSymbol);
  }, [symbol, units, unit?.id]);

  const visibleSymbols = SYMBOL_OPTIONS.filter((option) => !symbol || option.toLowerCase().includes(symbol.trim().toLowerCase()));

  const save = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalizedName = name.trim();
    if (!normalizedName) {
      setNameError('Enter a unit name.');
      return;
    }
    if (units.some((candidate) => candidate.id !== unit?.id && candidate.name.trim().toLowerCase() === normalizedName.toLowerCase())) {
      setNameError('A unit with this name already exists.');
      return;
    }
    if (symbol.trim().length > 5) {
      setSymbolError('Symbols can be at most 5 characters.');
      return;
    }
    setSaving(true);
    setNameError('');
    setFormError('');
    try {
      await onSave({ id: unit?.id, name: normalizedName, symbol: symbol.trim() || null, allowsDecimals });
      onClose();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'The unit could not be saved.';
      if (/duplicate|already exists|unique/i.test(message)) setNameError('A unit with this name already exists.');
      else setFormError(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/40 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) onClose(); }}>
      <form role="dialog" aria-modal="true" aria-labelledby="unit-editor-title" onSubmit={save} className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
        <h2 id="unit-editor-title" className="text-lg font-semibold text-on-surface">{unit ? 'Edit unit' : 'Add unit'}</h2>
        <div className="mt-5 flex flex-col gap-4">
          <label className="flex flex-col gap-1.5 text-sm font-medium text-on-surface">Unit name
            <input autoFocus required maxLength={100} value={name} onChange={(event) => { setName(event.target.value); setNameError(''); }} className="h-10 rounded-md border border-outline-variant/40 px-3 outline-none focus:border-primary" placeholder="e.g. Litre" aria-invalid={Boolean(nameError)} />
            {nameError && <span role="alert" className="text-xs font-normal text-error">{nameError}</span>}
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-medium text-on-surface">Symbol <span className="font-normal text-on-surface-variant">Optional</span>
            <div className="relative">
              <input role="combobox" aria-expanded={symbolMenuOpen} aria-controls="unit-symbol-options" maxLength={5} value={symbol} onFocus={() => setSymbolMenuOpen(true)} onChange={(event) => { setSymbolTouched(true); setSymbol(event.target.value.slice(0, 5)); setSymbolError(''); setSymbolMenuOpen(true); }} onKeyDown={(event) => { if (event.key === 'Escape') setSymbolMenuOpen(false); if (event.key === 'ArrowDown') setSymbolMenuOpen(true); }} className="h-10 w-full rounded-md border border-outline-variant/40 px-3 outline-none focus:border-primary" placeholder="Choose or type (max 5)" />
              {symbolMenuOpen && <div id="unit-symbol-options" role="listbox" className="absolute left-0 right-0 top-full z-10 mt-1 max-h-48 overflow-y-auto rounded-md border border-outline-variant/40 bg-white p-1 shadow-lg">
                {visibleSymbols.map((option) => {
                  const usedBy = units.find((candidate) => candidate.id !== unit?.id && candidate.symbol?.trim().toLowerCase() === option.toLowerCase());
                  return <button key={option} type="button" role="option" aria-selected={symbol === option} onMouseDown={(event) => event.preventDefault()} onClick={() => { setSymbol(option); setSymbolTouched(true); setSymbolMenuOpen(false); }} className="flex w-full items-center justify-between gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-surface-container-low">
                    <span>{option}</span>{usedBy && <span className="text-xs text-amber-700">in use by {usedBy.name}</span>}
                  </button>;
                })}
                {!visibleSymbols.length && <p className="px-2 py-1.5 text-xs text-on-surface-variant">Type a custom symbol (up to 5 characters).</p>}
              </div>}
            </div>
            {symbolError && <span role="alert" className="text-xs font-normal text-error">{symbolError}</span>}
            {inUseUnit && <span className="text-xs font-normal text-amber-700">This symbol is in use by {inUseUnit.name}. You can still use it.</span>}
          </label>
          <label className="flex items-center gap-2 text-sm text-on-surface">
            <input type="checkbox" checked={allowsDecimals} onChange={(event) => { setDecimalsTouched(true); setAllowsDecimals(event.target.checked); }} className="h-4 w-4 accent-primary" />
            Allow decimal quantities (up to 3 decimal places)
          </label>
          {formError && <p role="alert" className="rounded-md bg-error-container/40 px-3 py-2 text-sm text-error">{formError}</p>}
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <button type="button" disabled={saving} onClick={onClose} className="h-9 rounded-md border border-outline-variant/40 px-4 text-sm text-on-surface">Cancel</button>
          <button type="submit" disabled={saving} className="h-9 rounded-md bg-primary px-4 text-sm font-semibold text-on-primary disabled:opacity-60">{saving ? 'Saving…' : unit ? 'Save unit' : 'Add unit'}</button>
        </div>
      </form>
    </div>
  );
};
