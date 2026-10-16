// Article cover picker. The file stays on the device until the form submits;
// the parent uploads it through the authenticated CMS API.
import { type ReactNode, useEffect, useId, useRef, useState } from 'react';
import { ImagePlus } from 'lucide-react';
import { Button } from '../../../components/ui/Button';

export interface ArticleImageFieldProps {
  label?: string;
  existingUrl?: string | null;
  file: File | null;
  removed: boolean;
  error?: string | null;
  uploading?: boolean;
  progress?: number | null;
  onSelect: (file: File) => void;
  onRemove: () => void;
}

function formatSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function ArticleImageField({
  label = 'Post image',
  existingUrl,
  file,
  removed,
  error,
  uploading = false,
  progress = null,
  onSelect,
  onRemove,
}: ArticleImageFieldProps): ReactNode {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!file) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const currentUrl = previewUrl ?? (!removed ? existingUrl : null) ?? null;
  const fileName = file?.name ?? (currentUrl ? 'Current image' : null);

  const take = (next: File | undefined): void => {
    if (!next || uploading) return;
    onSelect(next);
  };

  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-medium text-ink" id={`${inputId}-label`}>
        {label}
      </span>
      <div
        className={`rounded-lg border border-dashed bg-surface-alt p-4 ${
          dragOver ? 'border-accent' : error ? 'border-error' : 'border-border'
        }`}
        onDragEnter={(event) => {
          event.preventDefault();
          setDragOver(true);
        }}
        onDragOver={(event) => {
          event.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragOver(false);
          take(event.dataTransfer.files[0]);
        }}
      >
        <input
          ref={inputRef}
          id={inputId}
          type="file"
          accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
          className="sr-only"
          aria-labelledby={`${inputId}-label`}
          disabled={uploading}
          onChange={(event) => {
            take(event.target.files?.[0]);
            event.target.value = '';
          }}
        />

        {currentUrl ? (
          <div className="flex flex-col gap-3">
            <div className="aspect-video overflow-hidden rounded-md border border-border bg-surface">
              <img src={currentUrl} alt="" className="h-full w-full object-cover" />
            </div>
            <div className="text-sm text-ink">
              <p className="truncate font-medium">{fileName}</p>
              {file ? <p className="text-muted">{formatSize(file.size)}</p> : null}
            </div>
            {uploading ? (
              <div>
                <p className="mb-2 text-sm text-muted">Uploading image...</p>
                <div
                  className="h-2 overflow-hidden rounded-full bg-surface"
                  role="progressbar"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={progress ?? 0}
                  aria-label="Uploading image"
                >
                  <div
                    className="h-full bg-primary transition-all"
                    style={{ width: `${progress ?? 0}%` }}
                  />
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="secondary" onClick={() => inputRef.current?.click()}>
                  Replace image
                </Button>
                <Button type="button" variant="secondary" onClick={onRemove}>
                  Remove
                </Button>
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 py-4 text-center">
            <ImagePlus className="h-8 w-8 text-muted" aria-hidden="true" />
            <p className="text-base font-medium text-ink">Drag an image here</p>
            <p className="text-sm text-muted">or click to choose</p>
            <p className="text-sm text-muted">PNG, JPG, JPEG, WEBP — max 5MB</p>
            <Button
              type="button"
              variant="secondary"
              className="mt-2"
              disabled={uploading}
              onClick={() => inputRef.current?.click()}
            >
              Choose image
            </Button>
          </div>
        )}
      </div>
      {error ? <p className="text-sm text-error">{error}</p> : null}
    </div>
  );
}
