// Compact QR encoder for otpauth URLs. Byte mode, ECC level M. No third-party
// service — the TOTP secret never leaves the browser after /auth/2fa/setup.

const ECC_M = [
  [10, 7, 17, 13, 9, 16, 17, 7, 13, 11],
  [0, 1, 1, 1, 1, 1, 2, 2, 2, 2],
];

const ALIGN = [
  [],
  [],
  [6, 18],
  [6, 22],
  [6, 26],
  [6, 30],
  [6, 34],
  [6, 22, 38],
  [6, 24, 42],
  [6, 26, 46],
];

const GF_EXP = new Uint8Array(512);
const GF_LOG = new Uint8Array(256);

function initGf(): void {
  let x = 1;
  for (let i = 0; i < 255; i += 1) {
    GF_EXP[i] = x;
    GF_LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d;
  }
  for (let i = 255; i < 512; i += 1) {
    GF_EXP[i] = GF_EXP[i - 255] ?? 0;
  }
}
initGf();

function gfMul(a: number, b: number): number {
  if (a === 0 || b === 0) return 0;
  return GF_EXP[(GF_LOG[a] ?? 0) + (GF_LOG[b] ?? 0)] ?? 0;
}

function polyMul(p: number[], q: number[]): number[] {
  const out = new Array<number>(p.length + q.length - 1).fill(0);
  for (let i = 0; i < p.length; i += 1) {
    for (let j = 0; j < q.length; j += 1) {
      const current = out[i + j] ?? 0;
      out[i + j] = current ^ gfMul(p[i] ?? 0, q[j] ?? 0);
    }
  }
  return out;
}

function rsGenerator(degree: number): number[] {
  let g = [1];
  for (let i = 0; i < degree; i += 1) g = polyMul(g, [1, GF_EXP[i] ?? 0]);
  return g;
}

function rsEncode(data: number[], degree: number): number[] {
  const gen = rsGenerator(degree);
  const out = data.concat(new Array<number>(degree).fill(0));
  for (let i = 0; i < data.length; i += 1) {
    const coef = out[i] ?? 0;
    if (coef === 0) continue;
    for (let j = 0; j < gen.length; j += 1) {
      out[i + j] = (out[i + j] ?? 0) ^ gfMul(gen[j] ?? 0, coef);
    }
  }
  return out.slice(data.length);
}

function bitCapacity(version: number): number {
  const size = version * 4 + 17;
  let total = size * size;
  total -= 3 * 8 * 8;
  total -= 2 * 15;
  total -= 1;
  total -= size * 2 - 16;
  const aligns = ALIGN[version] ?? [];
  if (aligns.length > 0) {
    const count = aligns.length * aligns.length - 3;
    total -= count * 25;
  }
  if (version >= 7) total -= 2 * 18;
  return total;
}

function chooseVersion(payloadBits: number): number {
  for (let version = 2; version <= 9; version += 1) {
    const ecc = ECC_M[0]?.[version] ?? 16;
    const blocks = ECC_M[1]?.[version] ?? 1;
    const dataBits = bitCapacity(version) - ecc * blocks * 8;
    if (payloadBits + 16 <= dataBits) return version;
  }
  return 9;
}

function placeFinder(grid: number[][], x: number, y: number): void {
  for (let dy = -1; dy <= 7; dy += 1) {
    for (let dx = -1; dx <= 7; dx += 1) {
      const xx = x + dx;
      const yy = y + dy;
      if (yy < 0 || xx < 0 || yy >= grid.length || xx >= (grid[0]?.length ?? 0)) continue;
      const dark =
        dx === -1 ||
        dy === -1 ||
        dx === 7 ||
        dy === 7 ||
        (dx >= 0 && dx <= 6 && dy >= 0 && dy <= 6 && (dx === 0 || dx === 6 || dy === 0 || dy === 6)) ||
        (dx >= 2 && dx <= 4 && dy >= 2 && dy <= 4);
      const row = grid[yy];
      if (row) row[xx] = dark ? 1 : 0;
    }
  }
}

function reserved(size: number, version: number): boolean[][] {
  const mark = Array.from({ length: size }, () => Array<boolean>(size).fill(false));
  const set = (x: number, y: number): void => {
    if (y >= 0 && x >= 0 && y < size && x < size) {
      const row = mark[y];
      if (row) row[x] = true;
    }
  };
  for (let y = 0; y < 9; y += 1) {
    for (let x = 0; x < 9; x += 1) set(x, y);
  }
  for (let y = 0; y < 9; y += 1) {
    for (let x = size - 8; x < size; x += 1) set(x, y);
  }
  for (let y = size - 8; y < size; y += 1) {
    for (let x = 0; x < 9; x += 1) set(x, y);
  }
  for (let i = 0; i < size; i += 1) {
    set(6, i);
    set(i, 6);
  }
  const aligns = ALIGN[version] ?? [];
  for (const ay of aligns) {
    for (const ax of aligns) {
      if ((ax === 6 && ay === 6) || (ax === 6 && ay === size - 7) || (ax === size - 7 && ay === 6)) {
        continue;
      }
      for (let dy = -2; dy <= 2; dy += 1) {
        for (let dx = -2; dx <= 2; dx += 1) set(ax + dx, ay + dy);
      }
    }
  }
  if (version >= 7) {
    for (let i = 0; i < 6; i += 1) {
      for (let j = 0; j < 3; j += 1) {
        set(size - 11 + j, i);
        set(i, size - 11 + j);
      }
    }
  }
  return mark;
}

