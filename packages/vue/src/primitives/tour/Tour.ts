import { defineComponent, h, onBeforeUnmount, onMounted, ref, watch, type PropType } from 'vue'
import { useI18n } from '../../i18n'

export interface IrisTourStep {
  target?: () => HTMLElement | null
  title?: string
  description?: string
}

interface Rect {
  top: number
  left: number
  width: number
  height: number
}

const btnBase: Record<string, string> = {
  padding: '4px 12px',
  fontSize: '13px',
  borderRadius: 'var(--iris-radius-sm, 4px)',
  cursor: 'pointer',
}
const btnGhost: Record<string, string> = {
  ...btnBase,
  border: '1px solid var(--iris-border)',
  background: 'transparent',
  color: 'var(--iris-foreground)',
}
const btnPrimary: Record<string, string> = {
  ...btnBase,
  border: 'none',
  background: 'var(--iris-primary)',
  color: '#fff',
}

/**
 * Guided tour: an overlay that walks the user through `steps`, spotlighting an
 * optional target per step and showing a dialog card with prev/next/skip
 * controls. Visibility is `v-model:open`; the step index is managed internally
 * and resets each time the tour opens.
 */
export const IrisTour = defineComponent({
  name: 'IrisTour',
  inheritAttrs: false,
  props: {
    steps: { type: Array as PropType<IrisTourStep[]>, default: () => [] },
    open: { type: Boolean, default: false },
  },
  emits: {
    'update:open': (_open: boolean) => true,
    change: (_index: number) => true,
    close: () => true,
    finish: () => true,
  },
  setup(props, { attrs, emit }) {
    const { t } = useI18n()
    const step = ref(0)
    const spotlight = ref<Rect | null>(null)

    const computeSpotlight = () => {
      const data = props.steps[step.value]
      const el = data?.target?.()
      if (el) {
        const r = el.getBoundingClientRect()
        spotlight.value = { top: r.top, left: r.left, width: r.width, height: r.height }
      } else {
        spotlight.value = null
      }
    }

    watch(
      () => props.open,
      (o) => {
        if (o) {
          step.value = 0
          computeSpotlight()
        }
      },
      { immediate: true },
    )
    watch(step, computeSpotlight)

    const close = () => {
      emit('update:open', false)
      emit('close')
    }
    const onKey = (e: KeyboardEvent) => {
      if (props.open && e.key === 'Escape') close()
    }
    onMounted(() => document.addEventListener('keydown', onKey))
    onBeforeUnmount(() => document.removeEventListener('keydown', onKey))

    return () => {
      const total = props.steps.length
      if (!props.open || total === 0) return null
      const current = Math.min(step.value, total - 1)
      const data = props.steps[current]
      if (!data) return null
      const isLast = current === total - 1

      const next = () => {
        if (!isLast) {
          step.value = current + 1
          emit('change', current + 1)
        } else {
          emit('finish')
          close()
        }
      }
      const prev = () => {
        if (current > 0) {
          step.value = current - 1
          emit('change', current - 1)
        }
      }

      const sl = spotlight.value
      const spotlit = !!sl && sl.width > 0
      const cardPos: Record<string, string> =
        spotlit && sl
          ? { top: `${sl.top + sl.height + 12}px`, insetInlineStart: `${sl.left}px` }
          : { top: '50%', insetInlineStart: '50%', transform: 'translate(-50%, -50%)' }
      const dialogLabel = data.title ?? t('tour.step', { current: current + 1, total })

      return h('div', { ...attrs, 'data-iris-tour': '' }, [
        h('div', {
          'data-iris-tour-backdrop': '',
          onClick: close,
          style: { position: 'fixed', inset: '0', background: 'rgba(0,0,0,0.45)', zIndex: '1000' },
        }),
        spotlit && sl
          ? h('div', {
              'data-iris-tour-spotlight': '',
              style: {
                position: 'fixed',
                top: `${sl.top - 4}px`,
                insetInlineStart: `${sl.left - 4}px`,
                width: `${sl.width + 8}px`,
                height: `${sl.height + 8}px`,
                border: '2px solid var(--iris-primary)',
                borderRadius: 'var(--iris-radius-sm, 4px)',
                boxShadow: '0 0 0 9999px rgba(0,0,0,0.45)',
                zIndex: '1001',
                pointerEvents: 'none',
              },
            })
          : null,
        h(
          'div',
          {
            'data-iris-tour-card': '',
            role: 'dialog',
            'aria-modal': 'true',
            'aria-label': dialogLabel,
            style: {
              position: 'fixed',
              zIndex: '1002',
              maxWidth: '320px',
              padding: '16px',
              background: 'var(--iris-background)',
              border: '1px solid var(--iris-border)',
              borderRadius: 'var(--iris-radius-md, 6px)',
              boxShadow: '0 8px 24px rgba(0,0,0,0.18)',
              ...cardPos,
            },
          },
          [
            data.title != null
              ? h(
                  'div',
                  {
                    'data-iris-tour-title': '',
                    style: { fontWeight: '600', marginBlockEnd: '6px' },
                  },
                  data.title,
                )
              : null,
            data.description != null
              ? h(
                  'div',
                  {
                    'data-iris-tour-description': '',
                    style: {
                      fontSize: '14px',
                      color: 'var(--iris-foreground)',
                      marginBlockEnd: '12px',
                    },
                  },
                  data.description,
                )
              : null,
            h(
              'div',
              {
                style: {
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '8px',
                },
              },
              [
                h(
                  'span',
                  {
                    'data-iris-tour-indicator': '',
                    style: { fontSize: '12px', color: 'var(--iris-muted)' },
                  },
                  t('tour.step', { current: current + 1, total }),
                ),
                h('div', { style: { display: 'flex', gap: '8px' } }, [
                  h(
                    'button',
                    { type: 'button', 'data-iris-tour-skip': '', onClick: close, style: btnGhost },
                    t('tour.skip'),
                  ),
                  current > 0
                    ? h(
                        'button',
                        {
                          type: 'button',
                          'data-iris-tour-prev': '',
                          onClick: prev,
                          style: btnGhost,
                        },
                        t('tour.prev'),
                      )
                    : null,
                  h(
                    'button',
                    { type: 'button', 'data-iris-tour-next': '', onClick: next, style: btnPrimary },
                    isLast ? t('tour.finish') : t('tour.next'),
                  ),
                ]),
              ],
            ),
          ],
        ),
      ])
    }
  },
})
