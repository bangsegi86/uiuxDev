import { create } from 'zustand'

/**
 * App-wide prompt/confirm dialogs that replace the browser's window.prompt /
 * window.confirm. Promise-based so call sites read naturally:
 *   const name = await dialog.prompt('Rename', current)
 *   if (await dialog.confirm('Delete this?')) ...
 */
interface Pending {
  kind: 'prompt' | 'confirm'
  title: string
  defaultValue: string
  resolve: (value: string | boolean | null) => void
}

interface DialogStore {
  pending: Pending | null
  prompt: (title: string, defaultValue?: string) => Promise<string | null>
  confirm: (title: string) => Promise<boolean>
  close: (value: string | boolean | null) => void
}

export const useDialog = create<DialogStore>((set, get) => ({
  pending: null,
  prompt: (title, defaultValue = '') =>
    new Promise<string | null>((resolve) => {
      get().pending?.resolve(null) // cancel any dialog already open
      set({ pending: { kind: 'prompt', title, defaultValue, resolve: resolve as Pending['resolve'] } })
    }),
  confirm: (title) =>
    new Promise<boolean>((resolve) => {
      get().pending?.resolve(false)
      set({ pending: { kind: 'confirm', title, defaultValue: '', resolve: resolve as Pending['resolve'] } })
    }),
  close: (value) => {
    const p = get().pending
    if (p) p.resolve(value)
    set({ pending: null })
  }
}))

/** Convenience wrappers usable outside React (in event handlers). */
export const dialog = {
  prompt: (title: string, defaultValue?: string) => useDialog.getState().prompt(title, defaultValue),
  confirm: (title: string) => useDialog.getState().confirm(title)
}
