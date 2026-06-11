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
  },
  {
    type: 'toggle',
    label: 'Toggle / Switch',
    icon: '🔘',
    container: false,
    defaultLayout: { w: 160, h: 32 },
    fields: [
      { key: 'label', label: 'Label', kind: 'text', target: 'props', default: 'Enabled' },
      { key: 'checked', label: 'On', kind: 'boolean', target: 'props', default: true },
      { key: 'onColor', label: 'On color', kind: 'text', target: 'props', default: '#2563eb' },
      ...COMMON_STYLE_FIELDS
    ]
  },
  {
    type: 'toast',
    label: 'Toast / Snackbar',
    icon: '🍞',
    container: false,
    defaultLayout: { w: 320, h: 48 },
    fields: [
      { key: 'message', label: 'Message', kind: 'text', target: 'props', default: '저장되었습니다' },
      {
        key: 'variant',
        label: 'Variant',
        kind: 'select',
        target: 'props',
        default: 'info',
        options: [
          { label: 'Info', value: 'info' },
          { label: 'Success', value: 'success' },
          { label: 'Warning', value: 'warning' },
          { label: 'Error', value: 'error' }
        ]
      },
      { key: 'action', label: 'Action text', kind: 'text', target: 'props', default: '' },
      ...COMMON_STYLE_FIELDS
    ]
  },
  {
    type: 'badge',
    label: 'Badge',
    icon: '🔴',
    container: false,
    defaultLayout: { w: 24, h: 24 },
    fields: [
      { key: 'text', label: 'Text / Count', kind: 'text', target: 'props', default: '3' },
      { key: 'dot', label: 'Dot only', kind: 'boolean', target: 'props', default: false },
      ...COMMON_STYLE_FIELDS
    ]
  },
  {
    type: 'avatar',
    label: 'Avatar',
    icon: '👤',
    container: false,
    defaultLayout: { w: 48, h: 48 },
    fields: [
      { key: 'src', label: 'Image URL', kind: 'text', target: 'props', default: '' },
      { key: 'initials', label: 'Initials', kind: 'text', target: 'props', default: 'AB' },
      {
        key: 'shape',
        label: 'Shape',
        kind: 'select',
        target: 'props',
        default: 'circle',
        options: [
          { label: 'Circle', value: 'circle' },
          { label: 'Square', value: 'square' }
        ]
      },
      ...COMMON_STYLE_FIELDS
    ]
  },
  {
    type: 'chip',
    label: 'Chip / Tag',
    icon: '🏷',
    container: false,
    defaultLayout: { w: 88, h: 32 },
    fields: [
      { key: 'text', label: 'Text', kind: 'text', target: 'props', default: 'Tag' },
      { key: 'removable', label: 'Removable', kind: 'boolean', target: 'props', default: false },
      ...COMMON_STYLE_FIELDS
    ]
  },
  {
    type: 'fab',
    label: 'Floating button',
    icon: '➕',
    container: false,
    defaultLayout: { w: 56, h: 56 },
    fields: [
      { key: 'glyph', label: 'Glyph', kind: 'text', target: 'props', default: '＋' },
      ...COMMON_STYLE_FIELDS
    ]
  },
  {
    type: 'searchbar',
    label: 'Search bar',
    icon: '🔍',
    container: false,
    defaultLayout: { w: 320, h: 40 },
    fields: [
      { key: 'placeholder', label: 'Placeholder', kind: 'text', target: 'props', default: '검색' },
      ...COMMON_STYLE_FIELDS
    ]
  },
  {
    type: 'slider',
    label: 'Slider',
    icon: '🎚',
    container: false,
    defaultLayout: { w: 220, h: 32 },
    fields: [
      { key: 'value', label: 'Value', kind: 'number', target: 'props', default: 50 },
      { key: 'min', label: 'Min', kind: 'number', target: 'props', default: 0 },
      { key: 'max', label: 'Max', kind: 'number', target: 'props', default: 100 },
      ...COMMON_STYLE_FIELDS
    ]
  },
  {
    type: 'progress',
    label: 'Progress bar',
    icon: '▰',
    container: false,
    defaultLayout: { w: 220, h: 8 },
    fields: [
      { key: 'value', label: 'Percent (0–100)', kind: 'number', target: 'props', default: 60 },
      ...COMMON_STYLE_FIELDS
    ]
  },
  {
    type: 'stepper',
    label: 'Stepper',
    icon: '🔢',
    container: false,
    defaultLayout: { w: 120, h: 36 },
    fields: [
      { key: 'value', label: 'Value', kind: 'number', target: 'props', default: 1 },
      ...COMMON_STYLE_FIELDS
    ]
  },
  {
    type: 'rating',
    label: 'Rating (stars)',
    icon: '⭐',
    container: false,
    defaultLayout: { w: 130, h: 26 },
    fields: [
      { key: 'value', label: 'Value', kind: 'number', target: 'props', default: 3 },
      { key: 'max', label: 'Max', kind: 'number', target: 'props', default: 5 },
      ...COMMON_STYLE_FIELDS
    ]
  },
  {
    type: 'bottomnav',
    label: 'Bottom nav bar',
    icon: '📱',
    container: false,
    defaultLayout: { w: 390, h: 56 },
    fields: [
      { key: 'items', label: 'Items (comma)', kind: 'text', target: 'props', default: 'Home,Search,Alerts,Profile' },
      { key: 'icons', label: 'Icons (comma)', kind: 'text', target: 'props', default: '🏠,🔍,🔔,👤' },
      { key: 'active', label: 'Active index', kind: 'number', target: 'props', default: 0 },
      ...COMMON_STYLE_FIELDS
    ]
  },
  {
    type: 'bottomsheet',
    label: 'Bottom sheet',
    icon: '🛋',
    container: true,
    defaultLayout: { w: 390, h: 300 },
    fields: [
      { key: 'title', label: 'Title', kind: 'text', target: 'props', default: '옵션' },
      ...COMMON_STYLE_FIELDS
    ]
  },
  {
    type: 'accordion',
    label: 'Accordion',
    icon: '🪗',
    container: false,
    defaultLayout: { w: 340, h: 168 },
    fields: [
      { key: 'items', label: 'Titles (comma)', kind: 'text', target: 'props', default: '섹션 1,섹션 2,섹션 3' },
      { key: 'openIndex', label: 'Open index', kind: 'number', target: 'props', default: 0 },
      ...COMMON_STYLE_FIELDS
    ]
  },
  {
    type: 'segmented',
    label: 'Segmented control',
    icon: '⛶',
    container: false,
    defaultLayout: { w: 260, h: 34 },
    fields: [
      { key: 'options', label: 'Options (comma)', kind: 'text', target: 'props', default: '전체,진행중,완료' },
      { key: 'value', label: 'Active index', kind: 'number', target: 'props', default: 0 },
      ...COMMON_STYLE_FIELDS
    ]
  },
  {
    type: 'listitem',
    label: 'List item',
    icon: '☰',
    container: false,
    defaultLayout: { w: 360, h: 56 },
    fields: [
      { key: 'leading', label: 'Leading icon', kind: 'text', target: 'props', default: '👤' },
      { key: 'title', label: 'Title', kind: 'text', target: 'props', default: '제목' },
      { key: 'subtitle', label: 'Subtitle', kind: 'text', target: 'props', default: '부제목' },
      { key: 'trailing', label: 'Trailing', kind: 'text', target: 'props', default: '›' },
      ...COMMON_STYLE_FIELDS
    ]
  },
  {
    type: 'spinner',
    label: 'Spinner / Loading',
    icon: '◌',
    container: false,
    defaultLayout: { w: 40, h: 40 },
    fields: [
      { key: 'color', label: 'Color', kind: 'text', target: 'props', default: '#2563eb' },
      ...COMMON_STYLE_FIELDS
    ]
  },
  {
    type: 'carousel',
    label: 'Carousel',
    icon: '🖼',
    container: false,
    defaultLayout: { w: 320, h: 180 },
    fields: [
      { key: 'label', label: 'Slide label', kind: 'text', target: 'props', default: 'Slide 1' },
      { key: 'count', label: 'Dots', kind: 'number', target: 'props', default: 3 },
      { key: 'active', label: 'Active index', kind: 'number', target: 'props', default: 0 },
      ...COMMON_STYLE_FIELDS
    ]
  },
  {
    type: 'alertcard',
    label: 'Alert / Notice card',
    icon: '📢',
    container: false,
    defaultLayout: { w: 360, h: 72 },
    fields: [
      { key: 'title', label: 'Title', kind: 'text', target: 'props', default: '안내' },
      { key: 'message', label: 'Message', kind: 'text', target: 'props', default: '메시지를 입력하세요' },
      {
        key: 'variant',
        label: 'Variant',
        kind: 'select',
        target: 'props',
        default: 'info',
        options: [
          { label: 'Info', value: 'info' },
          { label: 'Success', value: 'success' },
          { label: 'Warning', value: 'warning' },
          { label: 'Error', value: 'error' }
        ]
      },
      { key: 'closable', label: 'Closable', kind: 'boolean', target: 'props', default: true },
      ...COMMON_STYLE_FIELDS
    ]
  },
  {
    type: 'tabs',
    label: 'Tabs',
    icon: '🗂',
    container: false,
    defaultLayout: { w: 480, h: 40 },
    fields: [
      { key: 'items', label: 'Tabs (comma)', kind: 'text', target: 'props', default: '개요,상세,리뷰' },
      { key: 'active', label: 'Active index', kind: 'number', target: 'props', default: 0 },
      ...COMMON_STYLE_FIELDS
    ]
  },
  {
    type: 'dropdown',
    label: 'Dropdown / Select',
    icon: '▾',
    container: false,
    defaultLayout: { w: 200, h: 40 },
    fields: [
      { key: 'value', label: 'Value', kind: 'text', target: 'props', default: '선택' },
      { key: 'placeholder', label: 'Placeholder', kind: 'text', target: 'props', default: '선택하세요' },
      ...COMMON_STYLE_FIELDS
    ]
  },
  {
    type: 'card',
    label: 'Card',
    icon: '🃏',
    container: true,
    defaultLayout: { w: 320, h: 200 },
    fields: [
      { key: 'title', label: 'Title', kind: 'text', target: 'props', default: '카드 제목' },
      ...COMMON_STYLE_FIELDS
    ]
  },
  {
    type: 'navbar',
    label: 'Top nav bar',
    icon: '🧭',
    container: false,
    defaultLayout: { w: 1280, h: 56 },
    fields: [
      { key: 'brand', label: 'Brand', kind: 'text', target: 'props', default: 'Brand' },
      { key: 'items', label: 'Items (comma)', kind: 'text', target: 'props', default: 'Home,Products,Pricing,About' },
      { key: 'active', label: 'Active index', kind: 'number', target: 'props', default: 0 },
      ...COMMON_STYLE_FIELDS
    ]
  },
  {
    type: 'sidebar',
    label: 'Sidebar menu',
    icon: '▥',
    container: false,
    defaultLayout: { w: 240, h: 600 },
    fields: [
      { key: 'items', label: 'Items (comma)', kind: 'text', target: 'props', default: '대시보드,사용자,설정,로그' },
      { key: 'icons', label: 'Icons (comma)', kind: 'text', target: 'props', default: '📊,👥,⚙️,📄' },
      { key: 'active', label: 'Active index', kind: 'number', target: 'props', default: 0 },
      ...COMMON_STYLE_FIELDS
    ]
  },
  {
    type: 'breadcrumb',
    label: 'Breadcrumb',
    icon: '⋯',
    container: false,
    defaultLayout: { w: 420, h: 28 },
    fields: [
      { key: 'items', label: 'Path (comma)', kind: 'text', target: 'props', default: 'Home,Products,Detail' },
      ...COMMON_STYLE_FIELDS
    ]
  },
  {
    type: 'pagination',
    label: 'Pagination',
    icon: '⏭',
    container: false,
    defaultLayout: { w: 300, h: 36 },
    fields: [
      { key: 'pages', label: 'Pages', kind: 'number', target: 'props', default: 5 },
      { key: 'active', label: 'Active page', kind: 'number', target: 'props', default: 1 },
      ...COMMON_STYLE_FIELDS
    ]
  },
  {
    type: 'menubar',
    label: 'Menu bar',
    icon: '🍔',
    container: false,
    defaultLayout: { w: 1280, h: 32 },
    fields: [
      { key: 'items', label: 'Menus (comma)', kind: 'text', target: 'props', default: 'File,Edit,View,Help' },
      ...COMMON_STYLE_FIELDS
    ]
  },
  {
    type: 'statcard',
    label: 'Stat / KPI card',
    icon: '📈',
    container: false,
    defaultLayout: { w: 220, h: 110 },
    fields: [
      { key: 'label', label: 'Label', kind: 'text', target: 'props', default: '총 매출' },
      { key: 'value', label: 'Value', kind: 'text', target: 'props', default: '₩12.4M' },
      { key: 'delta', label: 'Delta', kind: 'text', target: 'props', default: '+12.5%' },
      ...COMMON_STYLE_FIELDS
    ]
  }
]

/** Palette grouping for the component list. */
export type PrimitiveCategory = 'common' | 'pc' | 'mobile'

const PC_TYPES = new Set(['navbar', 'sidebar', 'breadcrumb', 'pagination', 'menubar', 'statcard'])
const MOBILE_TYPES = new Set([
  'toggle',
  'toast',
  'fab',
  'bottomnav',
  'bottomsheet',
  'segmented',
  'listitem',
  'carousel'
])

/** Which palette group a primitive belongs to (defaults to common). */
export function categoryOf(type: string): PrimitiveCategory {
  if (PC_TYPES.has(type)) return 'pc'
  if (MOBILE_TYPES.has(type)) return 'mobile'
  return 'common'
}

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
