import { useEffect } from 'react'
import { useEditor } from '../state/editorStore'

/** Wire editor keyboard shortcuts: copy/paste/duplicate/delete/save. */
export function useKeyboardShortcuts() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Ignore when typing in a form field.
      const target = e.target as HTMLElement
      const tag = target.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable) {
        return
      }
      const s = useEditor.getState()
      const mod = e.ctrlKey || e.metaKey

      if (mod && e.key.toLowerCase() === 'z' && !e.shiftKey) {
        s.undo()
        e.preventDefault()
      } else if ((mod && e.key.toLowerCase() === 'z' && e.shiftKey) || (mod && e.key.toLowerCase() === 'y')) {
        s.redo()
        e.preventDefault()
      } else if (mod && e.key.toLowerCase() === 'c') {
        s.copy()
        e.preventDefault()
      } else if (mod && e.key.toLowerCase() === 'v') {
        s.paste()
        e.preventDefault()
      } else if (mod && e.key.toLowerCase() === 'd') {
        s.duplicate()
        e.preventDefault()
      } else if (mod && e.key.toLowerCase() === 's') {
        void s.saveActive()
        e.preventDefault()
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        if (s.selection.length) {
          s.remove()
          e.preventDefault()
        }
      } else if (e.key === 'Escape') {
        s.setSelection([])
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
}
