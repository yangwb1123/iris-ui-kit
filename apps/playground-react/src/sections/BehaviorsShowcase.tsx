import { useState } from 'react'
import {
  IrisResizable,
  IrisMovable,
  IrisHotkey,
  IrisClickOutside,
  IrisCard,
  IrisButton,
  useToast,
} from '@iris-ui-kit/react'

export function BehaviorsShowcase() {
  const [showFloating, setShowFloating] = useState(true)
  const toast = useToast()

  return (
    <section className="section">
      <h2 className="section-title">Behaviors Layer</h2>

      <div className="row" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
        <span className="row-label">resizable</span>
        <p style={{ margin: '0 0 8px 0', fontSize: 13, color: 'var(--iris-muted)' }}>
          Drag any edge or corner of the box.
        </p>
        <IrisResizable defaultSize={{ width: 320, height: 180 }} minWidth={120} minHeight={80}>
          <IrisCard style={{ width: '100%', height: '100%', overflow: 'auto', margin: 0 }}>
            <strong>I am resizable.</strong>
            <p style={{ margin: '6px 0 0 0', color: 'var(--iris-muted)', fontSize: 13 }}>
              The card itself doesn't know about resize — `IrisResizable` is a wrapper around it.
            </p>
          </IrisCard>
        </IrisResizable>
      </div>

      <div className="row" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
        <span className="row-label">movable</span>
        <p style={{ margin: '0 0 8px 0', fontSize: 13, color: 'var(--iris-muted)' }}>
          Drag the title bar to move (byHandle mode).
        </p>
        <div
          style={{
            position: 'relative',
            height: 240,
            border: '1px dashed var(--iris-border)',
            borderRadius: 8,
            background: 'var(--iris-background)',
          }}
        >
          <IrisMovable
            defaultPosition={{ x: 20, y: 20 }}
            byHandle
            bounds={{ minX: 0, minY: 0, maxX: 400, maxY: 160 }}
          >
            <IrisCard style={{ width: 240, margin: 0, padding: 0 }}>
              <div
                data-iris-movable-handle
                style={{
                  padding: '8px 12px',
                  background: 'var(--iris-surface-hover)',
                  borderBottom: '1px solid var(--iris-border)',
                  cursor: 'grab',
                  fontSize: 13,
                  fontWeight: 600,
                  userSelect: 'none',
                  borderTopLeftRadius: 8,
                  borderTopRightRadius: 8,
                }}
              >
                ≡ Drag me by this title bar
              </div>
              <div style={{ padding: 14 }}>
                <p style={{ margin: 0, color: 'var(--iris-muted)', fontSize: 13 }}>
                  Body content stays still while you drag the handle.
                </p>
              </div>
            </IrisCard>
          </IrisMovable>
        </div>
      </div>

      <div className="row" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
        <span className="row-label">hotkey</span>
        <p style={{ margin: '0 0 8px 0', fontSize: 13, color: 'var(--iris-muted)' }}>
          Press <code>Esc</code> or <code>⌘/Ctrl + S</code> anywhere on this page.
        </p>
        <IrisHotkey shortcut="Escape" onTrigger={() => toast.info({ title: 'Esc pressed' })}>
          <IrisHotkey
            shortcut="Mod+s"
            onTrigger={(e) => {
              e.preventDefault()
              toast.success({ title: 'Mod+S — Saved' })
            }}
          >
            <div />
          </IrisHotkey>
        </IrisHotkey>
      </div>

      <div className="row" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
        <span className="row-label">click outside</span>
        <p style={{ margin: '0 0 8px 0', fontSize: 13, color: 'var(--iris-muted)' }}>
          Click outside the orange box to dismiss it.
        </p>
        {showFloating ? (
          <IrisClickOutside onOutside={() => setShowFloating(false)}>
            <IrisCard
              style={{
                margin: 0,
                borderColor: 'var(--iris-warning)',
                background: 'color-mix(in srgb, var(--iris-warning) 12%, var(--iris-background))',
                maxWidth: 320,
              }}
            >
              <strong>I'm listening for outside clicks.</strong>
              <p style={{ margin: '6px 0 0 0', color: 'var(--iris-muted)', fontSize: 13 }}>
                Try clicking anywhere outside this card.
              </p>
            </IrisCard>
          </IrisClickOutside>
        ) : (
          <IrisButton size="sm" variant="outline" onClick={() => setShowFloating(true)}>
            Re-show
          </IrisButton>
        )}
      </div>

      <div className="row" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
        <span className="row-label">stacked</span>
        <p style={{ margin: '0 0 8px 0', fontSize: 13, color: 'var(--iris-muted)' }}>
          <code>{`<Resizable><Movable><Hotkey>…`}</code>—the same UI gets resize + move + Esc to log
          without any changes to the child component.
        </p>
        <div
          style={{
            position: 'relative',
            height: 280,
            border: '1px dashed var(--iris-border)',
            borderRadius: 8,
            background: 'var(--iris-background)',
          }}
        >
          <IrisMovable
            defaultPosition={{ x: 30, y: 30 }}
            byHandle
            bounds={{ minX: 0, minY: 0, maxX: 380, maxY: 180 }}
          >
            <IrisHotkey
              shortcut="Escape"
              onTrigger={() => toast.info({ title: 'Esc captured by stacked panel' })}
            >
              <IrisResizable
                defaultSize={{ width: 240, height: 140 }}
                minWidth={150}
                minHeight={100}
              >
                <IrisCard style={{ margin: 0, padding: 0, width: '100%', height: '100%' }}>
                  <div
                    data-iris-movable-handle
                    style={{
                      padding: '8px 12px',
                      background: 'var(--iris-surface-hover)',
                      borderBottom: '1px solid var(--iris-border)',
                      cursor: 'grab',
                      fontSize: 13,
                      fontWeight: 600,
                      userSelect: 'none',
                    }}
                  >
                    ≡ Stacked panel
                  </div>
                  <div style={{ padding: 12, fontSize: 12, color: 'var(--iris-muted)' }}>
                    Drag the bar to move · drag edges to resize · press Esc to log.
                  </div>
                </IrisCard>
              </IrisResizable>
            </IrisHotkey>
          </IrisMovable>
        </div>
      </div>
    </section>
  )
}
