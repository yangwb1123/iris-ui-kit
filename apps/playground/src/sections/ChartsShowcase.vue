<template>
  <div style="display: flex; flex-direction: column; gap: 24px">
    <section class="section">
      <h2 class="section-title">Charts</h2>
      <p style="color: var(--iris-muted); font-size: 14px; margin: 0 0 16px">
        Token-themed SVG charts from <code>@iris-ui/plugin-charts</code>. Charts inherit the active
        theme via CSS variables — try switching skins.
      </p>

      <div
        style="
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
          gap: 16px;
        "
      >
        <div class="card" style="padding: 16px">
          <div style="font-weight: 600; font-size: 14px; margin-bottom: 8px">Line Chart</div>
          <IrisLineChart :data="lineData" :width="320" :height="150" area />
        </div>

        <div class="card" style="padding: 16px">
          <div style="font-weight: 600; font-size: 14px; margin-bottom: 8px">Bar Chart</div>
          <IrisBarChart :data="barData" :width="320" :height="150" />
        </div>

        <div class="card" style="padding: 16px">
          <div style="font-weight: 600; font-size: 14px; margin-bottom: 8px">Sparkline</div>
          <div style="font-size: 24px; font-weight: 700; font-variant-numeric: tabular-nums">
            {{ lineData[lineData.length - 1]?.toFixed(1) }}
            <span style="font-size: 14px; color: var(--iris-muted); margin-inline-start: 8px">
              {{ lineData[lineData.length - 1]! > lineData[0]! ? '▲' : '▼' }}
            </span>
          </div>
          <IrisSparkline :data="lineData" :width="320" :height="50" />
        </div>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { IrisLineChart, IrisBarChart, IrisSparkline } from '@iris-ui/plugin-charts/vue'

function randomData(count: number): number[] {
  let val = 50
  const data: number[] = []
  for (let i = 0; i < count; i++) {
    val += Math.random() * 10 - 5
    data.push(Math.max(0, val))
  }
  return data
}

const lineData = randomData(30)
const barData = [62, 85, 43, 91, 58]
</script>
