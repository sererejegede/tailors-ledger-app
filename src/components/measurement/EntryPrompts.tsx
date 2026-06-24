import { PromptModal } from '@/components/PromptModal';
import type { Prompt } from '@/features/measurement-entry/useEntrySession';

/**
 * The hero's three single-field prompts: name-on-save, add ad-hoc item, and create the
 * client up front. Exactly one shows at a time, driven by `prompt.mode`.
 */
type Props = {
  prompt: Prompt | null;
  onCancel: () => void;
  onSubmitName: (value: string) => void;
  onSubmitAddItem: (value: string) => void;
  onSubmitCreateClient: (value: string) => void;
};

export function EntryPrompts({
  prompt,
  onCancel,
  onSubmitName,
  onSubmitAddItem,
  onSubmitCreateClient,
}: Props) {
  return (
    <>
      <PromptModal
        visible={prompt?.mode === 'name'}
        title="Name this client"
        message="Save the set against a client."
        placeholder="Client name"
        submitLabel="Save set"
        error={prompt?.mode === 'name' ? prompt.error : undefined}
        onCancel={onCancel}
        onSubmit={onSubmitName}
      />
      <PromptModal
        visible={prompt?.mode === 'addItem'}
        title="Add a measurement"
        message="Adds an item to this set only."
        placeholder="e.g. Cap circumference"
        submitLabel="Add item"
        onCancel={onCancel}
        onSubmit={onSubmitAddItem}
      />
      <PromptModal
        visible={prompt?.mode === 'createClient'}
        title="Add client"
        message="Create the client now; keep measuring and save when you're ready."
        placeholder="Client name"
        submitLabel="Add client"
        error={prompt?.mode === 'createClient' ? prompt.error : undefined}
        onCancel={onCancel}
        onSubmit={onSubmitCreateClient}
      />
    </>
  );
}
