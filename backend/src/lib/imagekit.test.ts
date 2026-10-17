import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const sdk = vi.hoisted(() => {
  class APIError extends Error {
    constructor(readonly status: number | undefined) {
      super(`status ${status}`);
      this.name = 'APIError';
    }
  }
  class APIConnectionTimeoutError extends APIError {
    constructor() {
      super(undefined);
      this.name = 'APIConnectionTimeoutError';
    }
  }
  return {
    APIError,
    APIConnectionTimeoutError,
    upload: vi.fn(),
    remove: vi.fn(),
    list: vi.fn(),
    buildSrc: vi.fn(
      (opts: { urlEndpoint: string; src: string }) =>
        `${opts.urlEndpoint}${opts.src}?ik-s=signature`,
    ),
    constructed: vi.fn(),
  };
});

vi.mock('@imagekit/nodejs', () => ({
  default: class {
    files = { upload: sdk.upload, delete: sdk.remove };
    assets = { list: sdk.list };
    helper = { buildSrc: sdk.buildSrc };
    constructor(options: unknown) {
      sdk.constructed(options);
    }
  },
  APIError: sdk.APIError,
  APIConnectionTimeoutError: sdk.APIConnectionTimeoutError,
  toFile: vi.fn(async (bytes: Buffer, name: string) => ({ name, size: bytes.length })),
}));
vi.mock('./logger', () => ({ logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() } }));

import { env } from './env';
import { logger } from './logger';
import {
  deleteFromImageKit,
  imageKitConfigured,
  readFromImageKit,
  resetImageKitClient,
  uploadToImageKit,
  verifyImageKit,
} from './imagekit';

const PRIVATE_KEY = 'private_test_key_never_logged';
const ENDPOINT = 'https://ik.imagekit.io/acme';
const NAME = `${'a'.repeat(32)}.jpg`;

function configure(on: boolean): void {
  env.IMAGEKIT_PRIVATE_KEY = on ? PRIVATE_KEY : undefined;
  env.IMAGEKIT_URL_ENDPOINT = on ? ENDPOINT : undefined;
  resetImageKitClient();
}

beforeEach(() => {
  vi.clearAllMocks();
  configure(true);
});

afterEach(() => {
  configure(false);
  vi.unstubAllGlobals();
});

function uploaded(folder: string, isPrivate = false) {
  return {
    fileId: 'file_0123456789',
    filePath: `/${folder}/${NAME}`,
    url: `${ENDPOINT}/${folder}/${NAME}`,
    width: 800,
    height: 600,
    size: 3,
    isPrivateFile: isPrivate,
  };
}

