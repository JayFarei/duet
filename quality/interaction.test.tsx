import React from 'react';
import { afterEach, expect, test, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
vi.mock('../packages/duet-ui/src/glassyui/glass-provider.tsx', () => ({ GlassProvider: ({ children }: any) => children }));
import { Duet, useDuet } from '../packages/duet-ui/src/chrome';
import { DuetPaneBar } from '../packages/duet-ui/src/duet-panes';
afterEach(cleanup);
// Match browser APIs used by the signal watcher, not the interaction under test.
Object.defineProperty(window, 'matchMedia', { value: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }) });
globalThis.ResizeObserver = class { observe() {} disconnect() {} } as any;
window.scrollTo = () => {};
Object.defineProperty(window, "visualViewport", { value: undefined });
test('selected navigation item still invokes onSelect', async () => {
  const select = vi.fn();
  render(<Duet menu={{ items: [{ id: 'home', label: 'Home' }], selected: 'home', onSelect: select }} />);
  await userEvent.click(screen.getByRole('button', { name: 'Menu' }));
  await userEvent.click(screen.getByRole('button', { name: 'Home' }));
  expect(select).toHaveBeenCalledWith('home');
});
test('sidebar opens with focus and Escape returns focus to trigger', async () => {
  render(<Duet menu={{ items: [{ id: 'home', label: 'Home' }], onSelect() {} }} />);
  const trigger = screen.getByRole('button', { name: 'Menu' });
  await userEvent.click(trigger);
  expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Home' }));
  await userEvent.keyboard('{Escape}');
  expect(trigger.getAttribute('aria-expanded')).toBe('false');
  expect(document.activeElement).toBe(trigger);
});
test('pane action menu supports ArrowDown and Escape', async () => {
  render(<DuetPaneBar more={[{ id: 'save', label: 'Save', icon: null }, { id: 'delete', label: 'Delete', icon: null }]} />);
  const trigger = screen.getByRole('button', { name: 'More' });
  await userEvent.click(trigger);
  expect(document.activeElement).toBe(screen.getByRole('menuitem', { name: 'Save' }));
  await userEvent.keyboard('{ArrowDown}');
  expect(document.activeElement).toBe(screen.getByRole('menuitem', { name: 'Delete' }));
  await userEvent.keyboard('{Escape}');
  expect(screen.queryByRole('menu')).toBeNull();
  expect(document.activeElement).toBe(trigger);
});
test('overflow action menu supports keyboard dismissal and focus return', async () => {
  render(<Duet actions={[{ id: 'delete', label: 'Delete', icon: null, destructive: true }]} />);
  const trigger = screen.getByRole('button', { name: 'More' });
  await userEvent.click(trigger);
  expect(document.activeElement).toBe(screen.getAllByRole('menuitem')[0]);
  await userEvent.keyboard('{End}');
  expect(document.activeElement).toBe(screen.getByRole('menuitem', { name: 'Delete' }));
  await userEvent.keyboard('{Escape}');
  expect(document.activeElement).toBe(trigger);
});