function maskBit(x: number, y: number): boolean {
  return (x + y) % 2 === 0;
}

export function qrSvg(text: string, moduleSize = 4): string {
  const bytes = Array.from(new TextEncoder().encode(text));
  const payloadBits = 4 + 8 + bytes.length * 8;
  const version = chooseVersion(payloadBits);
  const size = version * 4 + 17;
  const eccLen = ECC_M[0]?.[version] ?? 16;
  const dataCap = Math.floor(bitCapacity(version) / 8) - eccLen;

  const bits: number[] = [];
  const push = (value: number, len: number): void => {
    for (let i = len - 1; i >= 0; i -= 1) bits.push((value >> i) & 1);
  };
  push(0b0100, 4);
  push(bytes.length, 8);
  for (const byte of bytes) push(byte, 8);
  push(0, Math.min(4, dataCap * 8 - bits.length));
  while (bits.length % 8 !== 0) bits.push(0);
  const data: number[] = [];
  for (let i = 0; i < bits.length; i += 8) {
    let v = 0;
    for (let j = 0; j < 8; j += 1) v = (v << 1) | (bits[i + j] ?? 0);
    data.push(v);
  }
  const pads = [0xec, 0x11];
  let pad = 0;
  while (data.length < dataCap) {
    data.push(pads[pad % 2] ?? 0xec);
    pad += 1;
  }
  const ecc = rsEncode(data, eccLen);
  const codewords = data.concat(ecc);

  const grid = Array.from({ length: size }, () => Array<number>(size).fill(0));
  placeFinder(grid, 0, 0);
  placeFinder(grid, size - 7, 0);
  placeFinder(grid, 0, size - 7);
  for (let i = 8; i < size - 8; i += 1) {
    const row = grid[6];
    const col = grid[i];
    if (row) row[i] = i % 2 === 0 ? 1 : 0;
    if (col) col[6] = i % 2 === 0 ? 1 : 0;
  }
  const aligns = ALIGN[version] ?? [];
  for (const ay of aligns) {
    for (const ax of aligns) {
      if ((ax === 6 && ay === 6) || (ax === 6 && ay === size - 7) || (ax === size - 7 && ay === 6)) {
        continue;
      }
      for (let dy = -2; dy <= 2; dy += 1) {
        for (let dx = -2; dx <= 2; dx += 1) {
          const row = grid[ay + dy];
          if (row) row[ax + dx] = Math.max(Math.abs(dx), Math.abs(dy)) !== 1 ? 1 : 0;
        }
      }
    }
  }
  const reservedMap = reserved(size, version);
  let bitIndex = 0;
  const totalBits = codewords.length * 8;
  const getBit = (): number => {
    if (bitIndex >= totalBits) return 0;
    const word = codewords[Math.floor(bitIndex / 8)] ?? 0;
    const out = (word >> (7 - (bitIndex % 8))) & 1;
    bitIndex += 1;
    return out;
  };
  let upward = true;
  for (let x = size - 1; x > 0; x -= 2) {
    if (x === 6) x -= 1;
    for (let i = 0; i < size; i += 1) {
      const y = upward ? size - 1 - i : i;
      for (const xx of [x, x - 1]) {
        if (reservedMap[y]?.[xx]) continue;
        const raw = getBit();
        const row = grid[y];
        if (row) row[xx] = raw ^ (maskBit(xx, y) ? 1 : 0);
      }
    }
    upward = !upward;
  }

  const format = 0b101010000010010;
  const formatBits = [];
  for (let i = 14; i >= 0; i -= 1) formatBits.push((format >> i) & 1);
  const fmtPosA: Array<[number, number]> = [
    [8, 0], [8, 1], [8, 2], [8, 3], [8, 4], [8, 5], [8, 7], [8, 8],
    [7, 8], [5, 8], [4, 8], [3, 8], [2, 8], [1, 8], [0, 8],
  ];
  const fmtPosB: Array<[number, number]> = [
    [size - 1, 8], [size - 2, 8], [size - 3, 8], [size - 4, 8], [size - 5, 8],
    [size - 6, 8], [size - 7, 8], [8, size - 8], [8, size - 7], [8, size - 6],
    [8, size - 5], [8, size - 4], [8, size - 3], [8, size - 2], [8, size - 1],
  ];
  formatBits.forEach((bit, i) => {
    const a = fmtPosA[i];
    const b = fmtPosB[i];
    if (a && grid[a[1]]) grid[a[1]]![a[0]] = bit;
    if (b && grid[b[1]]) grid[b[1]]![b[0]] = bit;
  });
  const dark = grid[size - 8];
  if (dark) dark[8] = 1;

  const quiet = 4;
  const dim = (size + quiet * 2) * moduleSize;
  let path = '';
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      if (!grid[y]?.[x]) continue;
      const px = (x + quiet) * moduleSize;
      const py = (y + quiet) * moduleSize;
      path += `M${px} ${py}h${moduleSize}v${moduleSize}h-${moduleSize}z`;
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${dim} ${dim}" shape-rendering="crispEdges" role="img" aria-label="QR code"><rect width="${dim}" height="${dim}" fill="white"/><path d="${path}" fill="currentColor"/></svg>`;
}
