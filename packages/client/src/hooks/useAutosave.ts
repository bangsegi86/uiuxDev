import { useEffect, useRef } from 'react'
import { useEditor } from '../state/editorStore'

/** Debounce window (ms) after the last edit before autosaving. */
const DELAY = 1500

/**
 * Autosave: persists every document with unsaved changes a short while after
 * the user stops editing. It only reschedules when the `dirty` map actually
 * changes (an edit), so unrelated state churn (cursor moves, zoom) doesn't keep
 * pushing the save back. Disabled via the autosave toggle.
 */
export function useAutosave() {
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => {
    const unsub = useEditor.subscribe((state, prev) => {
      if (state.dirty === prev.dirty) return // not an edit (or a save flipped it)
      if (!state.autosave) return
      if (!Object.values(state.dirty).some(Boolean)) return
      clearTimeout(timer.current)
      timer.current = setTimeout(() => {
        const s = useEditor.getState()
        if (s.autosave && !s.saving && Object.values(s.dirty).some(Boolean)) {
          void s.saveAll()
        }
      }, DELAY)
    })
    return () => {
      clearTimeout(timer.current)
      unsub()
    }
  }, [])
}
