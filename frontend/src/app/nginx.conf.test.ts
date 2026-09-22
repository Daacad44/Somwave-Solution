import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';

const nginxConf = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '../../nginx.conf'),
  'utf8',
);

describe('dashboard nginx', () => {
  it('proxies /api/ to the production API so login cookies stay first-party', () => {
    expect(nginxConf).toContain('location /api/');
    expect(nginxConf).toContain('proxy_pass https://api.somwave.botandev.com/api/');
    expect(nginxConf).toContain('try_files $uri $uri/ /index.html');
  });
});
