// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const push = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));

import { RoseWindow, RoseWindowList, type RosePane } from '@/components/world/RoseWindow';

beforeAll();
function beforeAll() {
  // jsdom has no matchMedia.
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: () => ({ matches: false, addEventListener: () => undefined, removeEventListener: () => undefined }),
  });
}

afterEach(cleanup);

function agents(n = 48): RosePane[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `a${i}`,
    slug: `agent-${i}`,
    name: `Agent ${i}`,
    faithId: i % 2 ? 'f1' : null,
    faithName: i % 2 ? 'The Faith' : 'Unaligned',
    color: i % 2 ? '#2F5FD8' : '#5B5478',
    isBoss: i === 0,
  }));
}

describe('RoseWindow', () => {
  it('renders one labelled button per agent at the computed position', () => {
    render(<RoseWindow agents={agents()} shares={[{ color: '#2F5FD8', share: 1 }]} tick={142} selectedId="a1" />);
    const panes = screen.getAllByRole('button');
    expect(panes).toHaveLength(48);
    expect(screen.getByRole('button', { name: 'Agent 0, boss skeptic, unconverted' })).toBeTruthy();
    const first = screen.getByRole('button', { name: 'Agent 1, The Faith' });
    expect(first.style.left).toBe('62.02%');
    expect(first.style.transform).toContain('rotate(45deg)');
    expect(first.getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByText('142')).toBeTruthy();
  });

  it('keeps one pane in the tab order and moves with arrow keys', () => {
    const onSelect = vi.fn();
    render(<RoseWindow agents={agents()} shares={[]} tick={1} selectedId="a1" onSelect={onSelect} />);
    const tabbable = screen.getAllByRole('button').filter((b) => b.tabIndex === 0);
    expect(tabbable).toHaveLength(1);
    fireEvent.keyDown(tabbable[0]!, { key: 'ArrowRight' });
    expect(onSelect).toHaveBeenCalledWith('a2');
    fireEvent.keyDown(tabbable[0]!, { key: 'Enter' });
    expect(push).toHaveBeenCalledWith('/a/agent-1');
  });

  it('selects on click', () => {
    const onSelect = vi.fn();
    render(<RoseWindow agents={agents()} shares={[]} tick={1} onSelect={onSelect} />);
    fireEvent.click(screen.getByRole('button', { name: 'Agent 5, The Faith' }));
    expect(onSelect).toHaveBeenCalledWith('a5');
  });

  it('has a text alternative listing agents by faith', () => {
    render(<RoseWindowList agents={agents(6)} />);
    expect(screen.getByText(/The Faith: 3 agents/)).toBeTruthy();
    expect(screen.getByText(/Boss skeptics, unconverted: 1 agent/)).toBeTruthy();
  });
});
