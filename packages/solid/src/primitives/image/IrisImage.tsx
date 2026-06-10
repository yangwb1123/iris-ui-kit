import { createSignal, mergeProps, Show, splitProps, type JSX } from 'solid-js'
import { useI18n } from '../../i18n'

export interface IrisImageProps extends Omit<
  JSX.ImgHTMLAttributes<HTMLImageElement>,
  'src' | 'alt'
> {
  src: string
  alt?: string
  width?: number | string
  height?: number | string
  /** Shown when the image fails to load. */
  fallback?: string
  /** Enable the click-to-zoom preview overlay. */
  preview?: boolean
}

/**
 * Image with graceful error fallback and optional click-to-zoom preview overlay.
 * Lazy-loaded by default.
 */
export function IrisImage(props: IrisImageProps): JSX.Element {
  const merged = mergeProps({ alt: '', preview: true }, props)
  const [local, rest] = splitProps(merged, [
    'src',
    'alt',
    'width',
    'height',
    'fallback',
    'preview',
    'style',
  ])

  const { t } = useI18n()

  const [errored, setErrored] = createSignal(false)
  const [open, setOpen] = createSignal(false)

  const shownSrc = () => (errored() && local.fallback ? local.fallback : local.src)
  const canPreview = () => local.preview && !errored()

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') setOpen(false)
  }

  return (
    <>
      <img
        {...rest}
        data-iris-image=""
        data-errored={errored() ? 'true' : undefined}
        src={shownSrc()}
        alt={local.alt}
        width={local.width}
        height={local.height}
        loading="lazy"
        onError={() => {
          if (!errored()) setErrored(true)
        }}
        onClick={() => {
          if (canPreview()) setOpen(true)
        }}
        style={{
          display: 'inline-block',
          'object-fit': 'cover',
          cursor: canPreview() ? 'zoom-in' : undefined,
          ...((local.style as JSX.CSSProperties) ?? {}),
        }}
      />
      <Show when={open()}>
        <div
          data-iris-image-preview=""
          role="dialog"
          aria-modal="true"
          aria-label={local.alt || t('image.preview')}
          onClick={() => setOpen(false)}
          onKeyDown={onKeyDown}
          style={{
            position: 'fixed',
            inset: '0',
            'z-index': '1000',
            display: 'flex',
            'align-items': 'center',
            'justify-content': 'center',
            background: 'rgba(0,0,0,0.7)',
            cursor: 'zoom-out',
          }}
        >
          <img
            data-iris-image-preview-img=""
            src={shownSrc()}
            alt={local.alt}
            style={{ 'max-width': '90vw', 'max-height': '90vh', 'object-fit': 'contain' }}
          />
          <button
            type="button"
            data-iris-image-preview-close=""
            aria-label={t('dialog.close')}
            onClick={(e) => {
              e.stopPropagation()
              setOpen(false)
            }}
            style={{
              position: 'absolute',
              'inset-block-start': '16px',
              'inset-inline-end': '16px',
              width: '36px',
              height: '36px',
              'border-radius': '50%',
              border: 'none',
              background: 'rgba(0,0,0,0.5)',
              color: '#fff',
              'font-size': '22px',
              'line-height': '1',
              cursor: 'pointer',
            }}
          >
            ×
          </button>
        </div>
      </Show>
    </>
  )
}
