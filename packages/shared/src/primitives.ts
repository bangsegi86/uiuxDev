/**
 * Primitive component registry metadata.
 *
 * Each primitive declares the prop fields it exposes (which drives both the
 * left palette and the generic right-side property panel) plus sensible
 * defaults. The client maps `type` -> a React renderer in `componentRegistry`.
 */

import type { Layout, NodeInstance } from './models.js'

export type FieldKind = 'text' | 'textarea' | 'number' | 'color' | 'select' | 'boolean'

export interface PropField {
  key: string
  label: string
  kind: FieldKind
  /** Whether the field edits `props` (content) or `style` (CSS). */
  target: 'props' | 'style'
  options?: { label: string; value: string }[]
  /** Default value applied when a fresh instance is created. */
  default?: unknown
}

export interface PrimitiveDef {
  type: string
  label: string
  /** Emoji/icon shown in the palette. */
  icon: string
  /** Whether this primitive can contain children (drop target). */
  container: boolean
  defaultLayout: { w: number; h: number }
  fields: PropField[]
  /** Non-field default props (e.g. grid columns) merged on creation. */
  defaultProps?: Record<string, unknown>
  /** Identifier for a bespoke property editor (e.g. 'grid'). */
  customEditor?: string
}

const REQUIRED_FIELD: PropField = {
  key: 'required',
  label: 'Required',
  kind: 'boolean',
  target: 'props',
  default: false
}
const READONLY_FIELD: PropField = {
  key: 'readonly',
  label: 'Read-only',
  kind: 'boolean',
  target: 'props',
  default: false
}

/** Style fields shared by every primitive. */
const COMMON_STYLE_FIELDS: PropField[] = [
  { key: 'background', label: 'Background', kind: 'color', target: 'style' },
  { key: 'color', label: 'Text color', kind: 'color', target: 'style' },
  { key: 'borderColor', label: 'Border color', kind: 'color', target: 'style' },
  { key: 'borderWidth', label: 'Border width (px)', kind: 'number', target: 'style' },
  { key: 'borderRadius', label: 'Radius (px)', kind: 'number', target: 'style' },
  { key: 'fontSize', label: 'Font size (px)', kind: 'number', target: 'style' },
  {
    key: 'fontWeight',
    label: 'Font weight',
    kind: 'select',
    target: 'style',
    options: [
      { label: 'Normal', value: 'normal' },
      { label: 'Bold', value: 'bold' }
    ]
  },
  {
    key: 'textAlign',
    label: 'Text align',
    kind: 'select',
    target: 'style',
    options: [
      { label: 'Left', value: 'left' },
      { label: 'Center', value: 'center' },
      { label: 'Right', value: 'right' }
    ]
  },
  { key: 'padding', label: 'Padding (px)', kind: 'number', target: 'style' }
]

