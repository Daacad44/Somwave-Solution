// Compact QR encoder (byte mode, ECC M) for authenticator otpauth URLs.
// Ported from the public-domain uqr approach — no network, no secret leak.

const ECC_CODEWORDS = [
  10, 16, 26, 18, 24, 18, 16, 22, 22, 26, 30, 22, 22, 24, 24, 28, 28, 26, 26, 26, 26, 28, 28, 28,
  28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28,
];

function gexp(n: number): number {
  let x = 1;
  for (let i = 0; i < n; i += 1) x = (x << 1) ^ (x & 0x80 ? 0x11d : 0);
  return x;
}

const EXP: number[] = Array.from({ length: 256 }, (_, i) => gexp(i));
const LOG: number[] = Array.from({ length: 256 }, () => 0);
for (let i = 0; i < 255; i += 1) LOG[EXP[i] ?? 0] = i;

function mul(a: number, b: number): number {
  if (a === 0 || b === 0) return 0;
  return EXP[((LOG[a] ?? 0) + (LOG[b] ?? 0)) % 255] ?? 0;
}

function rs(data: number[], ecCount: number): number[] {
  const gen = [1];
  for (let i = 0; i < ecCount; i += 1) {
    const next = new Array<number>(gen.length + 1).fill(0);
    for (let j = 0; j < gen.length; j += 1) {
      next[j] = (next[j] ?? 0) ^ mul(gen[j] ?? 0, EXP[i] ?? 0);
      next[j + 1] = (next[j + 1] ?? 0) ^ (gen[j] ?? 0);
    }
    gen.splice(0, gen.length, ...next);
  }
  const res = data.concat(new Array<number>(ecCount).fill(0));
  for (let i = 0; i < data.length; i += 1) {
    const coef = res[i] ?? 0;
    if (coef === 0) continue;
    for (let j = 0; j < gen.length; j += 1) {
      res[i + j] = (res[i + j] ?? 0) ^ mul(gen[j] ?? 0, coef);
    }
  }
  return res.slice(data.length);
}

function bitsToBytes(bits: string): number[] {
  const bytes: number[] = [];
  for (let i = 0; i < bits.length; i += 8) {
    bytes.push(Number.parseInt(bits.slice(i, i + 8).padEnd(8, '0'), 2));
  }
  return bytes;
}

export function encodeQrMatrix(text: string): boolean[][] | null {
  const bytes = Array.from(new TextEncoder().encode(text));
  if (bytes.length === 0 || bytes.length > 80) return null;

  let version = 2;
  while (version <= 10) {
    const size = version * 4 + 17;
    const total = Math.floor(((size * size - 3 * 25 - (version > 6 ? 36 : 0) - 31) * 8) / 8);
    const ec = ECC_CODEWORDS[version - 1] ?? 16;
    const dataCap = total - ec;
    const needed = bytes.length + 2 + (version >= 10 ? 2 : 1);
    if (needed <= dataCap) {
      const lenBits = version >= 10 ? 16 : 8;
      let bits = '0100' + bytes.length.toString(2).padStart(lenBits, '0');
      for (const value of bytes) bits += value.toString(2).padStart(8, '0');
      bits += '0000';
      while (bits.length % 8 !== 0) bits += '0';
      const data = bitsToBytes(bits);
      const pad = [0xec, 0x11];
      let p = 0;
      while (data.length < dataCap) data.push(pad[p++ % 2] ?? 0xec);
      const ecc = rs(data.slice(0, dataCap), ec);
      return paint(size, data.concat(ecc));
    }
    version += 1;
  }
  return null;
}

function paint(size: number, codewords: number[]): boolean[][] {
  const matrix = Array.from({ length: size }, () => Array.from({ length: size }, () => false));
  const reserved = Array.from({ length: size }, () => Array.from({ length: size }, () => false));

  const finder = (r: number, c: number): void => {
    for (let y = -1; y <= 7; y += 1) {
      for (let x = -1; x <= 7; x += 1) {
        const rr = r + y;
        const cc = c + x;
        if (rr < 0 || cc < 0 || rr >= size || cc >= size) continue;
        const dark =
          (x >= 0 && x <= 6 && y >= 0 && y <= 6 && (x === 0 || x === 6 || y === 0 || y === 6)) ||
          (x >= 2 && x <= 4 && y >= 2 && y <= 4);
        matrix[rr]![cc] = dark;
        reserved[rr]![cc] = true;
      }
    }
  };
  finder(0, 0);
  finder(0, size - 7);
  finder(size - 7, 0);

  for (let i = 8; i < size - 8; i += 1) {
    matrix[6]![i] = i % 2 === 0;
    matrix[i]![6] = i % 2 === 0;
    reserved[6]![i] = true;
    reserved[i]![6] = true;
  }

  let bit = 0;
  const bits: number[] = [];
  for (const word of codewords) {
    for (let i = 7; i >= 0; i -= 1) bits.push((word >> i) & 1);
  }
  for (let col = size - 1; col > 0; col -= 2) {
    if (col === 6) col -= 1;
    for (let rowPass = 0; rowPass < size; rowPass += 1) {
      const upward = ((size - 1 - col) / 2) % 2 === 0;
      const row = upward ? size - 1 - rowPass : rowPass;
      for (let dc = 0; dc < 2; dc += 1) {
        const c = col - dc;
        if (reserved[row]?.[c]) continue;
        const dark = (bits[bit] ?? 0) === 1;
        const mask = (row + c) % 2 === 0;
        matrix[row]![c] = mask ? !dark : dark;
        bit += 1;
      }
    }
  }
  return matrix;
}

export function qrSvgPath(text: string): { size: number; path: string } | null {
  const matrix = encodeQrMatrix(text);
  if (!matrix) return null;
  const cells: string[] = [];
  matrix.forEach((row, y) => {
    row.forEach((dark, x) => {
      if (dark) cells.push(`M${x} ${y}h1v1h-1z`);
    });
  });
  return { size: matrix.length, path: cells.join('') };
}
