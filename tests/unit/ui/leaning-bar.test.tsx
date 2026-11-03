// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { LeaningBar } from '@/components/meters/LeaningBar';

afterEach(cleanup);

describe('LeaningBar', () => {
  it('draws the dashed gold threshold marker at the conversion threshold', () => {
    render(<LeaningBar name="Final Spreadsheet" color="#2F5FD8" value={40} threshold={60} />);
    const marker = screen.getByTestId('leaning-threshold');
    expect(marker.style.left).toBe('60%');
    expect(marker.className).toContain('border-dashed');
    expect(marker.className).toContain('border-gold');
    expect(marker.getAttribute('aria-hidden')).toBe('true');
  });

  it('fills to the leaning value and exposes it as a meter', () => {
    render(<LeaningBar name="Patient Kettle" color="#EDA53A" value={66} threshold={60} />);
    expect(screen.getByTestId('leaning-fill').style.width).toBe('66%');
    const meter = screen.getByRole('meter', { name: 'Leaning toward Patient Kettle' });
    expect(meter.getAttribute('aria-valuenow')).toBe('66');
    expect(screen.getByText('66')).toBeTruthy();
  });

  it('clamps values and thresholds into 0..100', () => {
    render(<LeaningBar name="X" color="#000" value={140} threshold={-5} />);
    expect(screen.getByTestId('leaning-fill').style.width).toBe('100%');
    expect(screen.getByTestId('leaning-threshold').style.left).toBe('0%');
  });

  it('follows a configured threshold', () => {
    render(<LeaningBar name="Y" color="#000" value={10} threshold={80} />);
    expect(screen.getByTestId('leaning-threshold').style.left).toBe('80%');
  });
});
