import { computed, defineComponent, h, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useI18n } from '../../i18n'

/**
 * Image with a graceful error `fallback` and an optional click-to-zoom preview
 * overlay (a `role="dialog"` lightbox dismissed by backdrop, close button, or
 * Escape). Lazy-loaded by default.
 */
export const IrisImage = defineComponent({
  name: 'IrisImage',
  inheritAttrs: false,
  props: {
    src: { type: String, required: true },
    alt: { type: String, default: '' },
    width: { type: [Number, String], default: undefined },
    height: { type: [Number, String], default: undefined },
    /** Shown when the image fails to load. */
    fallback: { type: String, default: undefined },
    /** Enable the click-to-zoom preview overlay. */
    preview: { type: Boolean, default: true },
  },
  setup(props, { attrs }) {
    const { t } = useI18n()
    const errored = ref(false)
    const open = ref(false)

    watch(
      () => props.src,
      () => {
        errored.value = false
      },
    )

    const onKey = (e: KeyboardEvent) => {
      if (open.value && e.key === 'Escape') open.value = false
    }
    onMounted(() => document.addEventListener('keydown', onKey))
    onBeforeUnmount(() => document.removeEventListener('keydown', onKey))

    const shownSrc = computed(() => (errored.value && props.fallback ? props.fallback : props.src))
    const canPreview = computed(() => props.preview && !errored.value)

    return () => {
      const nodes = [
        h('img', {
          ...attrs,
          'data-iris-image': '',
          'data-errored': errored.value ? 'true' : undefined,
          src: shownSrc.value,
          alt: props.alt,
          width: props.width,
          height: props.height,
          loading: 'lazy',
          onError: () => {
            if (!errored.value) errored.value = true
          },
          onClick: () => {
            if (canPreview.value) open.value = true
          },
          style: {
            display: 'inline-block',
            objectFit: 'cover',
            cursor: canPreview.value ? 'zoom-in' : undefined,
            ...((attrs.style as Record<string, string> | undefined) ?? {}),
          },
        }),
      ]

      if (open.value) {
        nodes.push(
          h(
            'div',
            {
              'data-iris-image-preview': '',
              role: 'dialog',
              'aria-modal': 'true',
              'aria-label': props.alt || t('image.preview'),
              onClick: () => {
                open.value = false
              },
              style: {
                position: 'fixed',
                inset: '0',
                zIndex: '1000',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'rgba(0,0,0,0.7)',
                cursor: 'zoom-out',
              },
            },
            [
              h('img', {
                'data-iris-image-preview-img': '',
                src: shownSrc.value,
                alt: props.alt,
                style: { maxWidth: '90vw', maxHeight: '90vh', objectFit: 'contain' },
              }),
              h(
                'button',
                {
                  type: 'button',
                  'data-iris-image-preview-close': '',
                  'aria-label': t('dialog.close'),
                  onClick: (e: MouseEvent) => {
                    e.stopPropagation()
                    open.value = false
                  },
                  style: {
                    position: 'absolute',
                    insetBlockStart: '16px',
                    insetInlineEnd: '16px',
                    width: '36px',
                    height: '36px',
                    borderRadius: '50%',
                    border: 'none',
                    background: 'rgba(0,0,0,0.5)',
                    color: 'var(--iris-primary-foreground, #fff)',
                    fontSize: 'var(--iris-font-size-2xl, 20px)',
                    lineHeight: '1',
                    cursor: 'pointer',
                  },
                },
                '×',
              ),
            ],
          ),
        )
      }

      return nodes
    }
  },
})
