import { useState, useRef, useEffect } from 'react'

const CITIES = [
  { id: 'monterrey',   label: 'Monterrey' },
  { id: 'cdmx',        label: 'Ciudad de México' },
  { id: 'guadalajara', label: 'Guadalajara' },
  { id: 'puebla',      label: 'Puebla' },
  { id: 'tijuana',     label: 'Tijuana' },
]

const CHANNELS = [
  { id: 'traditional', label: 'Traditional' },
  { id: 'modern',      label: 'Modern' },
]

const UNIVERSE = {
  monterrey:   { count: 347,  potential: 4200 },
  cdmx:        { count: 1284, potential: 15800 },
  guadalajara: { count: 523,  potential: 6400 },
  puebla:      { count: 298,  potential: 3600 },
  tijuana:     { count: 187,  potential: 2300 },
}

const selectStyle = (active) => ({
  width: '100%', padding: '10px 14px',
  background: 'var(--ne-surface-card)',
  border: `1px solid ${active ? 'var(--ne-border-active)' : 'var(--ne-border)'}`,
  borderRadius: 12, fontSize: 14,
  color: 'var(--ne-text)',
  cursor: 'pointer', outline: 'none',
  appearance: 'auto',
  fontFamily: 'var(--ka-font-body)',
  transition: 'border-color var(--ne-ease-color)',
})

function ScanningDot() {
  return (
    <div style={{ position: 'relative', width: 7, height: 7, flexShrink: 0 }}>
      <div style={{
        position: 'absolute', inset: 0, borderRadius: '50%',
        background: 'var(--ne-text-muted)',
      }} />
      <div style={{
        position: 'absolute', inset: -3, borderRadius: '50%',
        border: '1.5px solid var(--ne-text-muted)',
        animation: 'scanPulse 1.1s ease-out infinite',
        opacity: 0,
      }} />
    </div>
  )
}

function Shimmer({ width, height }) {
  return (
    <div style={{
      width, height, borderRadius: 4,
      background: 'linear-gradient(90deg, var(--ne-border) 25%, var(--ne-surface-base) 50%, var(--ne-border) 75%)',
      backgroundSize: '200% 100%',
      animation: 'shimmer 1.2s infinite',
    }} />
  )
}

