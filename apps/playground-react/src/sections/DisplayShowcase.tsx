import { useState } from 'react'
import {
  IrisBadge,
  IrisAvatar,
  IrisSpinner,
  IrisSkeleton,
  IrisProgress,
  IrisAlert,
  IrisBanner,
  IrisChip,
  IrisKbd,
  IrisCard,
  IrisDivider,
  IrisEmptyState,
  IrisButton,
} from '@iris-ui-kit/react'

export function DisplayShowcase() {
  const [progress, setProgress] = useState(35)
  const [bannerOpen, setBannerOpen] = useState(true)

  return (
    <section className="section">
      <h2 className="section-title">Display Primitives</h2>

      <div className="row">
        <span className="row-label">badge</span>
        <IrisBadge>Default</IrisBadge>
        <IrisBadge tone="primary">Primary</IrisBadge>
        <IrisBadge tone="success">Success</IrisBadge>
        <IrisBadge tone="warning">Warning</IrisBadge>
        <IrisBadge tone="danger">Danger</IrisBadge>
      </div>

      <div className="row">
        <span className="row-label">avatar</span>
        <IrisAvatar size="sm" fallback="JS" />
        <IrisAvatar size="md" fallback="MC" />
        <IrisAvatar size="lg" fallback="LL" />
      </div>

      <div className="row">
        <span className="row-label">spinner</span>
        <IrisSpinner size="sm" />
        <IrisSpinner size="md" />
        <IrisSpinner size="lg" />
      </div>

      <div className="row">
        <span className="row-label">progress</span>
        <div style={{ flex: 1, minWidth: 200 }}>
          <IrisProgress value={progress} />
        </div>
        <IrisButton
          size="sm"
          variant="ghost"
          onClick={() => setProgress((p) => Math.max(0, p - 10))}
        >
          −10
        </IrisButton>
        <IrisButton
          size="sm"
          variant="ghost"
          onClick={() => setProgress((p) => Math.min(100, p + 10))}
        >
          +10
        </IrisButton>
        <span style={{ fontSize: 12, color: 'var(--iris-muted)' }}>{progress}%</span>
      </div>

      <div className="row" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
        <span className="row-label">skeleton</span>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <IrisSkeleton shape="circle" width={40} height={40} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>
            <IrisSkeleton height={14} />
            <IrisSkeleton height={14} style={{ width: '60%' }} />
          </div>
        </div>
      </div>

      <div className="row" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
        <span className="row-label">alert</span>
        <IrisAlert tone="info" title="Heads up">
          This is an info alert.
        </IrisAlert>
        <IrisAlert tone="success" title="Saved" closable />
        <IrisAlert tone="warning" title="Watch out">
          Disk space is low.
        </IrisAlert>
        <IrisAlert tone="danger" title="Error">
          Something went wrong.
        </IrisAlert>
      </div>

      <div className="row" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
        <span className="row-label">banner</span>
        <IrisBanner open={bannerOpen} tone="info" closable onOpenChange={setBannerOpen}>
          Site-wide announcement — banners are edge-to-edge.
        </IrisBanner>
        {!bannerOpen ? (
          <IrisButton size="sm" variant="outline" onClick={() => setBannerOpen(true)}>
            Show banner
          </IrisButton>
        ) : null}
      </div>

      <div className="row">
        <span className="row-label">chip</span>
        <IrisChip>plain</IrisChip>
        <IrisChip tone="primary" closable>
          react
        </IrisChip>
        <IrisChip tone="success">vue</IrisChip>
        <IrisChip tone="warning" closable>
          typescript
        </IrisChip>
      </div>

      <div className="row">
        <span className="row-label">kbd</span>
        <IrisKbd>⌘</IrisKbd>
        <IrisKbd>K</IrisKbd>
        <span style={{ color: 'var(--iris-muted)' }}>opens command palette</span>
      </div>

      <div className="row">
        <span className="row-label">card</span>
        <IrisCard style={{ maxWidth: 280 }}>
          <h3 style={{ margin: '0 0 6px 0', fontSize: 14 }}>A card</h3>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--iris-muted)' }}>
            Cards are simple surfaces with token-driven padding + border.
          </p>
        </IrisCard>
      </div>

      <div className="row" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
        <span className="row-label">divider</span>
        <IrisDivider />
        <IrisDivider label="OR" />
      </div>

      <div className="row" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
        <span className="row-label">empty</span>
        <IrisEmptyState
          title="No items yet"
          description="Add your first item to get started."
          action={<IrisButton variant="solid">Add item</IrisButton>}
        />
      </div>
    </section>
  )
}