export const PRIMITIVES: PrimitiveDef[] = [
  {
    type: 'container',
    label: 'Container',
    icon: '▢',
    container: true,
    defaultLayout: { w: 320, h: 200 },
    fields: [...COMMON_STYLE_FIELDS]
  },
  {
    type: 'row',
    label: 'Row',
    icon: '⬌',
    container: true,
    defaultLayout: { w: 360, h: 80 },
    fields: [...COMMON_STYLE_FIELDS]
  },
  {
    type: 'column',
    label: 'Column',
    icon: '⬍',
    container: true,
    defaultLayout: { w: 200, h: 240 },
    fields: [...COMMON_STYLE_FIELDS]
  },
  {
    type: 'text',
    label: 'Text',
    icon: 'T',
    container: false,
    defaultLayout: { w: 160, h: 32 },
    fields: [
      { key: 'text', label: 'Text', kind: 'textarea', target: 'props', default: 'Text' },
      ...COMMON_STYLE_FIELDS
    ]
  },
  {
    type: 'button',
    label: 'Button',
    icon: '⬚',
    container: false,
    defaultLayout: { w: 120, h: 40 },
    fields: [
      { key: 'text', label: 'Label', kind: 'text', target: 'props', default: 'Button' },
      ...COMMON_STYLE_FIELDS
    ]
  },
  {
    type: 'input',
    label: 'Input',
    icon: '▭',
    container: false,
    defaultLayout: { w: 200, h: 40 },
    fields: [
      { key: 'label', label: 'Label', kind: 'text', target: 'props', default: '' },
      { key: 'placeholder', label: 'Placeholder', kind: 'text', target: 'props', default: 'Enter text' },
      REQUIRED_FIELD,
      READONLY_FIELD,
      ...COMMON_STYLE_FIELDS
    ]
  },
  {
    type: 'checkbox',
    label: 'Checkbox',
    icon: '☑',
    container: false,
    defaultLayout: { w: 160, h: 28 },
    fields: [
      { key: 'label', label: 'Label', kind: 'text', target: 'props', default: 'Checkbox' },
      { key: 'checked', label: 'Checked', kind: 'boolean', target: 'props', default: false },
      REQUIRED_FIELD,
      READONLY_FIELD,
      ...COMMON_STYLE_FIELDS
    ]
  },
  {
    type: 'radio',
    label: 'Radio group',
    icon: '◉',
    container: false,
    defaultLayout: { w: 200, h: 96 },
    fields: [
      { key: 'label', label: 'Label', kind: 'text', target: 'props', default: '' },
      { key: 'options', label: 'Options (comma)', kind: 'text', target: 'props', default: 'A,B,C' },
      { key: 'value', label: 'Selected', kind: 'text', target: 'props', default: 'A' },
      REQUIRED_FIELD,
      READONLY_FIELD,
      ...COMMON_STYLE_FIELDS
    ]
  },
  {
    type: 'calendar',
    label: 'Date picker',
    icon: '📅',
    container: false,
    defaultLayout: { w: 200, h: 40 },
    fields: [
      { key: 'label', label: 'Label', kind: 'text', target: 'props', default: '' },
      { key: 'value', label: 'Value (YYYY-MM-DD)', kind: 'text', target: 'props', default: '' },
      { key: 'placeholder', label: 'Placeholder', kind: 'text', target: 'props', default: 'YYYY-MM-DD' },
      REQUIRED_FIELD,
      READONLY_FIELD,
      ...COMMON_STYLE_FIELDS
    ]
  },
  {
    type: 'grid',
    label: 'Grid (table)',
    icon: '▦',
    container: false,
    defaultLayout: { w: 480, h: 200 },
    customEditor: 'grid',
    defaultProps: {
      columns: [
        { title: 'Col 1', width: 120, colSpan: 1 },
        { title: 'Col 2', width: 120, colSpan: 1 },
        { title: 'Col 3', width: 120, colSpan: 1 }
      ],
      rowCount: 3
    },
    fields: [...COMMON_STYLE_FIELDS]
  },
  {
    type: 'modal',
    label: 'Modal / Message box',
    icon: '🗔',
    container: true,
    defaultLayout: { w: 360, h: 200 },
    fields: [
      { key: 'title', label: 'Title', kind: 'text', target: 'props', default: 'Title' },
      { key: 'message', label: 'Message', kind: 'textarea', target: 'props', default: 'Message text' },
      { key: 'confirmText', label: 'Confirm button', kind: 'text', target: 'props', default: 'OK' },
      { key: 'cancelText', label: 'Cancel button', kind: 'text', target: 'props', default: 'Cancel' },
      { key: 'showOverlay', label: 'Dim background', kind: 'boolean', target: 'props', default: true },
      ...COMMON_STYLE_FIELDS
    ]
  },
  {
    type: 'annotation',
    label: 'Annotation',
    icon: '💬',
    container: false,
    defaultLayout: { w: 180, h: 80 },
    fields: [
      { key: 'text', label: 'Note', kind: 'textarea', target: 'props', default: '설명을 입력하세요' },
      { key: 'link', label: 'Link / Reference', kind: 'text', target: 'props', default: '' },
      ...COMMON_STYLE_FIELDS
    ]
  },
  {
    type: 'image',
    label: 'Image',
    icon: '🖼',
    container: false,
    defaultLayout: { w: 200, h: 150 },
    fields: [
      { key: 'src', label: 'Image URL', kind: 'text', target: 'props', default: '' },
      { key: 'alt', label: 'Alt text', kind: 'text', target: 'props', default: '' },
      ...COMMON_STYLE_FIELDS
    ]
  },
  {
    type: 'divider',
    label: 'Divider',
    icon: '―',
    container: false,
    defaultLayout: { w: 240, h: 2 },
    fields: [{ key: 'background', label: 'Color', kind: 'color', target: 'style', default: '#d0d0d0' }]
  },
  {
    type: 'icon',
    label: 'Icon',
    icon: '★',
    container: false,
    defaultLayout: { w: 40, h: 40 },
    fields: [
      { key: 'glyph', label: 'Glyph', kind: 'text', target: 'props', default: '★' },
      ...COMMON_STYLE_FIELDS
    ]
  }
]

const PRIMITIVE_BY_TYPE: Record<string, PrimitiveDef> = Object.fromEntries(
  PRIMITIVES.map((p) => [p.type, p])
)

export function getPrimitive(type: string): PrimitiveDef | undefined {
  return PRIMITIVE_BY_TYPE[type]
}

export function isContainerType(type: string): boolean {
  return PRIMITIVE_BY_TYPE[type]?.container ?? false
}

/** Build the default props/style maps for a primitive from its field defaults. */
export function defaultsFor(def: PrimitiveDef): {
  props: Record<string, unknown>
  style: Record<string, string>
} {
  const props: Record<string, unknown> = { ...(def.defaultProps ?? {}) }
  const style: Record<string, string> = {}
  for (const f of def.fields) {
    if (f.default === undefined) continue
    if (f.target === 'props') props[f.key] = f.default
    else style[f.key] = String(f.default)
  }
  return { props, style }
}

/** Create a fresh NodeInstance for a primitive at a given position. */
export function createInstance(
  type: string,
  id: string,
  at: { x: number; y: number }
): NodeInstance {
  const def = getPrimitive(type)
  const size = def?.defaultLayout ?? { w: 160, h: 80 }
  const { props, style } = def ? defaultsFor(def) : { props: {}, style: {} }
  const layout: Layout = { x: at.x, y: at.y, w: size.w, h: size.h }
  return { id, type, props, style, layout, children: [] }
}
