import { useState } from 'react'
import Step1Intent from './components/Step1Intent.jsx'
import Step2Discovery from './components/Step2Discovery.jsx'
import Step3Calibrate from './components/Step3Calibrate.jsx'
import Step4Dispatch from './components/Step4Dispatch.jsx'

const STEPS = ['Intent', 'Discovery', 'Calibrate', 'Dispatch']

export default function App() {
  const [step, setStep] = useState(1)
  const [city, setCity] = useState(null)
  const [channel, setChannel] = useState(null)
  const [strategy, setStrategy] = useState(null)
  const [tierFilter, setTierFilter] = useState(['gold', 'silver', 'bronze'])
  const [routeFilter, setRouteFilter] = useState(['Route 4', 'Route 2', 'Route 1'])
  const [routeDeviation, setRouteDeviation] = useState(1000)
  const [persistence, setPersistence] = useState(3)
  const [excludedStores, setExcludedStores] = useState([])

  function handleSetStrategy(s) {
    setStrategy(s)
    setExcludedStores([])
    // tier/route filters are set by Step2Discovery.handleSelect based on the chosen pool
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--ka-color-bg-layout)' }}>

      {/* Nav — KA light mode */}
      <div style={{
        position: 'fixed', top: 0, left: 0, right: 0, height: 56,
        background: 'var(--ka-color-bg)',
        borderBottom: '1px solid var(--ka-color-border)',
        display: 'flex', alignItems: 'center', padding: '0 28px',
        justifyContent: 'space-between', zIndex: 100,
      }}>
        {/* Logo — KinLogo informal + product name */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
          {/* KinLogo informal variant (Kin wordmark + hex), dark color */}
          <svg width="45" height="28" viewBox="0 0 210.44 130.56" fill="none" xmlns="http://www.w3.org/2000/svg" aria-label="Kin Analytics">
            <polygon fill="#999ea6" points="151.33 42.99 151.33 59.88 165.96 68.33 180.59 59.88 180.59 42.99 165.96 34.55 151.33 42.99"/>
            <path fill="#141417" d="M120.36,58.79c3.66,0,6.48,1.18,8.38,3.52,1.88,2.31,2.84,5.71,2.84,10.1v24.08h8.87v-24.61c0-7.18-1.68-12.46-4.98-15.68-3.31-3.22-7.65-4.85-12.89-4.85-6.11,0-10.9,2.13-14.23,6.32l-.55.69-1.16-6.49h-7.6v44.61h8.78v-22.48c0-4.69,1.12-8.43,3.33-11.12,2.23-2.72,5.33-4.09,9.22-4.09Z"/>
            <rect fill="#141417" x="83.6" y="51.87" width="8.78" height="44.61"/>
            <rect fill="#141417" x="83.48" y="35.04" width="8.87" height="8.87"/>
            <polygon fill="#141417" points="69.98 96.47 81.34 96.47 61.06 66.49 51.65 66.49 58.34 59.26 79.52 35.19 68.17 35.19 39.12 67.86 39.12 35.19 29.73 35.19 29.73 96.47 39.12 96.47 39.12 80.49 50.39 67.84 69.98 96.47"/>
          </svg>
          <div style={{ width: 1, height: 18, background: 'var(--ka-color-border)' }} />
          <span style={{
            fontFamily: 'var(--ka-font-heading)', fontWeight: 500,
            fontSize: 14, color: 'var(--ka-color-text-secondary)',
          }}>
            Network Expander
          </span>
        </div>

        {/* Step indicators */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {STEPS.map((s, i) => {
            const n = i + 1
            const active = step === n
            const done = step > n
            return (
              <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '4px 10px 4px 6px',
                  borderRadius: 'var(--ka-radius-pill)',
                  background: active ? 'var(--ka-color-primary)' : 'transparent',
                  border: `1px solid ${active ? 'var(--ka-color-primary)' : 'var(--ka-color-border)'}`,
                  transition: 'all 0.2s',
                }}>
                  <div style={{
                    width: 18, height: 18, borderRadius: '50%', flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: active ? 'var(--ka-color-primary-text)' : done ? 'var(--ka-color-success)' : 'var(--ka-color-bg-layout)',
                    fontSize: 9, fontWeight: 700,
                    color: active ? 'var(--ka-color-primary)' : done ? 'var(--ka-color-bg)' : 'var(--ka-color-text-tertiary)',
                  }}>
                    {done ? '✓' : n}
                  </div>
                  <span style={{
                    fontSize: 12, fontWeight: active ? 700 : 500,
                    color: active ? 'var(--ka-color-primary-text)' : done ? 'var(--ka-color-text-secondary)' : 'var(--ka-color-text-tertiary)',
                    fontFamily: 'var(--ka-font-body)',
                  }}>{s}</span>
                </div>
                {i < STEPS.length - 1 && (
                  <div style={{ width: 16, height: 1, background: 'var(--ka-color-border)' }} />
                )}
              </div>
            )
          })}
        </div>

        <div style={{ width: 160 }} />
      </div>

      <div style={{ paddingTop: 56 }}>
        {step === 1 && (
          <Step1Intent
            city={city} setCity={setCity}
            channel={channel} setChannel={setChannel}
            onNext={() => setStep(2)}
          />
        )}
        {step === 2 && (
          <Step2Discovery
            city={city} channel={channel}
            strategy={strategy} setStrategy={handleSetStrategy}
            tierFilter={tierFilter} setTierFilter={setTierFilter}
            routeFilter={routeFilter} setRouteFilter={setRouteFilter}
            onBack={() => setStep(1)}
            onNext={() => setStep(3)}
          />
        )}
        {step === 3 && (
          <Step3Calibrate
            city={city} channel={channel} strategy={strategy}
            tierFilter={tierFilter} routeFilter={routeFilter}
            routeDeviation={routeDeviation} setRouteDeviation={setRouteDeviation}
            persistence={persistence} setPersistence={setPersistence}
            onBack={() => setStep(2)}
            onNext={() => setStep(4)}
          />
        )}
        {step === 4 && (
          <Step4Dispatch
            city={city} channel={channel} strategy={strategy}
            tierFilter={tierFilter} routeFilter={routeFilter}
            routeDeviation={routeDeviation} persistence={persistence}
            excludedStores={excludedStores} setExcludedStores={setExcludedStores}
            onBack={() => setStep(3)}
          />
        )}
      </div>
    </div>
  )
}
