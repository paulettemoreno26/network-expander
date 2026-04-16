import { useState } from 'react'
import ContextStrip from './ContextStrip.jsx'
import { DENSITY_WS, CLUSTER_WS, TIER_META, ROUTE_META, CATEGORY_META, STRATEGY_CONFIG } from './Step2Discovery.jsx'

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

function getStoresInReach(pool, strategy, tierFilter, routeFilter, routeDeviation, businessCategory, waysOfReaching) {
  const isDensity = strategy === 'density'
  const phoneOnly = !isDensity && waysOfReaching?.length === 1 && waysOfReaching?.includes('phone')
  return pool.filter(s => {
    if (!tierFilter.includes(s.tier)) return false
    if (businessCategory?.length > 0 && !businessCategory.includes(s.category)) return false
    if (isDensity) {
      if (!routeFilter.includes(s.route)) return false
      if (s.distance > routeDeviation) return false
    }
    if (phoneOnly && !s.hasPhone) return false
    return true
  })
}

function buildPhases(cycleWeeks) {
  const w = cycleWeeks
  return {
    1: {
      label:     'First Drop',
      timeline:  w === 1 ? 'Week 1' : `Weeks 1–${w}`,
      color:     'var(--ne-attention)',
      bg:        'rgba(212,137,10,0.1)',
      directive: 'Get the shelf. One product, minimum facing. Don\'t oversell on the first visit.',
    },
    2: {
      label:     'Re-order',
      timeline:  w === 1 ? 'Week 2' : `Weeks ${w + 1}–${w * 2}`,
      color:     'var(--ne-text-secondary)',
      bg:        'var(--ne-surface-base)',
      directive: 'Validate shelf placement. Introduce a second SKU if reception was positive.',
    },
    3: {
      label:     'Active Account',
      timeline:  w === 1 ? 'Week 3+' : `Week ${w * 2 + 1}+`,
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

export default function Step4Dispatch({
  city, channel, strategy,
  tierFilter, routeFilter, routeDeviation, persistence,
  waysOfReaching, businessCategory,
  excludedStores, setExcludedStores, onBack,
}) {
  const [dispatched, setDispatched] = useState(false)
  const [phasesOpen, setPhasesOpen] = useState(false)

  const meta        = STRATEGY_META[strategy] || STRATEGY_META.density
  const pool        = STRATEGY_POOLS[strategy] || []
  const stores      = getStoresInReach(pool, strategy, tierFilter, routeFilter, routeDeviation, businessCategory, waysOfReaching)
                        .sort((a, b) => b.potential - a.potential)
  const cycleWeeks  = persistence || 3
  const PHASES      = buildPhases(cycleWeeks)
  const executionMode = STRATEGY_CONFIG[strategy]?.executionMode || 'Own Team'

  const active         = stores.filter(s => !excludedStores.includes(s.id))
  const totalPotential = active.reduce((s, s2) => s + s2.potential, 0)
  const monthlyRevenue = totalPotential * MARGIN * 4
  const avgPotential   = Math.round(totalPotential / (active.length || 1))
  const missionMins    = getMissionMinutes(active)

  const assignedRoutes = [...new Set(active.map(s => s.route))]
    .map(r => ({ route: r, supervisor: ROUTE_META[r]?.supervisor || '—' }))
    .sort((a, b) => a.route.localeCompare(b.route))

  const opening = getOpeningArgument(strategy, channel, avgPotential)

  // Dynamic third column: phone-first for clusters with phone, otherwise location
  const showPhone = strategy === 'clusters' && waysOfReaching?.includes('phone')
  const isHybrid = strategy === 'clusters' && waysOfReaching?.includes('phone') && waysOfReaching?.includes('in-person')
  const phoneOnly = strategy === 'clusters' && waysOfReaching?.length === 1 && waysOfReaching?.includes('phone')
  const thirdColLabel = showPhone ? 'Contact' : 'Location'

  // Hybrid segmentation
  const phoneStores = isHybrid ? stores.filter(s => s.hasPhone) : []
  const visitStores = isHybrid ? stores.filter(s => !s.hasPhone) : []

  // Missing Data Gap: stores without phone when phone is a selected reaching method
  const phoneMissingStores = (strategy === 'clusters' && waysOfReaching?.includes('phone'))
    ? (phoneOnly
        ? pool.filter(s =>
            tierFilter.includes(s.tier) &&
            (!businessCategory?.length || businessCategory.includes(s.category)) &&
            !s.hasPhone
          )
        : stores.filter(s => !s.hasPhone)
      ).sort((a, b) => b.potential - a.potential)
    : []
  const phoneMissingPotential = phoneMissingStores.reduce((sum, s) => sum + s.potential, 0)

  function toggleExclude(id) {
    setExcludedStores(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  const subHeaderStyle = { fontSize: 10, fontWeight: 700, color: 'var(--ne-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }

  function renderTableRow(store, i, usePhone) {
    const excluded = excludedStores.includes(store.id)
    const colValue = usePhone ? (store.phone || '—') : (store.area || '—')
    return (
      <div
        key={store.id}
        onClick={() => toggleExclude(store.id)}
        style={{
          display: 'grid', gridTemplateColumns: '32px 1fr 160px 100px',
          padding: '10px 20px', alignItems: 'center',
          borderTop: i > 0 ? '1px solid var(--ne-border)' : undefined,
          opacity: excluded ? 0.35 : 1, cursor: 'pointer',
          transition: 'opacity var(--ne-ease-color)',
        }}
      >
        <div style={{
          width: 16, height: 16, borderRadius: 3, flexShrink: 0,
          border: `1.5px solid ${!excluded ? 'var(--ne-text)' : 'var(--ne-border)'}`,
          background: !excluded ? 'var(--ne-text)' : '#fff',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'all var(--ne-ease-color)',
        }}>
          {!excluded && (
            <svg width="9" height="9" viewBox="0 0 9 9" fill="none">
              <polyline points="1.5,4.5 3.5,6.5 7.5,2.5" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </div>
        <div>
          <div style={{ fontSize: 13, color: 'var(--ne-text)', fontWeight: 500, textDecoration: excluded ? 'line-through' : 'none' }}>
            {store.name}
          </div>
          <div style={{ fontSize: 10.5, color: 'var(--ne-text-muted)', marginTop: 1 }}>
            {store.route} · {ROUTE_META[store.route]?.supervisor || ''}
          </div>
        </div>
        <div style={{ fontSize: 12, color: excluded ? 'var(--ne-text-muted)' : 'var(--ne-text-secondary)' }}>
          {usePhone && store.phone ? (
            <span style={{ fontFamily: 'var(--ka-font-body)', letterSpacing: '0.02em' }}>{colValue}</span>
          ) : (
            <span>{colValue}</span>
          )}
        </div>
        <div style={{ fontSize: 12, fontWeight: 700, color: excluded ? 'var(--ne-text-muted)' : '#6366F1', textAlign: 'right' }}>
          +{store.potential}
        </div>
      </div>
    )
  }

  // ── Post-activation ─────────────────────────────────────────────────────────
  if (dispatched) {
    return (
      <div style={{
        maxWidth: 720, margin: '0 auto', padding: '56px 32px 80px',
        background: 'radial-gradient(ellipse at 20% 0%, #E0E7FF 0%, #F7F9FB 50%, #F7F9FB 100%)',
        minHeight: 'calc(100vh - 56px)',
      }}>
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <div style={{
            width: 64, height: 64, margin: '0 auto 20px',
            background: 'linear-gradient(135deg, #6366F1 0%, #818CF8 100%)',
            borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 6px 24px rgba(99,102,241,0.35)',
          }}>
            <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
              <polyline points="6,14 11,19 22,8" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <h1 style={{ fontSize: 28, fontWeight: 800, color: 'var(--ne-text)', letterSpacing: '-0.02em', margin: '0 0 8px', fontFamily: 'var(--ka-font-heading)' }}>
            Plan Activated
          </h1>
          <div style={{ fontSize: 14, color: 'var(--ne-text-secondary)', lineHeight: 1.5 }}>
            {active.length} accounts assigned to {assignedRoutes.length} rep{assignedRoutes.length > 1 ? 's' : ''} · {meta.label}
          </div>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            marginTop: 14, padding: '5px 14px', borderRadius: 100,
            background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)',
          }}>
            <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#10B981' }} />
            <span style={{ fontSize: 12, fontWeight: 700, color: '#059669', letterSpacing: '0.04em' }}>ACTIVE</span>
          </div>
        </div>

        <div style={{ background: '#fff', borderRadius: 12, overflow: 'hidden', boxShadow: 'var(--ne-shadow-rest)', marginBottom: 24 }}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--ne-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ne-text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Distribution</div>
            <div style={{ fontSize: 11, color: 'var(--ne-text-muted)' }}>{executionMode}</div>
          </div>
          {assignedRoutes.map(({ route, supervisor }, i) => {
            const repAccounts = active.filter(s => s.route === route)
            const repPotential = repAccounts.reduce((sum, s) => sum + s.potential, 0)
            return (
              <div key={route} style={{ padding: '14px 20px', borderTop: i > 0 ? '1px solid var(--ne-border)' : undefined, display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{
                  width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
                  background: 'linear-gradient(135deg, #6366F1 0%, #818CF8 100%)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: '#fff', fontSize: 13, fontWeight: 700,
                }}>
                  {supervisor.split(' ').map(w => w[0]).slice(0, 2).join('')}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ne-text)' }}>{supervisor}</div>
                  <div style={{ fontSize: 11, color: 'var(--ne-text-muted)', marginTop: 1 }}>
                    {route} · {repAccounts.length} account{repAccounts.length !== 1 ? 's' : ''} · +{repPotential} UC/wk
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 100, background: 'rgba(16,185,129,0.08)' }}>
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                    <polyline points="2,6 5,9 10,3" stroke="#10B981" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <span style={{ fontSize: 11, fontWeight: 600, color: '#059669' }}>Pushed to app</span>
                </div>
              </div>
            )
          })}
        </div>

        <div style={{
          background: 'linear-gradient(141deg, #6366F1 0%, #818CF8 100%)',
          borderRadius: 12, padding: '20px 24px', marginBottom: 24,
          boxShadow: '0 4px 20px rgba(99,102,241,0.3)',
          position: 'relative', overflow: 'hidden',
          display: 'flex', gap: 0, justifyContent: 'space-between',
        }}>
          <div style={{ position: 'absolute', top: -15, right: -15, width: 60, height: 60, borderRadius: 30, background: 'rgba(255,255,255,0.08)' }} />
          {[
            { label: 'Accounts', value: active.length },
            { label: 'Volume Potential', value: `+${totalPotential}`, unit: 'UC/wk' },
            { label: 'Monthly Revenue', value: `$${monthlyRevenue.toFixed(0)}` },
            { label: 'Cycle', value: `${cycleWeeks} wk${cycleWeeks > 1 ? 's' : ''}` },
          ].map((kpi, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'stretch' }}>
              {i > 0 && <div style={{ width: 1, background: 'rgba(255,255,255,0.12)', margin: '0 24px', alignSelf: 'stretch' }} />}
              <div>
                <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>{kpi.label}</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: '#fff', lineHeight: 1, fontFamily: 'var(--ka-font-heading)' }}>
                  {kpi.value}
                  {kpi.unit && <span style={{ fontSize: 11, fontWeight: 400, color: 'rgba(255,255,255,0.45)', marginLeft: 4 }}>{kpi.unit}</span>}
                </div>
              </div>
            </div>
          ))}
        </div>

        <div style={{ background: '#fff', borderRadius: 12, padding: '16px 20px', boxShadow: 'var(--ne-shadow-rest)', marginBottom: 28, borderLeft: '3px solid #10B981' }}>
          <div style={{ fontSize: 13, color: 'var(--ne-text)', lineHeight: 1.6 }}>
            Each salesperson will receive their assigned accounts in their mobile app with Phase 1 instructions. Account status will update automatically as orders are confirmed.
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
          <button style={{ background: 'var(--ne-text)', color: '#fff', fontWeight: 700, padding: '11px 24px', borderRadius: 100, border: 'none', cursor: 'pointer', fontSize: 13, fontFamily: 'var(--ka-font-body)' }}>
            Monitor Execution
          </button>
          <button style={{ background: '#fff', color: 'var(--ne-text)', fontWeight: 600, padding: '11px 24px', borderRadius: 100, border: '1px solid var(--ne-border)', cursor: 'pointer', fontSize: 13, fontFamily: 'var(--ka-font-body)' }}>
            View Progress
          </button>
          <button style={{ background: '#fff', color: 'var(--ne-text-secondary)', fontWeight: 600, padding: '11px 24px', borderRadius: 100, border: '1px solid var(--ne-border)', cursor: 'pointer', fontSize: 13, fontFamily: 'var(--ka-font-body)' }}>
            Go to Active Plans
          </button>
        </div>
      </div>
    )
  }

  // ── Pre-activation: Review & Activate ─────────────────────────────────────────
  const card = { background: '#fff', borderRadius: 12, boxShadow: 'var(--ne-shadow-rest)' }

  return (
    <div style={{
      maxWidth: 900, margin: '0 auto',
      background: 'radial-gradient(ellipse at 0% 0%, #E0E7FF 0%, #F7F9FB 40%, #F7F9FB 100%)',
      minHeight: 'calc(100vh - 56px)',
    }}>

      {/* Sticky header */}
      <div style={{
        position: 'sticky', top: 56, zIndex: 40,
        background: 'rgba(247,249,251,0.92)', backdropFilter: 'blur(8px)',
        paddingBottom: 12, marginBottom: 4,
        borderBottom: '1px solid var(--ne-border)',
      }}>
        <div style={{ padding: '16px 32px 0', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--ne-text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 6 }}>
              Step 4 — Activate
            </div>
            <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--ne-text)', letterSpacing: '-0.02em', margin: 0, fontFamily: 'var(--ka-font-heading)' }}>
              Review & Activate
            </h1>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', paddingTop: 4, flexShrink: 0 }}>
            <button onClick={onBack} style={{
              background: 'transparent', color: 'var(--ne-text-secondary)',
              border: '1px solid var(--ne-border)', borderRadius: 12,
              padding: '8px 14px', fontSize: 13, cursor: 'pointer',
              fontFamily: 'var(--ka-font-body)',
            }}>
              ← Back
            </button>
          </div>
        </div>
        <div style={{ padding: '8px 32px 0' }}>
          <ContextStrip city={city} channel={channel} strategy={strategy} executionMode={executionMode} />
        </div>
      </div>

      <div style={{ padding: '0 32px 48px', display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* ── Mission value bar ── */}
        <div style={{
          padding: '18px 24px',
          background: 'linear-gradient(141deg, #6366F1 0%, #818CF8 50%, #6366F1 100%)',
          borderRadius: 12,
          boxShadow: '0 4px 24px rgba(99,102,241,0.3)',
          position: 'relative', overflow: 'hidden',
          display: 'flex', gap: 0, alignItems: 'stretch', flexWrap: 'wrap',
        }}>
          <div style={{ position: 'absolute', top: -15, right: -15, width: 60, height: 60, borderRadius: 30, background: 'rgba(255,255,255,0.08)' }} />
          <div style={{ position: 'absolute', bottom: -20, left: '30%', width: 80, height: 80, borderRadius: 40, background: 'rgba(255,255,255,0.04)' }} />
          {[
            { label: 'Target Accounts',               value: active.length,                    unit: null },
            { label: 'Volume Potential',               value: `+${totalPotential}`,             unit: 'UC/wk' },
            { label: 'Monthly Revenue When Converted', value: `$${monthlyRevenue.toFixed(0)}`,  unit: null },
            { label: 'Est. Mission Time',              value: fmtHours(missionMins),            unit: '/wk' },
            { label: 'To Activate an Account',         value: '3',                              unit: 'confirmed orders' },
          ].map((kpi, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'stretch' }}>
              {i > 0 && <div style={{ width: 1, background: 'rgba(255,255,255,0.1)', margin: '0 28px', alignSelf: 'stretch' }} />}
              <div>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>{kpi.label}</div>
                <div style={{ fontSize: 28, fontWeight: 800, color: '#FFFFFF', lineHeight: 1, fontFamily: 'var(--ka-font-heading)' }}>
                  {kpi.value}
                  {kpi.unit && <span style={{ fontSize: 13, fontWeight: 400, color: 'rgba(255,255,255,0.45)', marginLeft: 4 }}>{kpi.unit}</span>}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* ── Assigned To ── */}
        <div style={{ ...card, padding: '14px 20px' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ne-text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>
            Assigned To
          </div>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            {assignedRoutes.map(({ route, supervisor }) => (
              <div key={route} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 14px 6px 6px', background: 'var(--ne-surface-base)', borderRadius: 100 }}>
                <div style={{
                  width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                  background: 'linear-gradient(135deg, #6366F1 0%, #818CF8 100%)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: '#fff', fontSize: 10, fontWeight: 700,
                }}>
                  {supervisor.split(' ').map(w => w[0]).slice(0, 2).join('')}
                </div>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ne-text)', lineHeight: 1.2 }}>{supervisor}</div>
                  <div style={{ fontSize: 10, color: 'var(--ne-text-muted)' }}>{route} · {active.filter(s => s.route === route).length} accounts</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Missing Data Gap Alert ── */}
        {phoneMissingStores.length > 0 && (
          <div style={{
            ...card,
            padding: '14px 20px',
            borderLeft: `3px solid ${phoneOnly ? '#D97706' : '#6366F1'}`,
            display: 'flex', flexDirection: 'column', gap: 8,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={phoneOnly ? '#D97706' : '#6366F1'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
              <span style={{ fontSize: 12, fontWeight: 700, color: phoneOnly ? '#B45309' : '#6366F1' }}>
                Missing Data Gap
              </span>
              <span style={{
                fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 100,
                background: phoneOnly ? 'rgba(217,119,6,0.1)' : 'rgba(99,102,241,0.1)',
                color: phoneOnly ? '#B45309' : '#6366F1',
              }}>
                {phoneMissingStores.length} account{phoneMissingStores.length > 1 ? 's' : ''}
              </span>
            </div>
            <div style={{ fontSize: 12, color: 'var(--ne-text-secondary)', lineHeight: 1.5 }}>
              {phoneOnly
                ? `+${phoneMissingPotential} UC/wk potential excluded from this plan — no phone number on file. These may be your best opportunities with incomplete CRM data.`
                : `These accounts lack phone numbers and will require physical visits instead of phone outreach.`}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              {phoneMissingStores.slice(0, 5).map(s => (
                <div key={s.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '3px 0' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--ne-text)' }}>{s.name}</span>
                    <span style={{
                      fontSize: 9, fontWeight: 700, textTransform: 'uppercase',
                      color: 'var(--ne-text-muted)', padding: '1px 6px', borderRadius: 4,
                      background: 'var(--ne-surface-base)',
                    }}>
                      {TIER_META[s.tier]?.label}
                    </span>
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 700, color: phoneOnly ? '#D97706' : '#6366F1' }}>
                    +{s.potential}
                  </span>
                </div>
              ))}
              {phoneMissingStores.length > 5 && (
                <div style={{ fontSize: 11, color: 'var(--ne-text-muted)', fontStyle: 'italic', paddingTop: 2 }}>
                  +{phoneMissingStores.length - 5} more accounts
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Target Accounts — dynamic columns ── */}
        <div style={{ ...card, overflow: 'hidden' }}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--ne-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ne-text)' }}>Target Accounts</div>
            <div style={{ fontSize: 12, color: 'var(--ne-text-muted)' }}>
              {active.length} of {stores.length} included · Uncheck to remove
            </div>
          </div>

          {/* Table content — hybrid splits into phone/visit segments */}
          {isHybrid ? (
            <>
              {phoneStores.length > 0 && (
                <>
                  <div style={{
                    padding: '8px 20px',
                    background: 'rgba(99,102,241,0.04)',
                    borderBottom: '1px solid var(--ne-border)',
                    display: 'flex', alignItems: 'center', gap: 8,
                  }}>
                    <div style={{ width: 6, height: 6, borderRadius: 3, background: '#6366F1', flexShrink: 0 }} />
                    <span style={{ fontSize: 11, fontWeight: 700, color: '#6366F1', letterSpacing: '-0.02em' }}>
                      Contactable by Phone
                    </span>
                    <span style={{ fontSize: 10, color: 'var(--ne-text-muted)' }}>
                      {phoneStores.filter(s => !excludedStores.includes(s.id)).length} accounts
                    </span>
                  </div>
                  <div style={{
                    display: 'grid', gridTemplateColumns: '32px 1fr 160px 100px',
                    padding: '6px 20px', borderBottom: '1px solid var(--ne-border)',
                    background: 'var(--ne-surface-base)',
                  }}>
                    <div />
                    <div style={subHeaderStyle}>Account</div>
                    <div style={subHeaderStyle}>Contact</div>
                    <div style={{ ...subHeaderStyle, textAlign: 'right' }}>UC/wk</div>
                  </div>
                  {phoneStores.map((store, i) => renderTableRow(store, i, true))}
                </>
              )}
              {visitStores.length > 0 && (
                <>
                  <div style={{
                    padding: '8px 20px',
                    background: 'rgba(245,158,11,0.04)',
                    borderTop: phoneStores.length > 0 ? '2px solid var(--ne-border)' : undefined,
                    borderBottom: '1px solid var(--ne-border)',
                    display: 'flex', alignItems: 'center', gap: 8,
                  }}>
                    <div style={{ width: 6, height: 6, borderRadius: 3, background: '#D97706', flexShrink: 0 }} />
                    <span style={{ fontSize: 11, fontWeight: 700, color: '#B45309', letterSpacing: '-0.02em' }}>
                      Requires Physical Visit
                    </span>
                    <span style={{ fontSize: 10, color: 'var(--ne-text-muted)' }}>
                      {visitStores.filter(s => !excludedStores.includes(s.id)).length} accounts
                    </span>
                  </div>
                  <div style={{
                    display: 'grid', gridTemplateColumns: '32px 1fr 160px 100px',
                    padding: '6px 20px', borderBottom: '1px solid var(--ne-border)',
                    background: 'var(--ne-surface-base)',
                  }}>
                    <div />
                    <div style={subHeaderStyle}>Account</div>
                    <div style={subHeaderStyle}>Location</div>
                    <div style={{ ...subHeaderStyle, textAlign: 'right' }}>UC/wk</div>
                  </div>
                  {visitStores.map((store, i) => renderTableRow(store, i, false))}
                </>
              )}
            </>
          ) : (
            <>
              <div style={{
                display: 'grid', gridTemplateColumns: '32px 1fr 160px 100px',
                padding: '8px 20px', borderBottom: '1px solid var(--ne-border)',
                background: 'var(--ne-surface-base)',
              }}>
                <div />
                <div style={subHeaderStyle}>Account</div>
                <div style={subHeaderStyle}>{thirdColLabel}</div>
                <div style={{ ...subHeaderStyle, textAlign: 'right' }}>UC/wk</div>
              </div>
              {stores.map((store, i) => renderTableRow(store, i, showPhone))}
            </>
          )}

          {/* Table footer */}
          <div style={{
            padding: '12px 20px', borderTop: '1px solid var(--ne-border)',
            background: 'var(--ne-surface-base)',
            display: 'grid', gridTemplateColumns: '32px 1fr 160px 100px', alignItems: 'center',
          }}>
            <div />
            <div style={{ fontSize: 12, color: 'var(--ne-text-muted)' }}>
              {excludedStores.filter(id => stores.some(s => s.id === id)).length > 0
                ? `${excludedStores.filter(id => stores.some(s => s.id === id)).length} account(s) removed`
                : 'All accounts included'}
            </div>
            <div />
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ne-text)', textAlign: 'right' }}>
              +{totalPotential}
            </div>
          </div>
        </div>

        {/* ── Activate Plan CTA ── */}
        <button
          onClick={() => setDispatched(true)}
          disabled={active.length === 0}
          style={{
            width: '100%',
            background: active.length > 0 ? 'var(--ne-text)' : 'var(--ne-surface-base)',
            color: active.length > 0 ? '#fff' : 'var(--ne-text-muted)',
            fontWeight: 700, padding: '14px', borderRadius: 100,
            border: 'none', cursor: active.length > 0 ? 'pointer' : 'not-allowed',
            fontSize: 14,
            fontFamily: 'var(--ka-font-body)',
            transition: 'background var(--ne-ease-color)',
          }}
        >
          Activate Plan
        </button>

        {/* ── Opening Argument — secondary ── */}
        <div style={{ ...card, borderLeft: '3px solid #6366F1', padding: '16px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <div style={{
              width: 20, height: 20, borderRadius: 6, flexShrink: 0,
              background: 'linear-gradient(135deg, #6366F1 0%, #818CF8 100%)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 2px 6px rgba(99,102,241,0.25)',
            }}>
              <svg width="9" height="9" viewBox="0 0 12 12" fill="none">
                <circle cx="6" cy="6" r="4.5" stroke="#fff" strokeWidth="1.2" />
                <line x1="6" y1="3.5" x2="6" y2="6.5" stroke="#fff" strokeWidth="1.3" strokeLinecap="round" />
                <circle cx="6" cy="8.2" r="0.7" fill="#fff" />
              </svg>
            </div>
            <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--ne-text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Opening Argument
            </span>
            <span style={{ fontSize: 8, fontWeight: 700, color: '#fff', background: 'linear-gradient(135deg, #6366F1 0%, #818CF8 100%)', padding: '2px 7px', borderRadius: 100, letterSpacing: '0.08em' }}>AI</span>
          </div>
          <div style={{ fontSize: 13, color: 'var(--ne-text)', lineHeight: 1.6, fontStyle: 'italic' }}>
            "{opening}"
          </div>
        </div>

        {/* ── Instructions by Phase — collapsed by default ── */}
        <div style={{ ...card, overflow: 'hidden' }}>
          <button
            onClick={() => setPhasesOpen(o => !o)}
            style={{
              width: '100%', padding: '14px 20px',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              background: '#fff', border: 'none', cursor: 'pointer',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--ne-text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                Instructions by Phase
              </span>
              <span style={{ fontSize: 10, color: 'var(--ne-text-muted)', background: 'var(--ne-surface-base)', borderRadius: 4, padding: '2px 7px' }}>
                {cycleWeeks}-week cycle
              </span>
            </div>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--ne-text-muted)" strokeWidth="2"
              style={{ transform: phasesOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s ease' }}>
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>

          {!phasesOpen && (
            <div style={{ padding: '0 20px 14px', display: 'flex', gap: 8 }}>
              {[1, 2, 3].map(n => {
                const ph = PHASES[n]
                return (
                  <div key={n} style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '4px 10px', borderRadius: 100,
                    background: ph.bg, border: `1px solid ${n === 3 ? 'var(--ne-text)' : 'var(--ne-border)'}`,
                  }}>
                    <span style={{ fontSize: 10, fontWeight: 800, color: n === 3 ? 'var(--ne-text)' : ph.color }}>{n}</span>
                    <span style={{ fontSize: 11, fontWeight: 600, color: n === 3 ? 'var(--ne-text)' : 'var(--ne-text-secondary)' }}>{ph.label}</span>
                    <span style={{ fontSize: 10, color: 'var(--ne-text-muted)' }}>{ph.timeline}</span>
                  </div>
                )
              })}
            </div>
          )}

          {phasesOpen && (
            <div style={{ padding: '0 20px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
              {[1, 2, 3].map(n => {
                const ph = PHASES[n]
                const isYellow = n === 3
                return (
                  <div key={n} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                    <span style={{
                      flexShrink: 0, width: 24, height: 24, borderRadius: '50%',
                      background: ph.bg, border: `1px solid ${isYellow ? 'var(--ne-text)' : 'var(--ne-border)'}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 10, fontWeight: 800, color: isYellow ? 'var(--ne-text)' : ph.color,
                    }}>{n}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--ne-text)' }}>{ph.label}</span>
                        <span style={{ fontSize: 10, color: 'var(--ne-text-muted)', background: 'var(--ne-surface-base)', borderRadius: 3, padding: '1px 6px' }}>{ph.timeline}</span>
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--ne-text-secondary)', lineHeight: 1.5 }}>{ph.directive}</div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
