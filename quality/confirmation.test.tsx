import React from 'react';
import { expect, test, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
vi.mock('../packages/duet-ui/src/glassyui/glass-provider.tsx', () => ({ GlassProvider: ({ children }: any) => children }));
vi.mock('../packages/duet-ui/src/signals.ts', () => ({
  emulatedSignals: () => null, epoch: () => 0, settling: () => false,
  watchSignals: () => () => {},
  readSignals: () => ({ innerWidth: 594, innerHeight: 368, outerWidth: 678, outerHeight: 466, visualHeight: 368, insetTop: 0, insetBottom: 0, insetLeft: 0, insetRight: 0, screenWidth: 678, screenHeight: 466, standalone: false, angle: 90 }),
}));
import { Duet } from '../packages/duet-ui/src/chrome';
Object.defineProperty(window, 'matchMedia', { value: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }) });
globalThis.ResizeObserver = class { observe() {} disconnect() {} } as any;
window.scrollTo = () => {};
test('folded primary stays focused when armed, so Enter confirms instead of closing its menu', async () => {
  const save = vi.fn();
  render(<Duet actions={[{ id: "delete", label: "Delete", icon: null, destructive: true }]} primary={{ id: 'new', label: 'New', icon: null, confirm: 'Confirm new', onPress: save }} />);
  await userEvent.click(screen.getByRole('button', { name: 'More' }));
  await userEvent.click(screen.getByRole('menuitem', { name: 'New' }));
  expect(save).not.toHaveBeenCalled();
  expect(document.activeElement).toBe(screen.getByRole('menuitem', { name: 'Confirm new' }));
  await userEvent.keyboard('{Enter}');
  expect(save).toHaveBeenCalledOnce();
});
