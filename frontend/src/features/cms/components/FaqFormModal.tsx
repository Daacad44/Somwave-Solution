// Create / edit a FAQ in the CMS (W5.3). The shared schema drives the resolver
// (§11). Writes invalidate the public FAQ cache server-side.
import { type ReactNode, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { createFaqSchema, type AdminFaq, type CreateFaqInput } from '@somwave/shared';
import { Modal } from '../../../components/ui/Modal';
import { Input } from '../../../components/ui/Input';
import { Button } from '../../../components/ui/Button';
import { ApiError } from '../../../lib/apiClient';
import { useCreateFaq, useUpdateFaq } from '../hooks';

export interface FaqFormModalProps {
  open: boolean;
  onClose: () => void;
  faq?: AdminFaq | null; // present → edit
}

export function FaqFormModal({ open, onClose, faq }: FaqFormModalProps): ReactNode {
  const isEdit = Boolean(faq);
  const createMutation = useCreateFaq();
  const updateMutation = useUpdateFaq();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CreateFaqInput>({
    resolver: zodResolver(createFaqSchema),
    defaultValues: {
      question: faq?.question ?? '',
      answer: faq?.answer ?? '',
      order: faq?.order ?? 0,
      isPublished: faq?.isPublished ?? true,
    },
  });

  const close = (): void => {
    reset();
    setServerError(null);
    onClose();
  };

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null);
    try {
      if (isEdit && faq) {
        await updateMutation.mutateAsync({ id: faq.id, input: values });
      } else {
        await createMutation.mutateAsync(values);
      }
      close();
    } catch (err) {
      setServerError(
        err instanceof ApiError ? err.message : 'Wax baa qaldamay. Fadlan mar kale isku day.',
      );
    }
  });

  const pending = isSubmitting || createMutation.isPending || updateMutation.isPending;

  return (
    <Modal open={open} onClose={close} title={isEdit ? 'Wax ka beddel su’aasha' : 'Su’aal cusub'}>
      <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
        <Input label="Su’aasha" error={errors.question?.message} {...register('question')} />

        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-ink">Jawaabta</span>
          <textarea
            className="min-h-32 rounded-md border border-border bg-surface px-3 py-2 text-base text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            rows={5}
            {...register('answer')}
          />
          {errors.answer ? (
            <span className="text-sm text-error">{errors.answer.message}</span>
          ) : null}
        </label>

        <div className="flex items-end gap-4">
          <Input
            label="Kala horreyn (order)"
            type="number"
            min={0}
            className="w-32"
            error={errors.order?.message}
            {...register('order', { valueAsNumber: true })}
          />
          <label className="mb-2 flex items-center gap-2 text-base text-ink">
            <input type="checkbox" className="size-4 accent-primary" {...register('isPublished')} />
            La daabaco (published)
          </label>
        </div>

        {serverError ? <p className="text-sm text-error">{serverError}</p> : null}

        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={close}>
            Jooji
          </Button>
          <Button type="submit" isLoading={pending}>
            {isEdit ? 'Kaydi' : 'Abuur'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
