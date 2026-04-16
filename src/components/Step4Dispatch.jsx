import { useState } from 'react'
import ContextStrip from './ContextStrip.jsx'
import { DENSITY_WS, CLUSTER_WS, TIER_META, ROUTE_META, CATEGORY_META, STRATEGY_CONFIG } from './Step2Discovery.jsx'

const STRATEGY_POOLS = { density: DENSITY_WS, clusters: CLUSTER_WS }

const STRATEGY_META = {
  density:  { label: 'Density Fill' },
  clusters: { label: 'High-Potential Clusters' },
}

const CHANNEL_LABELS = { traditional: 'Traditional', modern: 'Modern' }
const CITY_LABELS = { monterrey: 'Monterrey', cdmx: 'CDMX', guadalajara: 'Guadalajara', puebla: 'Puebla', tijuana: 'Tijuana' }

const AGENCIES = [
  { id: 'agency-a', name: 'Distribuidora Norte', capacity: 10, used: 5, contact: 'Regional Manager', costPerDrop: 45 },
  { id: 'agency-b', name: 'LogiServ MTY',        capacity: 8,  used: 6, contact: 'Regional Manager', costPerDrop: 52 },
  { id: 'agency-c', name: 'Grupo Comercial Rex',  capacity: 15, used: 3, contact: 'Regional Manager', costPerDrop: 38 },
]

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
  const [selectedAgency, setSelectedAgency] = useState(null)

  const meta        = STRATEGY_META[strategy] || STRATEGY_META.density
  const pool        = STRATEGY_POOLS[strategy] || []
  const stores      = getStoresInReach(pool, strategy, tierFilter, routeFilter, routeDeviation, businessCategory, waysOfReaching)
                        .sort((a, b) => b.potential - a.potential)
  const cycleWeeks  = persistence || 3
  const PHASES      = buildPhases(cycleWeeks)
  const executionMode = STRATEGY_CONFIG[strategy]?.executionMode || 'Own Team'
  const isExternal = executionMode === 'External Team'

  const active         = stores.filter(s => !excludedStores.includes(s.id))
  const totalPotential = active.reduce((s, s2) => s + s2.potential, 0)
  const monthlyRevenue = totalPotential * MARGIN * 4
  const avgPotential   = Math.round(totalPotential / (active.length || 1))
  const missionMins    = getMissionMinutes(active)

  const assignedRoutes = [...new Set(active.map(s => s.route))]
    .map(r => ({ route: r, supervisor: ROUTE_META[r]?.supervisor || '—' }))
    .sort((a, b) => a.route.localeCompare(b.route))

  const opening = getOpeningArgument(strategy, channel, avgPotential)

  // External team computed values
  const agency = isExternal ? AGENCIES.find(a => a.id === selectedAgency) : null
  const costPerDrop = agency?.costPerDrop || 0
  const totalServiceFee = costPerDrop * active.length
  const canActivate = active.length > 0 && (!isExternal || selectedAgency !== null)

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
          {!isExternal && (
            <div style={{ fontSize: 10.5, color: 'var(--ne-text-muted)', marginTop: 1 }}>
              {store.route} · {ROUTE_META[store.route]?.supervisor || ''}
            </div>
          )}
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

  function buildBrief() {
    const ag = AGENCIES.find(a => a.id === selectedAgency)
    const cityLabel = CITY_LABELS[city] || city || ''
    const channelLabel = CHANNEL_LABELS[channel] || channel || ''
    const accountLines = active.map((s, i) =>
      `  ${i + 1}. ${s.name} | ${s.route} | +${s.potential} UC/wk${s.hasPhone && s.phone ? ` | ${s.phone}` : ' | no phone on file'}`
    )
    const phaseLines = [1, 2, 3].flatMap(n => [
      `  Phase ${n} — ${PHASES[n].label} (${PHASES[n].timeline})`,
      `  ${PHASES[n].directive}`,
      '',
    ])
    return [
      'NETWORK EXPANDER — FIELD HANDOVER BRIEF',
      `Date: ${new Date().toLocaleDateString('en-MX')}`,
      '',
      '── MISSION OVERVIEW ──────────────────────────────────',
      `  City:      ${cityLabel}`,
      `  Channel:   ${channelLabel}`,
      `  Strategy:  ${meta.label}`,
      `  Execution: External Team`,
      '',
      '── PARTNER AGENCY ────────────────────────────────────',
      `  Name:            ${ag?.name || '—'}`,
      `  Cost per Drop:   $${ag?.costPerDrop || 0}`,
      `  Contracted Slots:${ag?.capacity || 0}`,
      `  Est. Service Fee:$${totalServiceFee} per cycle`,
      '',
      `── TARGET ACCOUNTS (${active.length}) ─────────────────────────`,
      ...accountLines,
      '',
      '── OPENING ARGUMENT ──────────────────────────────────',
      `  ${opening}`,
      '',
      '── FIELD INSTRUCTIONS BY PHASE ──────────────────────',
      ...phaseLines,
    ].join('\n')
  }

  function downloadBrief() {
    const text = buildBrief()
    const blob = new Blob([text], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `handover-brief-${city || 'plan'}-${new Date().toISOString().slice(0, 10)}.txt`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  // ── Post-activation ─────────────────────────────────────────────────────────
  if (dispatched) {
    const activatedAgency = isExternal ? AGENCIES.find(a => a.id === selectedAgency) : null

    if (isExternal) {
      return (
        <div style={{
          maxWidth: 720, margin: '0 auto', padding: '56px 32px 80px',
          background: 'radial-gradient(ellipse at 20% 0%, #E0E7FF 0%, #F7F9FB 50%, #F7F9FB 100%)',
          minHeight: 'calc(100vh - 56px)',
        }}>
          {/* Hero */}
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
            <h1 style={{ fontSize: 26, fontWeight: 800, color: 'var(--ne-text)', letterSpacing: '-0.02em', margin: '0 0 8px', fontFamily: 'var(--ka-font-heading)' }}>
              Plan Activated & Brief Exported
            </h1>
            <div style={{ fontSize: 14, color: 'var(--ne-text-secondary)', lineHeight: 1.5 }}>
              {active.length} accounts assigned to {activatedAgency?.name} · {meta.label}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center', marginTop: 14 }}>
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '5px 14px', borderRadius: 100,
                background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)',
              }}>
                <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#10B981' }} />
                <span style={{ fontSize: 12, fontWeight: 700, color: '#059669', letterSpacing: '0.04em' }}>ACTIVE</span>
              </div>
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '5px 14px', borderRadius: 100,
                background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)',
              }}>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#6366F1" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#6366F1', letterSpacing: '0.04em' }}>BRIEF EXPORTED</span>
              </div>
            </div>
          </div>

          {/* Agency card */}
          <div style={{ background: '#fff', borderRadius: 12, overflow: 'hidden', boxShadow: 'var(--ne-shadow-rest)', marginBottom: 24 }}>
            <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--ne-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ne-text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Partner Agency</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 100, background: 'rgba(99,102,241,0.08)' }}>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#6366F1" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                <span style={{ fontSize: 11, fontWeight: 600, color: '#6366F1' }}>Brief exported</span>
              </div>
            </div>
            <div style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{
                width: 44, height: 44, borderRadius: 12, flexShrink: 0,
                background: 'linear-gradient(135deg, #6366F1 0%, #818CF8 100%)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#fff', fontSize: 18, fontWeight: 800,
              }}>
                {activatedAgency?.name?.slice(0, 1)}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ne-text)' }}>{activatedAgency?.name}</div>
                <div style={{ fontSize: 12, color: 'var(--ne-text-muted)', marginTop: 2 }}>
                  {activatedAgency?.capacity} contracted slots · ${activatedAgency?.costPerDrop}/drop
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 20, fontWeight: 800, color: '#6366F1', fontFamily: 'var(--ka-font-heading)' }}>
                  ${totalServiceFee}
                </div>
                <div style={{ fontSize: 10, color: 'var(--ne-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>est. service fee</div>
              </div>
            </div>
            <div style={{ padding: '10px 20px', borderTop: '1px solid var(--ne-border)', background: 'var(--ne-surface-base)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#F59E0B', flexShrink: 0 }} />
              <span style={{ fontSize: 12, color: 'var(--ne-text-secondary)' }}>
                Pending Assignment · Contact <strong>{activatedAgency?.contact}</strong> to confirm field team allocation
              </span>
            </div>
          </div>

          {/* KPI bar */}
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
              { label: 'Est. Service Fee', value: `$${totalServiceFee}`, unit: '/cycle' },
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

          {/* Handover note */}
          <div style={{ background: '#fff', borderRadius: 12, padding: '16px 20px', boxShadow: 'var(--ne-shadow-rest)', marginBottom: 28, borderLeft: '3px solid #6366F1' }}>
            <div style={{ fontSize: 13, color: 'var(--ne-text)', lineHeight: 1.6 }}>
              The handover brief has been downloaded with the full account list, opening argument, and phase instructions. Share it with the partner agency to confirm field team allocation and timeline.
            </div>
          </div>

          {/* CTAs */}
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
            <button
              onClick={downloadBrief}
              style={{
                background: 'var(--ne-text)', color: '#fff', fontWeight: 700,
                padding: '11px 24px', borderRadius: 100, border: 'none', cursor: 'pointer',
                fontSize: 13, fontFamily: 'var(--ka-font-body)',
                display: 'flex', alignItems: 'center', gap: 8,
              }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              Download Brief
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

    // ── Own Team post-activation ──────────────────────────────────────────────
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
      background: 'radial-gradient(ellipse at 0% 0%, #E0E7FF 0%, #F7F9FB 40%, #F7F9FB 100%)',
      minHeight: 'calc(100vh - 56px)',
    }}>

      {/* Sticky header — matches Stage 3 context bar */}
      <div style={{
        position: 'sticky', top: 56, zIndex: 40,
        background: 'rgba(247,249,251,0.92)', backdropFilter: 'blur(8px)',
        paddingBottom: 10,
        borderBottom: '1px solid var(--ne-border)',
      }}>
        <div style={{ padding: '8px 24px 4px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
          <ContextStrip city={city} channel={channel} strategy={strategy} executionMode={executionMode} />
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
            <button onClick={onBack} style={{
              background: '#fff', color: 'var(--ne-text-secondary)',
              border: '1px solid var(--ne-border)', borderRadius: 'var(--ne-radius-pill)',
              padding: '8px 17px', fontSize: 12, fontWeight: 500, cursor: 'pointer',
            }}>← Back</button>
            <button
              onClick={() => { if (isExternal) downloadBrief(); setDispatched(true) }}
              disabled={!canActivate}
              style={{
                background: canActivate ? 'var(--ne-text)' : 'var(--ne-surface-base)',
                color: canActivate ? '#fff' : 'var(--ne-text-muted)',
                fontWeight: 700, padding: '8px 20px', borderRadius: 'var(--ne-radius-pill)',
                border: 'none', cursor: canActivate ? 'pointer' : 'not-allowed',
                fontSize: 12, fontFamily: 'var(--ka-font-body)',
                transition: 'background var(--ne-ease-color)',
              }}
            >
              {isExternal ? 'Activate & Export Brief →' : `Activate ${active.length} Accounts →`}
            </button>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 960, margin: '0 auto', padding: '16px 24px 48px', display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* ── Mission value bar ── */}
        <div style={{
          padding: '18px 24px',
          background: 'linear-gradient(141deg, #6366F1 0%, #818CF8 50%, #6366F1 100%)',
          borderRadius: 12,
          boxShadow: '0 4px 24px rgba(99,102,241,0.3)',
          position: 'relative', overflow: 'hidden',
          display: 'flex', gap: 0, alignItems: 'stretch',
        }}>
          <div style={{ position: 'absolute', top: -15, right: -15, width: 60, height: 60, borderRadius: 30, background: 'rgba(255,255,255,0.08)' }} />
          <div style={{ position: 'absolute', bottom: -20, left: '30%', width: 80, height: 80, borderRadius: 40, background: 'rgba(255,255,255,0.04)' }} />
          {[
            { label: 'Target Accounts',               value: active.length,                        unit: null              },
            { label: 'Volume Potential',               value: `+${totalPotential}`,                 unit: 'UC/wk'           },
            { label: 'Monthly Revenue When Converted', value: `$${monthlyRevenue.toFixed(0)}`,      unit: null              },
            isExternal
              ? { label: 'Cost / Drop',            value: agency ? `$${costPerDrop}` : '—',       unit: null              }
              : { label: 'Est. Mission Time',       value: fmtHours(missionMins),                  unit: '/wk'             },
            isExternal
              ? { label: 'Est. Service Fee',        value: agency ? `$${totalServiceFee}` : '—',  unit: agency ? '/cycle' : null }
              : { label: 'To Activate an Account',  value: '3',                                    unit: 'confirmed orders'},
          ].map((kpi, i) => (
            <div key={i} style={{ flex: 1, display: 'flex', alignItems: 'center' }}>
              {i > 0 && <div style={{ width: 1, background: 'rgba(255,255,255,0.1)', margin: '0 18px', alignSelf: 'stretch' }} />}
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 4 }}>
                <div style={{ fontSize: 9.5, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.07em', whiteSpace: 'nowrap' }}>{kpi.label}</div>
                <div style={{ fontSize: 24, fontWeight: 800, color: '#FFFFFF', lineHeight: 1, fontFamily: 'var(--ka-font-heading)', whiteSpace: 'nowrap' }}>
                  {kpi.value}
                  {kpi.unit && <span style={{ fontSize: 11, fontWeight: 400, color: 'rgba(255,255,255,0.45)', marginLeft: 3 }}>{kpi.unit}</span>}
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
          {isExternal ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <select
                value={selectedAgency || ''}
                onChange={e => setSelectedAgency(e.target.value || null)}
                style={{
                  width: '100%', padding: '9px 14px', borderRadius: 8,
                  border: `1.5px solid ${selectedAgency ? 'var(--ne-text)' : 'var(--ne-border)'}`,
                  background: '#fff', fontSize: 13, color: selectedAgency ? 'var(--ne-text)' : 'var(--ne-text-muted)',
                  fontFamily: 'var(--ka-font-body)', cursor: 'pointer', outline: 'none',
                  appearance: 'none',
                  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23888' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E")`,
                  backgroundRepeat: 'no-repeat', backgroundPosition: 'right 14px center', paddingRight: 36,
                }}
              >
                <option value="">Select partner agency…</option>
                {AGENCIES.map(a => (
                  <option key={a.id} value={a.id}>{a.name} — ${a.costPerDrop}/drop · {a.capacity - a.used} slots available</option>
                ))}
              </select>

              {agency && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 11, color: 'var(--ne-text-muted)' }}>Contracted capacity</span>
                    <span style={{
                      fontSize: 11, fontWeight: 700,
                      color: agency.used / agency.capacity >= 0.9 ? '#DC2626' : 'var(--ne-text)',
                    }}>
                      {agency.used} / {agency.capacity} slots used
                    </span>
                  </div>
                  <div style={{ height: 6, borderRadius: 3, background: 'var(--ne-surface-base)', overflow: 'hidden' }}>
                    <div style={{
                      height: '100%', borderRadius: 3,
                      width: `${Math.min(100, (agency.used / agency.capacity) * 100)}%`,
                      background: agency.used / agency.capacity >= 0.9 ? '#DC2626'
                        : agency.used / agency.capacity >= 0.7 ? '#F59E0B' : '#6366F1',
                      transition: 'width 0.4s ease',
                    }} />
                  </div>
                  {agency.used / agency.capacity >= 0.9 && (
                    <div style={{ fontSize: 11, color: '#DC2626', fontWeight: 600 }}>
                      ⚠ Near capacity — confirm availability before activating
                    </div>
                  )}
                  <div style={{
                    display: 'inline-flex', alignItems: 'center', gap: 8,
                    padding: '5px 12px', borderRadius: 100, alignSelf: 'flex-start',
                    background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)',
                  }}>
                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#F59E0B' }} />
                    <span style={{ fontSize: 11, fontWeight: 600, color: '#B45309' }}>
                      Pending Assignment · {agency.contact}
                    </span>
                  </div>
                </div>
              )}
            </div>
          ) : (
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
          )}
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

        {/* ── Agency selection hint ── */}
        {isExternal && !selectedAgency && (
          <div style={{
            textAlign: 'center', fontSize: 12, color: 'var(--ne-text-muted)',
            padding: '6px 0', background: 'rgba(245,158,11,0.06)',
            borderRadius: 8, border: '1px solid rgba(245,158,11,0.15)',
          }}>
            Select a partner agency in "Assigned To" to enable activation
          </div>
        )}

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
