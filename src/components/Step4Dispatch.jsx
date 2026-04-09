import { useState } from 'react'
import ContextStrip from './ContextStrip.jsx'
import { DENSITY_WS, CLUSTER_WS, TIER_META, ROUTE_META } from './Step2Discovery.jsx'

const STRATEGY_POOLS = { density: DENSITY_WS, clusters: CLUSTER_WS }

const STRATEGY_META = {
  density:  { label: 'Density Fill' },
  clusters: { label: 'High-Potential Clusters' },
}

const CHANNEL_LABELS = { traditional: 'Traditional', modern: 'Modern' }

function getMissionMinutes(stores) {
  const travel = stores.reduce((sum, s) => sum + s.distance, 0) / 1000 * 6
  const dwell  = stores.length * 8
  return Math.round(travel + dwell)
}

function fmtHours(mins) {
  if (mins < 60) return `${mins} min`
  const h = (mins / 60).toFixed(1)
  return `+${h} hrs`
}

function getStoresInReach(pool, tierFilter, routeFilter, routeDeviation) {
  return pool.filter(s =>
    tierFilter.includes(s.tier) &&
    routeFilter.includes(s.route) &&
    s.distance <= routeDeviation
  )
}

function buildPhases(cycleWeeks) {
  const w = cycleWeeks
  return {
    1: {
      label:     'Phase 1: First Drop',
      timeline:  w === 1 ? 'Week 1' : `Weeks 1–${w}`,
      badge:     '1',
      color:     'var(--ne-attention)',
      bg:        'rgba(212,137,10,0.1)',
      directive: 'Get the shelf. One product, minimum facing. Introduce yourself and leave the door open — don\'t oversell on the first visit.',
    },
    2: {
      label:     'Phase 2: Re-order',
      timeline:  w === 1 ? 'Week 2' : `Weeks ${w + 1}–${w * 2}`,
      badge:     '2',
      color:     'var(--ne-text-secondary)',
      bg:        'var(--ne-surface-base)',
      directive: 'Reinforce the relationship. Validate shelf placement, compare rotation to neighboring accounts. Introduce a second SKU if reception was positive.',
    },
    3: {
      label:     'Phase 3: Active Account',
      timeline:  w === 1 ? 'Week 3+' : `Week ${w * 2 + 1}+`,
      badge:     '3',
      color:     'var(--ne-text)',
      bg:        'var(--ne-yellow)',
      directive: 'Account active. Move to standard route coverage.',
    },
  }
}

function getOpeningArgument(strategy, channel, avgPotential) {
  const ch = channel === 'modern' ? 'modern trade' : 'traditional'
  if (strategy === 'density') {
    return `Similar ${ch} accounts in this micro-zone generate an average of +${avgPotential} UC/week. These stores are steps from your active route and currently unserved — you have a clear first-mover window before this territory is contested.`
  }
  return `Volume benchmarks show +${avgPotential} UC/week against similar active accounts in the same micro-zone. These are the highest-ceiling unserved stores in the city. The volume opportunity is confirmed — the question is whether you move first.`
}

const MARGIN = 0.255

function buildWhatsAppText(active, meta, totalPotential, monthlyRevenue, assignedRoutes, missionMins) {
  const lines = [
    `📋 *Hunting Brief — ${meta.label}*`,
    ``,
    `🎯 Target Accounts: ${active.length}`,
    `📦 Volume Potential: +${totalPotential} UC/wk`,
    `💵 Monthly Revenue (at conversion): $${monthlyRevenue.toFixed(0)}`,
    `⏱ Est. Mission Time: ${fmtHours(missionMins)}/wk`,
    ``,
    `*Routes Assigned:*`,
    ...assignedRoutes.map(r => `• ${r.route} — ${r.supervisor}`),
    ``,
    `*Accounts:*`,
    ...active.map(s => `• ${s.name} (+${s.potential} UC/wk)`),
    ``,
    `Rule of 3: 3 confirmed orders to activate. Good hunting.`,
  ]
  return encodeURIComponent(lines.join('\n'))
}

