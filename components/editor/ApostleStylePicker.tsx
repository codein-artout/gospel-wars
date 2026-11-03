'use client';

import { SegmentedControl } from '../ui/SegmentedControl';

export const APOSTLE_STYLE_OPTIONS = ['Zealot', 'Gentle', 'Scholar', 'Mystic', 'Troll'] as const;
export type ApostleStyleName = (typeof APOSTLE_STYLE_OPTIONS)[number];

export function ApostleStylePicker({ value, onChange, disabled }: { value: ApostleStyleName; onChange: (v: ApostleStyleName) => void; disabled?: boolean }) {
  return (
    <fieldset className="m-0 border-0 p-0" disabled={disabled}>
      <legend className="mb-1.5 p-0 text-[14px] text-muted">Apostle style</legend>
      <SegmentedControl
        label="Apostle style"
        value={value}
        onChange={onChange}
        options={APOSTLE_STYLE_OPTIONS.map((s) => ({ value: s, label: s, disabled }))}
      />
    </fieldset>
  );
}
