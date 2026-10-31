// Validate the actual published npm tarball, then build an isolated consumer.
import { mkdtempSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
const root = process.cwd();
const temp = mkdtempSync(join(tmpdir(), 'duet-consumer-'));
const run = (cmd, args, cwd = temp) => execFileSync(cmd, args, { cwd, stdio: 'inherit' });
try {
  run('pnpm', ['--filter', 'duet-ui', 'pack', '--pack-destination', temp], root);
  const version = JSON.parse(readFileSync(join(root, 'packages/duet-ui/package.json'), 'utf8')).version;
  const tarball = join(temp, `duet-ui-${version}.tgz`);
  run('tar', ['xf', tarball]);
  const pkg = JSON.parse(readFileSync(join(temp, 'package/package.json'), 'utf8'));
  for (const value of Object.values(pkg.exports)) {
    for (const target of typeof value === 'string' ? [value] : Object.values(value)) assert.ok(existsSync(join(temp, 'package', target)), `Missing export ${target}`);
  }
  // No shadcn registry or CLI exists in this repository; test npm distribution instead.
  writeFileSync(join(temp, 'package.json'), JSON.stringify({ private: true, packageManager: 'pnpm@10.32.0', type: 'module', scripts: { build: 'vite build' }, dependencies: { 'duet-ui': `file:${tarball}`, react: '19.3.0', 'react-dom': '19.3.0', vite: '7.3.7', typescript: '^5.9.0', '@types/react': '^19.3.0', '@types/react-dom': '^19.3.0' } }));
  writeFileSync(join(temp, 'index.html'), '<html lang="en"><title>Consumer</title><div id="root"></div><script type="module" src="/main.tsx"></script></html>');
  writeFileSync(join(temp, 'main.tsx'), `import React from 'react'; import {createRoot} from 'react-dom/client'; import {Duet, DuetPanes, DuetPaneBar, column} from 'duet-ui'; import {detect} from 'duet-ui/geometry'; import {bootScript} from 'duet-ui/boot'; import 'duet-ui/styles.css'; console.log(detect, bootScript); createRoot(document.getElementById('root')!).render(<Duet menu={{items:[{id:'home',label:'Home'}],onSelect(){}}}><main style={column()}><DuetPanes path={['a']} at="a" panes={{a:<DuetPaneBar more={[]}/>}}/></main></Duet>);`);
  writeFileSync(join(temp, 'tsconfig.json'), JSON.stringify({ compilerOptions: { target: 'ES2022', module: 'ESNext', moduleResolution: 'Bundler', jsx: 'react-jsx', strict: true, skipLibCheck: true, noEmit: true }, include: ['main.tsx'] }));
  run('pnpm', ['install', '--ignore-scripts']);
  run('pnpm', ['exec', 'tsc']);
  run('pnpm', ['build']);
  console.log('PASS: tarball exports, fresh app typecheck and production build');
} finally { rmSync(temp, { recursive: true, force: true }); }
