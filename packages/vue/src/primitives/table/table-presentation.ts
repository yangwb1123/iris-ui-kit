import { h, type ExtractPropTypes, type Ref, type VNode } from 'vue'
import type { UseI18nReturn } from '../../i18n'
import { renderImportPreviewSection } from './import-preview'
import { tableProps } from './props'
import type { IrisTableDensity } from './types'

type TableRuntimeProps = Readonly<ExtractPropTypes<typeof tableProps>>
type TableRow = Record<string, unknown>
type Translate = UseI18nReturn['t']

export interface TablePresentationContext {
  props: TableRuntimeProps
  attrs: Record<string, unknown>
  rootRef: Ref<HTMLElement | null>
  treeMode: boolean
  columnFadeActive: boolean
  effectiveDensity: IrisTableDensity
  responsiveOverflow: boolean
  scrollLeft: Ref<number>
  handleRootKeyDown: (event: KeyboardEvent) => void
  handleRowDragPointerMove: (event: PointerEvent) => void
  handleColDragPointerMove: (event: PointerEvent) => void
  handleRowDragPointerUp: () => void
  handleColDragPointerUp: () => void
  handleRowDragPointerLeave: () => void
  renderTabs: (tabs: TableRuntimeProps['tableTabs']) => VNode | null
  renderViews: () => VNode | null
  buildFormSection: () => VNode | null
  buildToolbarSection: () => VNode | null
  activeCellRange: () => unknown
  copyActiveRange: () => void
  importPreviewRows: readonly TableRow[] | null
  t: Translate
  onConfirmImportPreview: () => void
  onCancelImportPreview: () => void
  headerRow: VNode
  bodyNode: VNode
  summaryRow: VNode | null
  buildPagerSection: () => VNode | null
  buildBackTopSection: () => VNode | null
  buildContextMenuSection: () => VNode | null
  buildPinMenuSection: () => VNode | null
  buildFilterPanelSection: () => VNode | null
  buildAuditPanelSection: () => VNode | null
}

/** Compose the table surface with its surrounding Vue adapter chrome. */
export function renderTablePresentation(ctx: TablePresentationContext): VNode | VNode[] {
  const rootNodes = [
    ctx.renderTabs(ctx.props.tableTabs),
    ctx.renderViews(),
    ctx.buildFormSection(),
    ctx.buildToolbarSection(),
    ctx.props.clipConfig && ctx.props.clipConfig.copy !== false && ctx.activeCellRange()
      ? h(
          'button',
          { type: 'button', 'data-iris-table-range-copy': '', onClick: ctx.copyActiveRange },
          ctx.t('table.range.copy'),
        )
      : null,
    renderImportPreviewSection({
      rows: ctx.importPreviewRows,
      t: ctx.t,
      onConfirm: ctx.onConfirmImportPreview,
      onCancel: ctx.onCancelImportPreview,
    }),
    h(
      'div',
      {
        ...ctx.attrs,
        ref: (el: unknown) => {
          ctx.rootRef.value = (el ?? null) as HTMLElement | null
        },
        role: ctx.props.keyboardNavigation ? (ctx.treeMode ? 'treegrid' : 'grid') : 'table',
        'data-iris-table': '',
        'data-iris-column-fade-active': ctx.columnFadeActive ? 'true' : undefined,
        'data-density': ctx.effectiveDensity,
        'data-printable': ctx.props.printable ? 'true' : undefined,
        'data-virtual': ctx.props.virtualScroll ? '' : undefined,
        'data-column-virtualized': ctx.props.columnVirtualization ? 'true' : undefined,
        onKeydown:
          ctx.props.keyboardNavigation || ctx.props.cellRange || ctx.props.clipConfig
            ? (e: KeyboardEvent) => ctx.handleRootKeyDown(e)
            : undefined,
        onScroll: ctx.props.columnVirtualization
          ? (e: Event) => {
              ctx.scrollLeft.value = (e.currentTarget as HTMLElement).scrollLeft
            }
          : undefined,
        onPointermove:
          ctx.props.rowDrag || ctx.props.columnDrag
            ? (e: PointerEvent) => {
                ctx.handleRowDragPointerMove(e)
                ctx.handleColDragPointerMove(e)
              }
            : undefined,
        onPointerup:
          ctx.props.rowDrag || ctx.props.columnDrag
            ? () => {
                ctx.handleRowDragPointerUp()
                ctx.handleColDragPointerUp()
              }
            : undefined,
        onPointerleave: ctx.props.rowDrag ? ctx.handleRowDragPointerLeave : undefined,
        style: {
          background: 'var(--iris-background)',
          color: 'var(--iris-foreground)',
          fontSize: 'var(--iris-font-size-md, 14px)',
          border: ctx.props.bordered ? '1px solid var(--iris-border)' : 'none',
          borderRadius: 'var(--iris-radius-md)',
          overflow: ctx.props.columnVirtualization || ctx.responsiveOverflow ? 'auto' : 'hidden',
          ...(ctx.responsiveOverflow ? { overflowX: 'auto' } : {}),
          ...((ctx.attrs.style as Record<string, string> | undefined) ?? {}),
        },
      },
      [
        ctx.headerRow,
        ctx.bodyNode,
        ctx.summaryRow,
        ctx.buildPagerSection(),
        ctx.buildBackTopSection(),
      ],
    ),
    ctx.props.responsive && ctx.responsiveOverflow && !ctx.props.printable
      ? h(
          'div',
          {
            'data-iris-scroll-hint': '',
            role: 'status',
            'aria-live': 'polite',
            style: {
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--iris-space-xxs, 4px)',
              padding: 'var(--iris-space-xxs, 4px) var(--iris-space-sm, 12px)',
              color: 'var(--iris-muted)',
              background: 'var(--iris-surface)',
              borderInline: '1px solid var(--iris-border)',
              borderBottom: '1px solid var(--iris-border)',
              fontSize: 'var(--iris-font-size-sm, 13px)',
            },
          },
          [h('span', { 'aria-hidden': 'true' }, '⇆'), h('span', ctx.t('table.scrollHint'))],
        )
      : null,
    ctx.buildContextMenuSection(),
    ctx.buildPinMenuSection(),
    ctx.buildFilterPanelSection(),
    ctx.buildAuditPanelSection(),
  ].filter((node): node is VNode => node !== null)

  return rootNodes.length === 1 ? rootNodes[0] : rootNodes
}