export default function Step1Intent({ city, setCity, channel, setChannel, onNext }) {
  const [phase, setPhase] = useState('idle')
  const ctaRef   = useRef(null)
  const canScan  = city && channel
  const universe = city ? UNIVERSE[city] : null

  function handleCityChange(val) { setCity(val || null); setPhase('idle') }
  function handleChannelChange(val) { setChannel(val || null); setPhase('idle') }

  function handleScan() {
    setPhase('scanning')
    setTimeout(() => setPhase('revealed'), 1800)
  }

  useEffect(() => {
    if (phase !== 'revealed') return
    const frame = requestAnimationFrame(() => {
      ctaRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
    })
    return () => cancelAnimationFrame(frame)
  }, [phase])

  return (
    <div style={{
      minHeight: 'calc(100vh - 56px)',
      background: 'radial-gradient(ellipse at 30% 0%, #E0E7FF 0%, #F7F9FB 50%, #F7F9FB 100%)',
    }}>
    <div style={{ maxWidth: 680, margin: '0 auto', padding: '52px 32px 80px', position: 'relative' }}>

      {/* Subtle lilac wash behind mission card zone — depth, not decoration */}
      <div style={{
        position: 'absolute', top: 120, left: '50%', transform: 'translateX(-50%)',
        width: 500, height: 260, borderRadius: '50%',
        background: 'var(--ne-violet-wash)',
        opacity: 0.45, filter: 'blur(80px)',
        pointerEvents: 'none',
      }} />

      {/* Header */}
      <div style={{ marginBottom: 40, position: 'relative' }}>
        <div style={{
          fontSize: 11, fontWeight: 600, color: 'var(--ne-text-muted)',
          letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 10,
        }}>
          Step 1 — Intent
        </div>
        <h1 style={{
          fontSize: 32, fontWeight: 600, margin: '0 0 10px',
          color: 'var(--ne-text)', lineHeight: 1.1,
          fontFamily: 'var(--ka-font-heading)',
        }}>
          Define your territory
        </h1>
        <p style={{ color: 'var(--ne-text-secondary)', fontSize: 15, margin: 0, lineHeight: 1.6 }}>
          The system will cross-reference your active POS against external market data to surface unserved white spaces.
        </p>
      </div>

      {/* Mission card */}
      <div style={{ marginBottom: 32, position: 'relative' }}>
        <div style={{
          fontSize: 11, fontWeight: 600, color: 'var(--ne-text-muted)',
          letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 10,
        }}>
          Mission
        </div>
        <div style={{
          background: '#fff',
          borderRadius: 12, padding: '18px 22px',
          display: 'flex', alignItems: 'flex-start', gap: 14,
          boxShadow: 'var(--ne-shadow-rest)',
        }}>
          <div style={{
            width: 38, height: 38,
            background: 'linear-gradient(135deg, #6366F1 0%, #818CF8 100%)',
            borderRadius: 12, display: 'flex', alignItems: 'center',
            justifyContent: 'center', flexShrink: 0, fontSize: 18,
            color: '#fff',
            boxShadow: '0 4px 12px rgba(99,102,241,0.25)',
          }}>
            ◎
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600, fontSize: 15, color: 'var(--ne-text)', marginBottom: 3 }}>
              Grow Your Account Base
            </div>
            <div style={{ fontSize: 13, color: 'var(--ne-text-secondary)', lineHeight: 1.5 }}>
              Identify and convert white-space accounts in your territory. Build coverage without adding routes.
            </div>
          </div>
          <div style={{
            flexShrink: 0,
            background: 'var(--ne-yellow)',
            color: 'var(--ne-text)',
            fontSize: 10, fontWeight: 700, padding: '4px 10px',
            borderRadius: 100,
            letterSpacing: '0.08em', alignSelf: 'flex-start',
          }}>
            SELECTED
          </div>
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 32, position: 'relative' }}>
        <div>
          <label style={{
            display: 'block', fontSize: 11, fontWeight: 600,
            color: 'var(--ne-text-secondary)', marginBottom: 8,
            textTransform: 'uppercase', letterSpacing: '0.08em',
          }}>
            City
          </label>
          <select value={city || ''} onChange={e => handleCityChange(e.target.value)} style={selectStyle(!!city)}>
            <option value="">Select city...</option>
            {CITIES.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
          </select>
        </div>
        <div>
          <label style={{
            display: 'block', fontSize: 11, fontWeight: 600,
            color: 'var(--ne-text-secondary)', marginBottom: 8,
            textTransform: 'uppercase', letterSpacing: '0.08em',
          }}>
            Channel
          </label>
          <select value={channel || ''} onChange={e => handleChannelChange(e.target.value)} style={selectStyle(!!channel)}>
            <option value="">Select channel...</option>
            {CHANNELS.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
          </select>
        </div>
      </div>

      {/* Universe reveal */}
      {phase === 'scanning' && universe && (
        <div style={{
          background: '#fff',
          borderRadius: 12, padding: '16px 24px', marginBottom: 20,
          boxShadow: 'var(--ne-shadow-rest)',
          display: 'flex', alignItems: 'center', gap: 0,
          animation: 'fadeSlideIn 0.3s ease forwards',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginRight: 20, flexShrink: 0 }}>
            <ScanningDot />
            <span style={{
              fontSize: 10, fontWeight: 700, color: 'var(--ne-text-muted)',
              letterSpacing: '0.08em', textTransform: 'uppercase',
            }}>
              Scanning…
            </span>
          </div>
          <div style={{ width: 1, background: 'var(--ne-border)', alignSelf: 'stretch', marginRight: 20 }} />
          <div style={{ marginRight: 24 }}>
            <div style={{ fontSize: 9.5, color: 'var(--ne-text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 1 }}>Accounts</div>
            <Shimmer width={52} height={24} />
          </div>
          <div style={{ width: 1, background: 'var(--ne-border)', alignSelf: 'stretch', marginRight: 24 }} />
          <div>
            <div style={{ fontSize: 9.5, color: 'var(--ne-text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 1 }}>Volume Opportunity</div>
            <Shimmer width={80} height={24} />
          </div>
        </div>
      )}

      {phase === 'revealed' && universe && (
        <div style={{
          background: 'linear-gradient(141deg, #6366F1 0%, #818CF8 100%)',
          borderRadius: 12, padding: '28px 32px', marginBottom: 20,
          boxShadow: '0 4px 20px rgba(99,102,241,0.3)',
          animation: 'fadeSlideIn 0.3s ease forwards',
          position: 'relative', overflow: 'hidden',
        }}>
          <div style={{
            position: 'absolute', top: -10, right: -10, width: 60, height: 60,
            borderRadius: 30, background: 'rgba(255,255,255,0.08)',
          }} />

          {/* Title */}
          <div style={{
            fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,0.55)',
            letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 20,
          }}>
            Territory Scan Complete
          </div>

          {/* Two KPI columns */}
          <div style={{ display: 'flex', gap: 40, marginBottom: 20 }}>
            <div>
              <div style={{
                fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,0.55)',
                letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 6,
              }}>
                White-Space Accounts Found
              </div>
              <div style={{
                fontSize: 42, fontWeight: 800, color: '#fff', lineHeight: 1,
                letterSpacing: '-0.03em', fontFamily: 'var(--ka-font-heading)',
                animation: 'fadeSlideIn 0.35s ease forwards',
              }}>
                {universe.count.toLocaleString()}
              </div>
            </div>
            <div>
              <div style={{
                fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,0.55)',
                letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 6,
              }}>
                Volume Opportunity
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, animation: 'fadeSlideIn 0.35s ease forwards' }}>
                <span style={{
                  fontSize: 42, fontWeight: 800, color: '#fff', lineHeight: 1,
                  letterSpacing: '-0.03em', fontFamily: 'var(--ka-font-heading)',
                }}>
                  +{universe.potential.toLocaleString()}
                </span>
                <span style={{ fontSize: 14, color: 'rgba(255,255,255,0.5)', fontWeight: 500 }}>UC / month</span>
              </div>
            </div>
          </div>

          {/* Footnote */}
          <div style={{
            borderTop: '1px solid rgba(255,255,255,0.12)', paddingTop: 14,
            fontSize: 12, color: 'rgba(255,255,255,0.45)', lineHeight: 1.5,
          }}>
            Your active accounts are excluded. Opportunity benchmarked against served accounts in the same zones.
          </div>
        </div>
      )}

      {/* CTA */}
      <div ref={ctaRef} style={{ display: 'flex', gap: 12, position: 'relative' }}>
        {phase === 'idle' && (
          <button
            onClick={handleScan}
            disabled={!canScan}
            style={{
              background: canScan ? 'var(--ne-text)' : 'var(--ne-surface-base)',
              color: canScan ? '#fff' : 'var(--ne-text-muted)',
              fontWeight: 600, padding: '11px 32px',
              borderRadius: 100, border: 'none',
              cursor: canScan ? 'pointer' : 'not-allowed',
              fontSize: 14, transition: 'background var(--ne-ease-color)',
            }}
          >
            Scan Territory →
          </button>
        )}
        {phase === 'scanning' && (
          <button disabled style={{
            background: 'var(--ne-surface-base)',
            color: 'var(--ne-text-muted)',
            fontWeight: 600, padding: '11px 32px',
            borderRadius: 100, border: 'none',
            fontSize: 14, cursor: 'not-allowed',
          }}>
            Scanning…
          </button>
        )}
        {phase === 'revealed' && (
          <button
            onClick={onNext}
            style={{
              background: 'var(--ne-text)',
              color: '#fff',
              fontWeight: 600, padding: '11px 32px',
              borderRadius: 100, border: 'none',
              cursor: 'pointer', fontSize: 14,
              animation: 'fadeSlideIn 0.3s ease forwards',
              transition: 'background var(--ne-ease-color)',
            }}
          >
            Choose Strategy →
          </button>
        )}
      </div>

    </div>
    </div>
  )
}