describe('uploadToImageKit', () => {
  it('uploads public website images to their server-chosen folder', async () => {
    sdk.upload.mockResolvedValue(uploaded('somwave/website/articles'));
    const result = await uploadToImageKit({
      bytes: Buffer.from([1, 2, 3]),
      mimeType: 'image/jpeg',
      module: 'articles',
      name: NAME,
    });
    expect(sdk.upload).toHaveBeenCalledWith(
      expect.objectContaining({
        fileName: NAME,
        folder: '/somwave/website/articles',
        useUniqueFileName: false,
        isPrivateFile: false,
      }),
    );
    expect(sdk.constructed).toHaveBeenCalledWith(
      expect.objectContaining({ privateKey: PRIVATE_KEY }),
    );
    expect(result).toEqual({
      fileId: 'file_0123456789',
      filePath: `somwave/website/articles/${NAME}`,
      url: `${ENDPOINT}/somwave/website/articles/${NAME}`,
      width: 800,
      height: 600,
      size: 3,
    });
  });

  it('uploads private module images as ImageKit private files without a public URL', async () => {
    sdk.upload.mockResolvedValue(uploaded('somwave/private/projects/attachments', true));
    const result = await uploadToImageKit({
      bytes: Buffer.from([1, 2, 3]),
      mimeType: 'image/jpeg',
      module: 'project-attachments',
      name: NAME,
    });
    expect(sdk.upload).toHaveBeenCalledWith(
      expect.objectContaining({
        folder: '/somwave/private/projects/attachments',
        isPrivateFile: true,
      }),
    );
    expect(result.url).toBe('');
  });

  it('refuses names that could escape the folder', async () => {
    await expect(
      uploadToImageKit({
        bytes: Buffer.from([1]),
        mimeType: 'image/jpeg',
        module: 'articles',
        name: '../../x.jpg',
      }),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    expect(sdk.upload).not.toHaveBeenCalled();
  });

  it('fails clearly when ImageKit is not configured', async () => {
    configure(false);
    expect(imageKitConfigured()).toBe(false);
    await expect(
      uploadToImageKit({
        bytes: Buffer.from([1]),
        mimeType: 'image/jpeg',
        module: 'articles',
        name: NAME,
      }),
    ).rejects.toMatchObject({
      code: 'SERVICE_UNAVAILABLE',
      status: 503,
      details: { reason: 'IMAGEKIT_NOT_CONFIGURED' },
    });
  });

  it.each([
    [new sdk.APIError(401), 503, 'IMAGEKIT_AUTH_FAILED'],
    [new sdk.APIConnectionTimeoutError(), 503, 'IMAGEKIT_TIMEOUT'],
    [new sdk.APIError(429), 503, 'IMAGEKIT_RATE_LIMITED'],
    [new sdk.APIError(400), 400, 'IMAGEKIT_REJECTED_FILE'],
    [new sdk.APIError(500), 503, 'IMAGEKIT_UNAVAILABLE'],
  ])(
    'maps provider failure %# to a safe error and a structured log',
    async (error, status, reason) => {
      sdk.upload.mockRejectedValue(error);
      await expect(
        uploadToImageKit({
          bytes: Buffer.from([1]),
          mimeType: 'image/jpeg',
          module: 'team',
          name: NAME,
        }),
      ).rejects.toMatchObject({ status, details: { reason } });
      const [fields, message] = vi.mocked(logger.error).mock.calls[0]!;
      expect(message).toBe('[ImageKit] upload FAILED');
      expect(fields).toMatchObject({ provider: 'imagekit', module: 'team', errorCode: reason });
      expect(JSON.stringify(vi.mocked(logger.error).mock.calls)).not.toContain(PRIVATE_KEY);
    },
  );

  it('rejects an upload response without file metadata', async () => {
    sdk.upload.mockResolvedValue({ url: 'x' });
    await expect(
      uploadToImageKit({
        bytes: Buffer.from([1]),
        mimeType: 'image/jpeg',
        module: 'articles',
        name: NAME,
      }),
    ).rejects.toMatchObject({ status: 503 });
  });
});

describe('deleteFromImageKit', () => {
  it('deletes by file id and treats an already-deleted file as success', async () => {
    sdk.remove.mockRejectedValueOnce(new sdk.APIError(404));
    await expect(deleteFromImageKit('file_0123456789')).resolves.toBeUndefined();
    expect(sdk.remove).toHaveBeenCalledWith('file_0123456789');
  });

  it('surfaces other deletion failures so the record is kept', async () => {
    sdk.remove.mockRejectedValueOnce(new sdk.APIError(500));
    await expect(deleteFromImageKit('file_0123456789')).rejects.toMatchObject({ status: 503 });
  });

  it('ignores malformed file ids', async () => {
    await deleteFromImageKit('../etc');
    expect(sdk.remove).not.toHaveBeenCalled();
  });
});

describe('readFromImageKit', () => {
  it('reads private files through a short-lived signed URL', async () => {
    const fetchMock = vi.fn(async () => new Response(Buffer.from('bytes')));
    vi.stubGlobal('fetch', fetchMock);
    const bytes = await readFromImageKit(`somwave/private/media/${NAME}`);
    expect(bytes?.toString()).toBe('bytes');
    expect(sdk.buildSrc).toHaveBeenCalledWith(
      expect.objectContaining({
        urlEndpoint: ENDPOINT,
        src: `/somwave/private/media/${NAME}`,
        signed: true,
        expiresIn: 120,
      }),
    );
    expect(fetchMock).toHaveBeenCalledWith(
      `${ENDPOINT}/somwave/private/media/${NAME}?ik-s=signature`,
      expect.anything(),
    );
  });

  it('returns null for a missing file', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(null, { status: 404 })),
    );
    await expect(readFromImageKit(`somwave/private/media/${NAME}`)).resolves.toBeNull();
  });
});

describe('verifyImageKit', () => {
  it('checks credentials with a read-only list call and never uploads', async () => {
    sdk.list.mockResolvedValue([]);
    await expect(verifyImageKit()).resolves.toEqual({
      configured: true,
      reachable: true,
      urlEndpointHost: 'ik.imagekit.io',
    });
    expect(sdk.list).toHaveBeenCalledWith({ limit: 1 });
    expect(sdk.upload).not.toHaveBeenCalled();
  });

  it('reports rejected credentials without throwing', async () => {
    sdk.list.mockRejectedValue(new sdk.APIError(403));
    await expect(verifyImageKit()).resolves.toMatchObject({
      configured: true,
      reachable: false,
      error: expect.stringContaining('rejected the API credentials'),
    });
  });

  it('reports missing configuration', async () => {
    configure(false);
    await expect(verifyImageKit()).resolves.toEqual({
      configured: false,
      reachable: null,
      urlEndpointHost: null,
    });
  });
});
