import { useState } from 'react'
import {
  IrisButton,
  IrisDialog,
  IrisDialogTrigger,
  IrisDialogContent,
  IrisDialogTitle,
  IrisDialogDescription,
  IrisDialogClose,
  IrisDrawer,
  IrisDrawerContent,
  IrisDrawerTitle,
  IrisDrawerClose,
  IrisMenu,
  IrisMenuTrigger,
  IrisMenuContent,
  IrisMenuItem,
  IrisMenuSub,
  IrisPopover,
  IrisPopoverTrigger,
  IrisPopoverContent,
  IrisTooltip,
  useToast,
  IrisKbd,
  IrisCommandPalette,
} from '@iris-ui-kit/react'

const SIDES = ['left', 'right', 'top', 'bottom'] as const
type Side = (typeof SIDES)[number]

// 10k generated commands — the `virtual` toggle proves the palette stays
// fluid while only a ~20-row window is mounted.
const PALETTE_ITEMS = Array.from({ length: 10_000 }, (_, i) => ({
  id: `cmd-${i}`,
  label: `Command ${i}`,
  group: `Group ${Math.floor(i / 500)}`,
  shortcut: i % 200 === 0 ? `⌘${((i / 200) % 9) + 1}` : undefined,
  ...(i === 3 ? { disabled: true } : {}),
}))

