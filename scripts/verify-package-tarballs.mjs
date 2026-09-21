import { execFileSync } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const auditRoot = await mkdtemp(join(tmpdir(), 'framewave-pack-'));
const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const packages = ['@framewave/core', '@framewave/gpu', '@framewave/export', 'framewave'];
const requiredFiles = ['LICENSE', 'README.md', 'dist/index.d.ts', 'dist/index.js'];

try {
  const tarballs = [];

  for (const workspace of packages) {
    const output = run(npmCommand, [
      'pack',
      '--ignore-scripts',
      '--json',
      '--pack-destination',
      auditRoot,
      '-w',
      workspace,
    ]);
    const [manifest] = JSON.parse(output);
    if (!manifest) throw new Error(`npm pack did not describe ${workspace}.`);

    const fileNames = new Set(manifest.files.map((file) => file.path));
    const missing = requiredFiles.filter((file) => !fileNames.has(file));
    if (missing.length > 0) {
      throw new Error(`${workspace} tarball is missing: ${missing.join(', ')}.`);
    }

    tarballs.push(join(auditRoot, manifest.filename));
    console.log(`${manifest.id}: ${manifest.entryCount} files, ${manifest.size} packed bytes`);
  }

  await writeFile(
    join(auditRoot, 'package.json'),
    `${JSON.stringify({ private: true, type: 'module' }, null, 2)}\n`,
    'utf8',
  );
  await writeFile(
    join(auditRoot, 'smoke.mjs'),
    [
      "import { createRenderer, renderToVideo, spring } from 'framewave';",
      "const value = spring({ time: 0.5, from: 0, to: 1 });",
      "if (!Number.isFinite(value)) throw new Error('spring import did not execute.');",
      "if (typeof createRenderer !== 'function') throw new Error('createRenderer is not exported.');",
      "if (typeof renderToVideo !== 'function') throw new Error('renderToVideo is not exported.');",
      "console.log('Installed tarballs import successfully.');",
      '',
    ].join('\n'),
    'utf8',
  );

  run(npmCommand, ['install', '--ignore-scripts', '--no-audit', '--no-fund', ...tarballs], auditRoot);
  run(process.execPath, ['smoke.mjs'], auditRoot, 'inherit');
} finally {
  await rm(auditRoot, { recursive: true, force: true });
}

function run(command, args, cwd = repositoryRoot, stdio = 'pipe') {
  return execFileSync(command, args, {
    cwd,
    encoding: 'utf8',
    stdio,
  });
}