export default function Step4Dispatch({
  city, channel, strategy,
  tierFilter, routeFilter, routeDeviation, persistence,
  excludedStores, setExcludedStores, onBack,
}) {
  const [dispatched, setDispatched] = useState(false)

  const meta        = STRATEGY_META[strategy] || STRATEGY_META.density
  const pool        = STRATEGY_POOLS[strategy] || []
  const stores      = getStoresInReach(pool, tierFilter, routeFilter, routeDeviation)
                        .sort((a, b) => b.potential - a.potential)
  const cycleWeeks  = persistence || 3
  const PHASES      = buildPhases(cycleWeeks)

  const active         = stores.filter(s => !excludedStores.includes(s.id))
  const totalPotential = active.reduce((s, s2) => s + s2.potential, 0)
  const monthlyRevenue = totalPotential * MARGIN * 4
  const avgPotential   = Math.round(totalPotential / (active.length || 1))
  const missionMins    = getMissionMinutes(active)

  const assignedRoutes = [...new Set(active.map(s => s.route))]
    .map(r => ({ route: r, supervisor: ROUTE_META[r]?.supervisor || '—' }))
    .sort((a, b) => a.route.localeCompare(b.route))

  const opening  = getOpeningArgument(strategy, channel, avgPotential)
  const waText   = buildWhatsAppText(active, meta, totalPotential, monthlyRevenue, assignedRoutes, missionMins)

  function toggleExclude(id) {
    setExcludedStores(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  // ── Post-dispatch: Journey Tracker ──────────────────────────────────────────
  if (dispatched) {
    return (
      <div style={{ maxWidth: 900, margin: '0 auto', padding: '48px 32px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 32 }}>
          <div style={{
            width: 48, height: 48, background: 'var(--ne-yellow)', border: '2px solid var(--ne-text)',
            borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
              <polyline points="4,11 9,16 18,7" stroke="var(--ne-text)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <div>
            <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--ne-text)', letterSpacing: '-0.01em', fontFamily: 'var(--ka-font-heading)' }}>Mission Dispatched</div>
            <div style={{ fontSize: 13, color: 'var(--ne-text-secondary)', marginTop: 2 }}>
              {active.length} accounts · {meta.label} · All at Phase 1
            </div>
          </div>
        </div>

        <div style={{ background: 'var(--ne-surface-card)', border: '1px solid var(--ne-border)', borderRadius: 'var(--ka-radius-lg)', overflow: 'hidden', marginBottom: 20, boxShadow: 'var(--ne-shadow-rest)' }}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--ne-border)', background: 'var(--ne-surface-base)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ne-text)' }}>Account Progress</div>
            <div style={{ fontSize: 12, color: 'var(--ne-text-muted)' }}>Updated per route cycle</div>
          </div>

          <div style={{
            display: 'grid', gridTemplateColumns: '1fr 140px 200px 1fr',
            padding: '8px 20px', borderBottom: '1px solid var(--ne-border)',
          }}>
            {['Account', 'Strategy', 'Current Status', 'Next Action'].map(h => (
              <div key={h} style={{ fontSize: 10, fontWeight: 600, color: 'var(--ne-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</div>
            ))}
          </div>

          {active.map((store, i) => {
            const phase = PHASES[1]
            return (
              <div key={store.id} style={{
                display: 'grid', gridTemplateColumns: '1fr 140px 200px 1fr',
                padding: '13px 20px', borderTop: i > 0 ? '1px solid var(--ne-border)' : undefined,
                alignItems: 'center',
              }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ne-text)' }}>{store.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--ne-text-muted)', marginTop: 2 }}>+{store.potential} UC/wk potential</div>
                </div>
                <div style={{ fontSize: 12, color: 'var(--ne-text)', fontWeight: 600 }}>{meta.label}</div>
                <div>
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', gap: 5,
                    padding: '3px 10px', borderRadius: 20,
                    background: phase.bg, fontSize: 11, fontWeight: 600, color: phase.color,
                  }}>
                    {phase.badge} {phase.label}
                  </span>
                </div>
                <div style={{ fontSize: 12, color: 'var(--ne-text-secondary)', lineHeight: 1.5 }}>{phase.directive}</div>
              </div>
            )
          })}
        </div>

        <div style={{ fontSize: 12, color: 'var(--ne-text-muted)', lineHeight: 1.6 }}>
          Status updates when orders are confirmed. An account becomes active after 3 consecutive confirmed orders and moves to standard route coverage.
        </div>
      </div>
    )
  }

  // ── Pre-dispatch: Hunting Brief ──────────────────────────────────────────────
  const card = { background: 'var(--ne-surface-card)', border: '1px solid var(--ne-border)', borderRadius: 'var(--ka-radius-lg)', boxShadow: 'var(--ne-shadow-rest)' }

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto' }}>

      {/* Sticky header */}
      <div style={{
        position: 'sticky', top: 56, zIndex: 40,
        background: 'var(--ne-surface-base)', paddingBottom: 12, marginBottom: 4,
        borderBottom: '1px solid var(--ne-border)',
      }}>
        <div style={{ padding: '16px 32px 0', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--ne-text-muted)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 6 }}>
              Step 4 — Dispatch
            </div>
            <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--ne-text)', letterSpacing: '-0.02em', margin: 0, fontFamily: 'var(--ka-font-heading)' }}>
              Hunting Brief
            </h1>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', paddingTop: 4, flexShrink: 0 }}>
            <button onClick={onBack} style={{
              background: 'transparent', color: 'var(--ne-text-secondary)',
              border: '1px solid var(--ne-border)', borderRadius: 'var(--ka-radius)',
              padding: '8px 14px', fontSize: 13, cursor: 'pointer',
              fontFamily: 'var(--ka-font-body)',
            }}>
              ← Back
            </button>
            <button
              onClick={() => window.print()}
              style={{
                background: 'transparent', color: 'var(--ne-text-secondary)',
                border: '1px solid var(--ne-border)', borderRadius: 'var(--ka-radius)',
                padding: '8px 14px', fontSize: 13, cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 6,
                fontFamily: 'var(--ka-font-body)',
              }}
            >
              <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                <rect x="1" y="4" width="11" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.2" />
                <path d="M3.5 4V2.5A.5.5 0 0 1 4 2h5a.5.5 0 0 1 .5.5V4" stroke="currentColor" strokeWidth="1.2" />
                <path d="M3.5 9h6M3.5 11h4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
              </svg>
              Print Brief
            </button>
            <a
              href={`https://wa.me/?text=${waText}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                background: '#25D366', color: '#FFFFFF',
                border: 'none', borderRadius: 'var(--ka-radius)',
                padding: '8px 14px', fontSize: 13, cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 6,
                textDecoration: 'none', fontWeight: 600,
                fontFamily: 'var(--ka-font-body)',
              }}
            >
              <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                <path d="M6.5 1C3.46 1 1 3.46 1 6.5c0 .97.26 1.88.7 2.67L1 12l2.95-.67A5.49 5.49 0 0 0 6.5 12C9.54 12 12 9.54 12 6.5S9.54 1 6.5 1Z" stroke="white" strokeWidth="1.2" />
                <path d="M4.5 5.5c.1.5.4 1 .9 1.5.5.5 1 .8 1.5.9l.5-.5c.1-.1.3-.1.4 0l1 1c.1.1.1.3 0 .4-.3.3-.7.7-1.1.7-1 0-3-2-3-3 0-.4.4-.8.7-1.1.1-.1.3-.1.4 0l1 1c.1.1.1.3 0 .4l-.3.7Z" fill="white" />
              </svg>
              Share
            </a>
          </div>
        </div>
        <div style={{ padding: '8px 32px 0' }}>
          <ContextStrip city={city} channel={channel} strategy={strategy} />
        </div>
      </div>

      {/* Mission value bar — dark surface */}
      <div style={{
        margin: '0 32px 20px', padding: '18px 24px',
        background: 'var(--ne-surface-dark)', borderRadius: 'var(--ka-radius-lg)',
        display: 'flex', gap: 0, alignItems: 'stretch', flexWrap: 'wrap',
      }}>
        {[
          { label: 'Target Accounts',               value: active.length,               unit: null },
          { label: 'Volume Potential',               value: `+${totalPotential}`,        unit: 'UC/wk' },
          { label: 'Monthly Revenue When Converted', value: `$${monthlyRevenue.toFixed(0)}`, unit: null },
          { label: 'Est. Mission Time',              value: fmtHours(missionMins),       unit: '/wk' },
          { label: 'To Activate an Account',         value: '3',                         unit: 'confirmed orders' },
        ].map((kpi, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'stretch' }}>
            {i > 0 && <div style={{ width: 1, background: 'rgba(255,255,255,0.1)', margin: '0 28px', alignSelf: 'stretch' }} />}
            <div>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>{kpi.label}</div>
              <div style={{ fontSize: 28, fontWeight: 800, color: '#FFFFFF', lineHeight: 1, fontFamily: 'var(--ka-font-heading)' }}>
                {kpi.value}
                {kpi.unit && <span style={{ fontSize: 13, fontWeight: 400, color: 'rgba(255,255,255,0.45)', marginLeft: 4 }}>{kpi.unit}</span>}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* 2-col grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '45% 1fr', gap: 20, padding: '0 32px 48px', alignItems: 'start' }}>

        {/* LEFT — Assigned routes + Opening argument + phase reference */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Assigned Routes */}
          <div style={{ ...card, padding: '16px 20px' }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--ne-text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>
              Assigned To
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {assignedRoutes.map(({ route, supervisor }) => (
                <div key={route} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{
                      width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                      background: 'var(--ne-surface-base)', border: '1px solid var(--ne-border)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                        <circle cx="6" cy="4" r="2.2" stroke="var(--ne-text)" strokeWidth="1.2" />
                        <path d="M2 10c0-2.2 1.8-4 4-4s4 1.8 4 4" stroke="var(--ne-text)" strokeWidth="1.2" strokeLinecap="round" />
                      </svg>
                    </div>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ne-text)' }}>{supervisor}</div>
                      <div style={{ fontSize: 10.5, color: 'var(--ne-text-muted)' }}>{route}</div>
                    </div>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--ne-text-muted)' }}>
                    {active.filter(s => s.route === route).length} accounts
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Opening Argument — violet left border = system-derived content */}
          <div style={{ ...card, borderLeft: '3px solid var(--ne-violet)', padding: '20px 22px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--ne-text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                Opening Argument
              </div>
              <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--ne-violet)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>AI-Generated</span>
            </div>
            <div style={{ fontSize: 14, color: 'var(--ne-text)', lineHeight: 1.65, fontStyle: 'italic' }}>
              "{opening}"
            </div>
            <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--ne-border)', fontSize: 12, color: 'var(--ne-text-muted)' }}>
              Based on volume benchmarks against similar active accounts in the same micro-zones · {CHANNEL_LABELS[channel] || channel}
            </div>
          </div>

          {/* Rep Instructions by Phase */}
          <div style={{ ...card, padding: '20px 22px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--ne-text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                Rep Instructions by Phase
              </div>
              <div style={{ fontSize: 10, color: 'var(--ne-text-muted)', background: 'var(--ne-surface-base)', borderRadius: 4, padding: '2px 7px' }}>
                {cycleWeeks}-week cycle
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {[1, 2, 3].map(n => {
                const ph = PHASES[n]
                const isYellow = n === 3
                return (
                  <div key={n} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                    <span style={{
                      flexShrink: 0, width: 28, height: 28, borderRadius: '50%',
                      background: ph.bg, border: `1px solid ${isYellow ? 'var(--ne-text)' : 'var(--ne-border)'}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 11, fontWeight: 800, color: isYellow ? 'var(--ne-text)' : ph.color,
                    }}>{n}</span>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ne-text)' }}>{ph.label}</div>
                        <div style={{ fontSize: 10, color: 'var(--ne-text-muted)', background: 'var(--ne-surface-base)', borderRadius: 3, padding: '1px 6px' }}>{ph.timeline}</div>
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--ne-text-secondary)', lineHeight: 1.55 }}>{ph.directive}</div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* RIGHT — Target stores + CTA */}
        <div>
          <div style={{ ...card, overflow: 'hidden', marginBottom: 14 }}>
            <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--ne-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ne-text)' }}>Target Accounts</div>
              <div style={{ fontSize: 12, color: 'var(--ne-text-muted)' }}>
                {active.length} of {stores.length} included · Uncheck to remove
              </div>
            </div>

            {stores.map((store, i) => {
              const excluded = excludedStores.includes(store.id)
              const rep      = ROUTE_META[store.route]?.supervisor
              return (
                <div
                  key={store.id}
                  onClick={() => toggleExclude(store.id)}
                  style={{
                    padding: '11px 20px', borderTop: i > 0 ? '1px solid var(--ne-border)' : undefined,
                    display: 'flex', alignItems: 'center', gap: 12,
                    opacity: excluded ? 0.4 : 1, cursor: 'pointer',
                    transition: 'opacity var(--ne-ease-color)',
                  }}
                >
                  <div style={{
                    width: 16, height: 16, borderRadius: 3, flexShrink: 0,
                    border: `1px solid ${!excluded ? 'var(--ne-text)' : 'var(--ne-border)'}`,
                    background: !excluded ? 'var(--ne-text)' : 'var(--ne-surface-card)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'all var(--ne-ease-color)',
                  }}>
                    {!excluded && (
                      <svg width="9" height="9" viewBox="0 0 9 9" fill="none">
                        <polyline points="1.5,4.5 3.5,6.5 7.5,2.5" stroke="#FFFFFF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </div>

                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, color: 'var(--ne-text)', fontWeight: 500, textDecoration: excluded ? 'line-through' : 'none' }}>
                      {store.name}
                    </div>
                    {rep && <div style={{ fontSize: 10.5, color: 'var(--ne-text-muted)', marginTop: 1 }}>{store.route} · {rep}</div>}
                  </div>

                  <div style={{ fontSize: 12, fontWeight: 700, color: excluded ? 'var(--ne-text-muted)' : 'var(--ne-violet)', flexShrink: 0 }}>
                    +{store.potential} UC/wk
                  </div>
                </div>
              )
            })}

            <div style={{ padding: '12px 20px', borderTop: '1px solid var(--ne-border)', background: 'var(--ne-surface-base)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: 12, color: 'var(--ne-text-muted)' }}>
                {excludedStores.filter(id => stores.some(s => s.id === id)).length > 0
                  ? `${excludedStores.filter(id => stores.some(s => s.id === id)).length} account(s) removed`
                  : 'All accounts included'}
              </div>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ne-text)' }}>
                +{totalPotential} UC/wk confirmed
              </div>
            </div>
          </div>

          <button
            onClick={() => setDispatched(true)}
            disabled={active.length === 0}
            style={{
              width: '100%',
              background: active.length > 0 ? 'var(--ne-yellow)' : 'var(--ne-surface-base)',
              color: active.length > 0 ? 'var(--ne-text)' : 'var(--ne-text-muted)',
              fontWeight: 700, padding: '14px', borderRadius: 'var(--ka-radius-pill)',
              border: 'none', cursor: active.length > 0 ? 'pointer' : 'not-allowed',
              fontSize: 14, marginBottom: 10,
              fontFamily: 'var(--ka-font-body)',
              transition: 'background var(--ne-ease-color)',
            }}
          >
            Dispatch Hunting Mission →
          </button>
          <button style={{
            width: '100%', background: 'transparent', color: 'var(--ne-text-secondary)',
            border: '1px solid var(--ne-border)', borderRadius: 'var(--ka-radius)',
            padding: '11px', fontSize: 13, cursor: 'pointer',
            fontFamily: 'var(--ka-font-body)',
          }}>
            Save as Draft
          </button>
        </div>
      </div>

      <style>{`
        @media print {
          body > *:not(#root) { display: none; }
          nav, [data-noprint] { display: none !important; }
          .sticky { position: static !important; }
        }
      `}</style>
    </div>
  )
}
