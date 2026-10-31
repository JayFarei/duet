// @vitest-environment node
import React from 'react';
import { expect, test } from 'vitest';
import { renderToString } from 'react-dom/server';
import { Duet } from '../packages/duet-ui/src/chrome';
import { DuetPanes, DuetPaneBar } from '../packages/duet-ui/src/duet-panes';
test('public components render without browser globals or premature client guards', () => {
  const html = renderToString(<Duet menu={{ items: [{ id: 'home', label: 'Home' }], onSelect() {} }}><DuetPanes path={['a']} at="a" panes={{ a: <DuetPaneBar more={[{ id: 'save', label: 'Save', icon: null }]} /> }} /></Duet>);
  expect(html).toContain('Home');
  expect(html).toContain('duet-pane');
  expect(html).not.toContain('duet-guard');
});
