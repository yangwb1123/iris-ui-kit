import * as React from 'react'
import { useI18n } from '../../i18n'

export interface IrisImageProps {
  src: string
  alt?: string
  width?: number | string
  height?: number | string
  /** Shown when the image fails to load. */
  fallback?: string
  /** Enable the click-to-zoom preview overlay. Default true. */
  preview?: boolean
  style?: React.CSSProperties
  className?: string
}

/**
 * Image with a graceful error `fallback` and an optional click-to-zoom preview
 * overlay (a `role="dialog"` lightbox dismissed by backdrop, close button, or
 * Escape). Lazy-loaded by default.
 *
 * React port of {@link import('@iris-ui-kit/vue').IrisImage}.
 */
export function IrisImage({
  src,
  alt = '',
  width,
  height,
  fallback,
  preview = true,
  style,
  className,
  ...rest
}: IrisImageProps): React.ReactElement {
  const { t } = useI18n()
  const [errored, setErrored] = React.useState(false)
  const [open, setOpen] = React.useState(false)

  React.useEffect(() => {
    setErrored(false)
  }, [src])

  React.useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])

  const shownSrc = errored && fallback ? fallback : src
  const canPreview = preview && !errored

  return (
    <>
      <img
        data-iris-image=""
        data-errored={errored ? 'true' : undefined}
        src={shownSrc}
        alt={alt}
        width={width}
        height={height}
        loading="lazy"
        className={className}
        {...rest}
        onError={() => {
          if (!errored) setErrored(true)
        }}
        onClick={() => {
          if (canPreview) setOpen(true)
        }}
        style={{
          display: 'inline-block',
          objectFit: 'cover',
          cursor: canPreview ? 'zoom-in' : undefined,
          ...style,
        }}
      />
      {open ? (
        <div
          data-iris-image-preview=""
          role="dialog"
          aria-modal="true"
          aria-label={alt || t('image.preview')}
          onClick={() => setOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(0,0,0,0.7)',
            cursor: 'zoom-out',
          }}
        >
          <img
            data-iris-image-preview-img=""
            src={shownSrc}
            alt={alt}
            style={{ maxWidth: '90vw', maxHeight: '90vh', objectFit: 'contain' }}
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
              insetBlockStart: 16,
              insetInlineEnd: 16,
              width: 36,
              height: 36,
              borderRadius: '50%',
              border: 'none',
              background: 'rgba(0,0,0,0.5)',
              color: '#fff',
              fontSize: 22,
              lineHeight: 1,
              cursor: 'pointer',
            }}
          >
            ×
          </button>
        </div>
      ) : null}
    </>
  )
}
