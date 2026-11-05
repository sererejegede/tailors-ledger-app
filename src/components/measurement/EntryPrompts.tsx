import { NameSheet } from '@/components/ui';
import type { Prompt } from '@/features/measurement-entry/useEntrySession';

/**
 * The hero's one-field sheets, from the bottom (rule 5): name the client on save, add an
 * ad-hoc item, add the client up front, and label the set. One shows at a time, driven by
 * `prompt.mode`.
 */
type Props = {
  prompt: Prompt | null;
  label?: string;
  onCancel: () => void;
  onSubmitName: (value: string) => void;
  onSubmitAddItem: (value: string) => void;
  onSubmitCreateClient: (value: string) => void;
  onSubmitLabel: (value: string) => void;
};

export function EntryPrompts({
  prompt,
  label,
  onCancel,
  onSubmitName,
  onSubmitAddItem,
  onSubmitCreateClient,
  onSubmitLabel,
}: Props) {
  switch (prompt?.mode) {
    case 'name':
      return (
        <NameSheet
          title="Who is this for?"
          placeholder="Client name"
          submitLabel="Save set"
          error={prompt.error}
          onClose={onCancel}
          onSubmit={onSubmitName}
        />
      );
    case 'addItem':
      return (
        <NameSheet
          title="Add an item"
          placeholder="e.g. Cap circumference"
          submitLabel="Add item"
          onClose={onCancel}
          onSubmit={onSubmitAddItem}
        />
      );
    case 'createClient':
      return (
        <NameSheet
          title="Add client"
          placeholder="Client name"
          submitLabel="Add client"
          error={prompt.error}
          onClose={onCancel}
          onSubmit={onSubmitCreateClient}
        />
      );
    case 'label':
      return (
        <NameSheet
          title={label ? 'Change label' : 'Add label'}
          placeholder="e.g. Wedding agbada"
          initialValue={label}
          submitLabel="Save label"
          onClose={onCancel}
          onSubmit={onSubmitLabel}
        />
      );
    default:
      return null;
  }
}
