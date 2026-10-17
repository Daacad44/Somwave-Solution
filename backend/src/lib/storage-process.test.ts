import { execFile } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { expect, it } from 'vitest';

const run = promisify(execFile);
it('keeps filesystem bytes across independent API processes', async () => {
  const path = await mkdtemp(join(tmpdir(), 'somwave-process-storage-'));
  const modulePath = fileURLToPath(new URL('./storage.ts', import.meta.url));
  const childEnv = { ...process.env, STORAGE_PROVIDER: 'filesystem', STORAGE_LOCAL_PATH: path };
  const execute = (source: string) =>
    run(process.execPath, ['--import', 'tsx', '--input-type=module', '-e', source], {
      env: childEnv,
    });
  try {
    const first = await execute(
      `import { putObject } from ${JSON.stringify(modulePath)}; const key = await putObject(Buffer.from('persistent-private-test'), 'application/pdf'); console.log('OBJECT_KEY=' + key);`,
    );
    const key = first.stdout.match(/OBJECT_KEY=(obj\/[0-9a-f-]{36})/)?.[1];
    expect(key).toBeTruthy();
    // First process has exited. A second process cannot read its memory map.
    const second = await execute(
      `import { readObject, deleteObject } from ${JSON.stringify(modulePath)}; const bytes = await readObject(${JSON.stringify(key)}); if (bytes?.toString() !== 'persistent-private-test') process.exit(2); await deleteObject(${JSON.stringify(key)}); console.log('PERSISTENCE_VERIFIED');`,
    );
    expect(second.stdout).toContain('PERSISTENCE_VERIFIED');
  } finally {
    await rm(path, { recursive: true, force: true });
  }
}, 15000);