export function OverlayShowcase() {
  const [dialogOpen, setDialogOpen] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [drawerSide, setDrawerSide] = useState<Side>('right')
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [paletteVirtual, setPaletteVirtual] = useState(false)
  const toast = useToast()

  return (
    <section className="section">
      <h2 className="section-title">Overlay Components</h2>

      <div className="row">
        <span className="row-label">dialog</span>
        <IrisDialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <IrisDialogTrigger asChild>
            <IrisButton variant="outline">Open dialog</IrisButton>
          </IrisDialogTrigger>
          <IrisDialogContent>
            <IrisDialogTitle>Confirm action</IrisDialogTitle>
            <IrisDialogDescription>
              Focus is trapped inside, body scroll is locked, and Escape / backdrop click both
              dismiss.
            </IrisDialogDescription>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
              <IrisDialogClose asChild>
                <IrisButton variant="ghost">Cancel</IrisButton>
              </IrisDialogClose>
              <IrisDialogClose asChild>
                <IrisButton variant="solid">Confirm</IrisButton>
              </IrisDialogClose>
            </div>
          </IrisDialogContent>
        </IrisDialog>
      </div>

      <div className="row">
        <span className="row-label">drawer</span>
        {SIDES.map((s) => (
          <IrisButton
            key={s}
            size="sm"
            variant="outline"
            onClick={() => {
              setDrawerSide(s)
              setDrawerOpen(true)
            }}
          >
            from {s}
          </IrisButton>
        ))}
        <IrisDrawer open={drawerOpen} onOpenChange={setDrawerOpen} side={drawerSide}>
          <IrisDrawerContent>
            <IrisDrawerTitle>Settings</IrisDrawerTitle>
            <div style={{ padding: 16 }}>
              <p style={{ margin: '0 0 12px 0' }}>
                Drawer opened from <strong>{drawerSide}</strong>.
              </p>
              <IrisDrawerClose asChild>
                <IrisButton variant="ghost">Close</IrisButton>
              </IrisDrawerClose>
            </div>
          </IrisDrawerContent>
        </IrisDrawer>
      </div>

      <div className="row">
        <span className="row-label">menu</span>
        <IrisMenu>
          <IrisMenuTrigger asChild>
            <IrisButton variant="outline">Actions ▾</IrisButton>
          </IrisMenuTrigger>
          <IrisMenuContent>
            <IrisMenuItem onSelect={() => toast.info({ title: 'Cut' })}>Cut</IrisMenuItem>
            <IrisMenuItem onSelect={() => toast.info({ title: 'Copy' })}>Copy</IrisMenuItem>
            <IrisMenuItem onSelect={() => toast.info({ title: 'Paste' })}>Paste</IrisMenuItem>
            <IrisMenuSub label="More…">
              <IrisMenuItem onSelect={() => toast.info({ title: 'Paste Special' })}>
                Paste Special
              </IrisMenuItem>
              <IrisMenuItem onSelect={() => toast.info({ title: 'Paste From History' })}>
                Paste From History
              </IrisMenuItem>
            </IrisMenuSub>
          </IrisMenuContent>
        </IrisMenu>
      </div>

      <div className="row">
        <span className="row-label">popover</span>
        <IrisPopover>
          <IrisPopoverTrigger asChild>
            <IrisButton variant="outline">Open popover</IrisButton>
          </IrisPopoverTrigger>
          <IrisPopoverContent>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 220 }}>
              <strong>Popover</strong>
              <p style={{ margin: 0, color: 'var(--iris-muted)', fontSize: 13 }}>
                Floating UI handles positioning. Click outside or press Escape to close.
              </p>
            </div>
          </IrisPopoverContent>
        </IrisPopover>
      </div>

      <div className="row">
        <span className="row-label">tooltip</span>
        <IrisTooltip content="Save changes (⌘S)">
          <IrisButton variant="outline">Hover me</IrisButton>
        </IrisTooltip>
        <IrisTooltip content="Right-side tip" placement="right">
          <IrisButton variant="outline">Right</IrisButton>
        </IrisTooltip>
      </div>

      <div className="row">
        <span className="row-label">toast</span>
        <IrisButton size="sm" variant="outline" onClick={() => toast.info({ title: 'Hello' })}>
          info
        </IrisButton>
        <IrisButton size="sm" variant="outline" onClick={() => toast.success({ title: 'Saved!' })}>
          success
        </IrisButton>
        <IrisButton
          size="sm"
          variant="outline"
          onClick={() => toast.warning({ title: 'Heads up' })}
        >
          warning
        </IrisButton>
        <IrisButton
          size="sm"
          variant="outline"
          onClick={() => toast.error({ title: 'Failed', description: 'Network error.' })}
        >
          error
        </IrisButton>
        <IrisButton
          size="sm"
          variant="ghost"
          onClick={() =>
            toast.push({
              title: 'Undo me?',
              action: { label: 'Undo', onClick: () => toast.success({ title: 'Undone' }) },
              duration: 6000,
            })
          }
        >
          with action
        </IrisButton>
      </div>

      <div className="row">
        <span className="row-label">command palette</span>
        <IrisButton size="sm" variant="outline" onClick={() => setPaletteOpen(true)}>
          Open palette (10k items)
        </IrisButton>
        <label
          style={{
            fontSize: 13,
            color: 'var(--iris-muted)',
            display: 'flex',
            gap: 6,
            alignItems: 'center',
          }}
        >
          <input
            type="checkbox"
            checked={paletteVirtual}
            onChange={(e) => setPaletteVirtual(e.target.checked)}
          />
          virtual
        </label>
        <IrisCommandPalette
          open={paletteOpen}
          onOpenChange={setPaletteOpen}
          items={PALETTE_ITEMS}
          virtual={paletteVirtual}
          onSelect={(item) => toast.info({ title: `Picked: ${item.label}` })}
        />
      </div>

      <div className="row">
        <span className="row-label">hint</span>
        <span style={{ fontSize: 13, color: 'var(--iris-muted)' }}>
          <IrisKbd>⌘</IrisKbd>+<IrisKbd>K</IrisKbd> (wire your own shortcut — the palette does not
          register one) · <IrisKbd>↑</IrisKbd>/<IrisKbd>↓</IrisKbd> navigate,{' '}
          <IrisKbd>Enter</IrisKbd> picks, <IrisKbd>Esc</IrisKbd> dismisses
        </span>
      </div>
    </section>
  )
}
