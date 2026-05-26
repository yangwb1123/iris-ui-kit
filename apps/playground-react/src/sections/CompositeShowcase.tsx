import { useState } from 'react'
import {
  IrisTabs,
  IrisTabsList,
  IrisTabsTrigger,
  IrisTabsContent,
  IrisAccordion,
  IrisAccordionItem,
  IrisStepper,
  IrisStepperStep,
  IrisToggleGroup,
  IrisToggleGroupItem,
  IrisPagination,
  IrisBreadcrumb,
  IrisBreadcrumbItem,
  IrisButton,
} from '@iris-ui/react'

export function CompositeShowcase() {
  const [tab, setTab] = useState('overview')
  const [openSections, setOpenSections] = useState<string[]>(['intro'])
  const [step, setStep] = useState(0)
  const [align, setAlign] = useState<string | null>('left')
  const [styles, setStyles] = useState<string[]>(['bold'])
  const [page, setPage] = useState(3)

  return (
    <section className="section">
      <h2 className="section-title">Composite Components</h2>

      <div className="row" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
        <span className="row-label">tabs</span>
        <IrisTabs value={tab} onValueChange={setTab}>
          <IrisTabsList>
            <IrisTabsTrigger value="overview">Overview</IrisTabsTrigger>
            <IrisTabsTrigger value="usage">Usage</IrisTabsTrigger>
            <IrisTabsTrigger value="api" disabled>
              API (disabled)
            </IrisTabsTrigger>
            <IrisTabsTrigger value="changelog">Changelog</IrisTabsTrigger>
          </IrisTabsList>
          <IrisTabsContent value="overview">
            <p style={{ margin: '12px 0', color: 'var(--iris-muted)' }}>
              Overview panel. Roving tabindex + arrow-key nav built in.
            </p>
          </IrisTabsContent>
          <IrisTabsContent value="usage">
            <p style={{ margin: '12px 0', color: 'var(--iris-muted)' }}>
              Usage panel. Lazy-mounts by default.
            </p>
          </IrisTabsContent>
          <IrisTabsContent value="changelog">
            <p style={{ margin: '12px 0', color: 'var(--iris-muted)' }}>Changelog panel.</p>
          </IrisTabsContent>
        </IrisTabs>
      </div>

      <div className="row" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
        <span className="row-label">accordion</span>
        <IrisAccordion value={openSections} onValueChange={(v) => setOpenSections(v as string[])} multiple>
          <IrisAccordionItem value="intro" title="What is Iris UI?">
            A token-driven component library with separated state/UI/theme.
          </IrisAccordionItem>
          <IrisAccordionItem value="why" title="Why a 5-layer architecture?">
            Each layer has a single responsibility — easy to swap or compose.
          </IrisAccordionItem>
          <IrisAccordionItem value="status" title="Production-ready?">
            Vue + React adapters are at parity; 1300+ tests pass on every commit.
          </IrisAccordionItem>
        </IrisAccordion>
      </div>

      <div className="row" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
        <span className="row-label">stepper</span>
        <IrisStepper value={step} onValueChange={setStep}>
          <IrisStepperStep title="Account" />
          <IrisStepperStep title="Profile" />
          <IrisStepperStep title="Preferences" />
          <IrisStepperStep title="Review" />
        </IrisStepper>
        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <IrisButton
            size="sm"
            variant="ghost"
            disabled={step === 0}
            onClick={() => setStep((s) => Math.max(0, s - 1))}
          >
            Back
          </IrisButton>
          <IrisButton
            size="sm"
            variant="solid"
            disabled={step === 3}
            onClick={() => setStep((s) => Math.min(3, s + 1))}
          >
            Next
          </IrisButton>
        </div>
      </div>

      <div className="row" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
        <span className="row-label">toggle-group</span>
        <div>
          <p style={{ margin: '0 0 6px 0', fontSize: 12, color: 'var(--iris-muted)' }}>
            single (radio-like) — text align
          </p>
          <IrisToggleGroup type="single" value={align} onValueChange={setAlign}>
            <IrisToggleGroupItem value="left">Left</IrisToggleGroupItem>
            <IrisToggleGroupItem value="center">Center</IrisToggleGroupItem>
            <IrisToggleGroupItem value="right">Right</IrisToggleGroupItem>
          </IrisToggleGroup>
        </div>
        <div>
          <p style={{ margin: '8px 0 6px 0', fontSize: 12, color: 'var(--iris-muted)' }}>
            multiple (toggle-like) — text style
          </p>
          <IrisToggleGroup type="multiple" value={styles} onValueChange={setStyles}>
            <IrisToggleGroupItem value="bold">B</IrisToggleGroupItem>
            <IrisToggleGroupItem value="italic">I</IrisToggleGroupItem>
            <IrisToggleGroupItem value="underline">U</IrisToggleGroupItem>
          </IrisToggleGroup>
        </div>
      </div>

      <div className="row" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
        <span className="row-label">pagination</span>
        <IrisPagination value={page} onValueChange={setPage} total={200} pageSize={10} showFirstLast />
        <span style={{ fontSize: 12, color: 'var(--iris-muted)' }}>page → {page}</span>
      </div>

      <div className="row">
        <span className="row-label">breadcrumb</span>
        <IrisBreadcrumb>
          <IrisBreadcrumbItem href="/">Home</IrisBreadcrumbItem>
          <IrisBreadcrumbItem href="/docs">Docs</IrisBreadcrumbItem>
          <IrisBreadcrumbItem href="/docs/primitives">Primitives</IrisBreadcrumbItem>
          <IrisBreadcrumbItem>Breadcrumb</IrisBreadcrumbItem>
        </IrisBreadcrumb>
      </div>
    </section>
  )
}
