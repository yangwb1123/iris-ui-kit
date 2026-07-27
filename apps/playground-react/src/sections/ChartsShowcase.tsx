import { useState } from 'react'
import { IrisLineChart, IrisBarChart, IrisSparkline } from '@iris-ui-kit/plugin-charts/react'
import { IrisButton, IrisCard } from '@iris-ui-kit/react'

function generateRandomData(count: number): number[] {
  let val = 50
  const data: number[] = []
  for (let i = 0; i < count; i++) {
    val += Math.random() * 10 - 5
    data.push(Math.max(0, val))
  }
  return data
}

export function ChartsShowcase() {
  const [data, setData] = useState(() => generateRandomData(30))
  const [barData, setBarData] = useState(() => [
    Math.round(Math.random() * 100),
    Math.round(Math.random() * 100),
    Math.round(Math.random() * 100),
    Math.round(Math.random() * 100),
    Math.round(Math.random() * 100),
  ])

  const refresh = () => {
    setData(generateRandomData(30))
    setBarData([
      Math.round(Math.random() * 100),
      Math.round(Math.random() * 100),
      Math.round(Math.random() * 100),
      Math.round(Math.random() * 100),
      Math.round(Math.random() * 100),
    ])
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <section className="section">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
          <h2 className="section-title" style={{ margin: 0 }}>
            Charts
          </h2>
          <IrisButton size="sm" variant="outline" onClick={refresh}>
            Regenerate Data
          </IrisButton>
        </div>
        <p style={{ color: 'var(--iris-muted)', fontSize: 14, margin: '0 0 16px' }}>
          Zero-dependency, token-themed SVG charts from <code>@iris-ui-kit/plugin-charts</code>.
          Charts inherit the active theme via CSS variables — try switching skins above.
        </p>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
            gap: 16,
          }}
        >
          <IrisCard style={{ padding: 16 }}>
            <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 8 }}>Line Chart</div>
            <IrisLineChart data={data} width={320} height={150} area />
          </IrisCard>

          <IrisCard style={{ padding: 16 }}>
            <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 8 }}>Bar Chart</div>
            <IrisBarChart data={barData} width={320} height={150} />
          </IrisCard>

          <IrisCard style={{ padding: 16 }}>
            <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 8 }}>Sparkline</div>
            <div style={{ fontSize: 24, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
              {data[data.length - 1]?.toFixed(1)}
              <span style={{ fontSize: 14, color: 'var(--iris-muted)', marginInlineStart: 8 }}>
                {data[data.length - 1]! > data[0]! ? '▲' : '▼'}
              </span>
            </div>
            <IrisSparkline data={data} width={320} height={50} />
          </IrisCard>

          <IrisCard style={{ padding: 16 }}>
            <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 8 }}>Line (no fill)</div>
            <IrisLineChart data={data.slice(-15)} width={320} height={120} />
          </IrisCard>
        </div>
      </section>
    </div>
  )
}
