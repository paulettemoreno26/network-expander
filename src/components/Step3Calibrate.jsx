import { useState, useRef, useEffect } from 'react'
import mapboxgl from 'mapbox-gl'
import { DENSITY_WS, CLUSTER_WS, OWNED_POS, ROUTES, OTHER_WS, TIER_META, ROUTE_META, CATEGORY_META, STRATEGY_CONFIG, EXECUTION_LABELS, WAY_LABELS, svgToLngLat } from './Step2Discovery.jsx'

// ── Label maps ───────────────────────────────────────────────────────────────
const CITY_LABELS = { monterrey: 'Monterrey', cdmx: 'CDMX', guadalajara: 'Guadalajara', puebla: 'Puebla', tijuana: 'Tijuana' }
const CHANNEL_LABELS = { traditional: 'Traditional', modern: 'Modern' }
const STRATEGY_LABELS = { density: 'Density Fill', clusters: 'High-Potential Clusters' }

// ── KPI Delta ─────────────────────────────────────────────────────────────────
function KpiDelta({ delta, inverted = false, onDark = false }) {
  if (delta == null || delta === 0) return null
  const isUp = delta > 0
  const isGood = inverted ? !isUp : isUp
  return (
    <span style={{
      fontSize: 10, fontWeight: 700,
      color: onDark ? (isGood ? '#059669' : '#D97706') : (isGood ? '#059669' : '#D97706'),
      background: onDark ? 'rgba(255,255,255,0.9)' : (isGood ? 'rgba(16,185,129,0.12)' : 'rgba(245,158,11,0.12)'),
      padding: '2px 6px', borderRadius: 100,
      marginLeft: 6, whiteSpace: 'nowrap',
    }}>
      {isUp ? '\u25B2' : '\u25BC'}{Math.abs(delta)}
    </span>
  )
}

// ── Config ────────────────────────────────────────────────────────────────────
const STRATEGY_POOLS = { density: DENSITY_WS, clusters: CLUSTER_WS }
const MARGIN = 0.255
const TIER_BASE_PROB = { gold: 0.84, silver: 0.67, bronze: 0.48, iron: 0.32 }
const PERSISTENCE_PROB_MULT = { 1: 0.67, 2: 0.85, 3: 1.00, 4: 1.06 }
function calcSuccessProbability(stores, persistence) {
  if (!stores.length) return 0
  const mult = PERSISTENCE_PROB_MULT[persistence] ?? 1.0
  const avg = stores.reduce((sum, s) => sum + (TIER_BASE_PROB[s.tier] ?? 0.5) * mult, 0) / stores.length
  return Math.min(95, Math.round(avg * 100))
}
const DEVIATION_BASE_CAC = { 100: 5, 500: 9, 1000: 16, 2000: 26 }
const PERSISTENCE_VISIT_COUNT = { 1: 1.0, 2: 1.8, 3: 2.6, 4: 3.2 }
function calcCACPerStore(rd, p) { return Math.round((DEVIATION_BASE_CAC[rd] ?? 16) * (PERSISTENCE_VISIT_COUNT[p] ?? 2.6)) }
const PATH_EFFICIENCY = { 100: 0.98, 500: 0.91, 1000: 0.82, 2000: 0.68 }
function getValueScore(avgUC) { return avgUC > 60 ? 1 : avgUC >= 35 ? 0.85 : avgUC >= 20 ? 0.65 : 0.45 }

const POTENTIAL_RANGES = [
  { id: 'low', label: 'Low', max: 20 },
  { id: 'med', label: 'Med', max: 35 },
  { id: 'high', label: 'High', max: 60 },
  { id: 'vhigh', label: 'Very High', max: Infinity },
]
function getPotentialRange(p) { return p < 20 ? 'low' : p < 35 ? 'med' : p <= 60 ? 'high' : 'vhigh' }

const TIER_CONFIDENCE = { gold: 94, silver: 81, bronze: 67, iron: 52 }

const DEVIATION_OPTIONS = [
  { value: 100, label: '100m' },
  { value: 500, label: '500m' },
  { value: 1000, label: '1km' },
  { value: 2000, label: '2km' },
]
const PERSISTENCE_OPTIONS = [
  { value: 1, label: '1 wk' },
  { value: 2, label: '2 wks' },
  { value: 3, label: '3 wks', recommended: true },
  { value: 4, label: '4 wks' },
]
const EXTRA_POS_OPTIONS = [
  { value: 1, label: '1' },
  { value: 2, label: '2' },
  { value: 3, label: '3', recommended: true },
  { value: 5, label: '5' },
]
const NUM_PEOPLE_OPTIONS = [
  { value: 1, label: '1' },
  { value: 2, label: '2', recommended: true },
  { value: 3, label: '3' },
  { value: 5, label: '5' },
]

const PHASE_META = {
  1: { label: 'Conversion', week: 'Week 1', desc: 'Get one Core SKU on shelf.' },
  2: { label: 'Retention', week: 'Weeks 2\u20133', desc: 'Validate placement, reinforce relationship.' },
  3: { label: 'Active Drop', week: 'Week 4+', desc: 'Third order confirmed. Account active.' },
}

// ── Geo ───────────────────────────────────────────────────────────────────────
function buildPoolGeo(pool, inReachIds, filteredIds) {
  return {
    type: 'FeatureCollection',
    features: pool.map(s => ({
      type: 'Feature',
      properties: {
        id: s.id, name: s.name, potential: s.potential, tier: s.tier,
        dotState: inReachIds.has(s.id) ? 'active' : filteredIds.has(s.id) ? 'scoped' : 'muted',
      },
      geometry: { type: 'Point', coordinates: svgToLngLat(s.x, s.y) },
    })),
  }
}
const GEO_ROUTES = { type: 'FeatureCollection', features: ROUTES.map(r => ({ type: 'Feature', properties: { id: r.id }, geometry: { type: 'LineString', coordinates: r.points.split(' ').map(pt => { const [x, y] = pt.split(',').map(Number); return svgToLngLat(x, y) }) } })) }
const GEO_OWNED = { type: 'FeatureCollection', features: OWNED_POS.map(p => ({ type: 'Feature', properties: { id: p.id }, geometry: { type: 'Point', coordinates: svgToLngLat(p.x, p.y) } })) }
const GEO_OTHER = { type: 'FeatureCollection', features: OTHER_WS.map(d => ({ type: 'Feature', properties: { id: d.id }, geometry: { type: 'Point', coordinates: svgToLngLat(d.x, d.y) } })) }

// ── Map ───────────────────────────────────────────────────────────────────────
function CalibrationMap({ strategy, filteredPool, inReach, routeDeviation }) {
  const containerRef = useRef(null), mapRef = useRef(null), readyRef = useRef(false)
  const filteredRef = useRef(filteredPool), inReachRef = useRef(inReach), devRef = useRef(routeDeviation)
  const pool = STRATEGY_POOLS[strategy] || []

  useEffect(() => {
    if (!containerRef.current) return
    mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN || ''
    const map = new mapboxgl.Map({
      container: containerRef.current, style: 'mapbox://styles/mapbox/dark-v11',
      center: [-100.325, 25.688], zoom: 12.5, interactive: true, attributionControl: false,
    })
    mapRef.current = map
    map.on('load', () => {
      const irIds = new Set(inReachRef.current.map(s => s.id))
      const fIds = new Set(filteredRef.current.map(s => s.id))
      map.addSource('routes', { type: 'geojson', data: GEO_ROUTES })
      map.addLayer({ id: 'route-buffer', type: 'line', source: 'routes', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': 'rgba(229,255,1,0.08)', 'line-opacity': 0.15, 'line-blur': 8, 'line-width': ['interpolate', ['exponential', 2], ['zoom'], 11, devRef.current / 80, 14, devRef.current / 10, 17, devRef.current / 1.2] } })
      map.addLayer({ id: 'route-line', type: 'line', source: 'routes', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': 'rgba(255,255,255,0.35)', 'line-width': 1.8, 'line-opacity': 0.5 } })
      map.addSource('other-ws', { type: 'geojson', data: GEO_OTHER })
      map.addLayer({ id: 'other-ws-dot', type: 'circle', source: 'other-ws', paint: { 'circle-radius': 3, 'circle-color': '#444', 'circle-opacity': 0.35 } })
      map.addSource('pool-ws', { type: 'geojson', data: buildPoolGeo(pool, irIds, fIds) })
      map.addLayer({ id: 'pool-ws-dot', type: 'circle', source: 'pool-ws', paint: {
        'circle-radius': ['match', ['get', 'dotState'], 'active', 7, 'scoped', 4.5, 3],
        'circle-color': ['match', ['get', 'dotState'], 'active', '#E5FF01', 'scoped', 'rgba(229,255,1,0.4)', '#444'],
        'circle-opacity': ['match', ['get', 'dotState'], 'active', 1, 'scoped', 0.6, 0.2],
        'circle-stroke-width': ['match', ['get', 'dotState'], 'active', 2, 0],
        'circle-stroke-color': 'rgba(229,255,1,0.25)',
      }})
      map.setPaintProperty('pool-ws-dot', 'circle-radius-transition', { duration: 300 })
      map.setPaintProperty('pool-ws-dot', 'circle-opacity-transition', { duration: 300 })
      map.addSource('owned-pos', { type: 'geojson', data: GEO_OWNED })
      map.addLayer({ id: 'owned-pos-dot', type: 'circle', source: 'owned-pos', paint: { 'circle-radius': 5, 'circle-color': '#FFFFFF', 'circle-stroke-width': 1.5, 'circle-stroke-color': 'rgba(255,255,255,0.3)' } })
      const popup = new mapboxgl.Popup({ closeButton: false, closeOnClick: false, offset: 10 })
      map.on('mouseenter', 'pool-ws-dot', e => {
        map.getCanvas().style.cursor = 'pointer'
        const { name, potential, tier } = e.features[0].properties
        popup.setLngLat(e.lngLat).setHTML(
          `<div style="font:600 11px/1.4 Inter,sans-serif;color:#0F0F14">${name}</div>` +
          `<div style="font:500 10px/1.4 Inter,sans-serif;color:#555">+${potential} UC/wk \u00b7 ${(TIER_CONFIDENCE[tier] ?? 70)}% match</div>`
        ).addTo(map)
      })
      map.on('mouseleave', 'pool-ws-dot', () => { map.getCanvas().style.cursor = ''; popup.remove() })
      readyRef.current = true
    })
    return () => { readyRef.current = false; map.remove() }
  }, [])

  useEffect(() => {
    filteredRef.current = filteredPool; inReachRef.current = inReach
    if (!readyRef.current) return
    const src = mapRef.current?.getSource('pool-ws')
    if (src) src.setData(buildPoolGeo(pool, new Set(inReach.map(s => s.id)), new Set(filteredPool.map(s => s.id))))
  }, [filteredPool, inReach])

  useEffect(() => {
    devRef.current = routeDeviation
    if (!readyRef.current) return
    mapRef.current?.setPaintProperty('route-buffer', 'line-width', ['interpolate', ['exponential', 2], ['zoom'], 11, routeDeviation / 80, 14, routeDeviation / 10, 17, routeDeviation / 1.2])
  }, [routeDeviation])

  return <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
}

// ── Segmented Pill ────────────────────────────────────────────────────────────
function SegPill({ options, value, onChange }) {
  return (
    <div style={{
      display: 'inline-flex', background: 'var(--ne-surface-base)',
      borderRadius: 'var(--ne-radius-pill)', padding: '6px 3px 3px', gap: 2,
    }}>
      {options.map(o => {
        const on = value === o.value
        return (
          <button key={o.value} onClick={() => onChange(o.value)} style={{
            padding: '6px 14px', borderRadius: 'var(--ne-radius-pill)',
            border: 'none', cursor: 'pointer', fontSize: 12,
            fontWeight: on ? 700 : 500, position: 'relative',
            background: on ? 'var(--ne-surface-card)' : 'transparent',
            color: on ? 'var(--ne-text)' : 'var(--ne-text-muted)',
            boxShadow: on ? 'var(--ne-shadow-lifted)' : 'none',
            transition: 'all var(--ne-ease-color)',
          }}>
            {o.label}
            {o.recommended && (
              <span style={{
                position: 'absolute', top: -5, right: -4,
                fontSize: 7, fontWeight: 800, color: 'var(--ne-text)',
                background: 'var(--ne-yellow)', borderRadius: 'var(--ne-radius-pill)',
                padding: '1px 5px',
              }}>REC</span>
            )}
          </button>
        )
      })}
    </div>
  )
}

// ── Multi-select Dropdown ─────────────────────────────────────────────────────
function MultiSelectDropdown({ options, selected, onChange }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return
    function handleClick(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  const allSelected = selected.length === options.length
  const noneSelected = selected.length === 0

  function toggleAll() { onChange(allSelected ? [] : options.map(o => o.id)) }
  function toggle(id) { onChange(selected.includes(id) ? selected.filter(x => x !== id) : [...selected, id]) }

  const summary = allSelected
    ? 'All categories'
    : noneSelected
      ? 'Select categories…'
      : selected.length <= 2
        ? selected.map(s => options.find(o => o.id === s)?.label || s).join(', ')
        : `${selected.length} selected`

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%', padding: '7px 12px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: '#fff', border: '1.5px solid var(--ne-border)',
          borderRadius: 8, cursor: 'pointer',
          fontSize: 12, fontWeight: 600, color: noneSelected ? 'var(--ne-text-muted)' : 'var(--ne-text)',
          transition: 'border-color var(--ne-ease-color)',
          borderColor: open ? 'var(--ne-border-active)' : 'var(--ne-border)',
        }}
      >
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{summary}</span>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--ne-text-muted)" strokeWidth="2.5"
          style={{ flexShrink: 0, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s ease' }}>
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0,
          background: '#fff', border: '1.5px solid var(--ne-border)',
          borderRadius: 8, boxShadow: 'var(--ne-shadow-floating)',
          zIndex: 50, maxHeight: 220, overflowY: 'auto',
        }}>
          {/* All / Clear header */}
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '6px 12px', borderBottom: '1px solid var(--ne-border)',
          }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--ne-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              {selected.length} of {options.length}
            </span>
            <button onClick={toggleAll} style={{
              background: 'none', border: 'none', cursor: 'pointer',
              fontSize: 11, fontWeight: 700, color: '#6366F1',
              padding: '2px 0',
            }}>
              {allSelected ? 'Clear all' : 'Select all'}
            </button>
          </div>

          {/* Options */}
          {options.map(o => {
            const checked = selected.includes(o.id)
            return (
              <label
                key={o.id}
                onClick={() => toggle(o.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '7px 12px', cursor: 'pointer',
                  background: checked ? 'rgba(99,102,241,0.04)' : 'transparent',
                  transition: 'background 0.1s',
                }}
              >
                <div style={{
                  width: 16, height: 16, borderRadius: 4, flexShrink: 0,
                  border: checked ? 'none' : '1.5px solid var(--ne-border)',
                  background: checked ? '#6366F1' : '#fff',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'all 0.1s',
                }}>
                  {checked && (
                    <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                      <polyline points="2,5 4,7 8,3" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </div>
                <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--ne-text)', flex: 1 }}>
                  {o.label}
                </span>
                <span style={{ fontSize: 10.5, color: 'var(--ne-text-muted)', fontWeight: 600 }}>
                  {o.count}
                </span>
              </label>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Step 3 ─────────────────────────────────────────────────────────────────────
export default function Step3Calibrate({
  city, channel, strategy,
  tierFilter, setTierFilter, routeFilter, setRouteFilter,
  routeDeviation, setRouteDeviation,
  persistence, setPersistence,
  businessCategory, setBusinessCategory,
  waysOfReaching, setWaysOfReaching,
  extraPosPerDay, setExtraPosPerDay,
  numPeople, setNumPeople,
  onBack, onNext,
}) {
  const [rule3Open, setRule3Open] = useState(false)
  const prevKpiRef = useRef(null)
  const [kpiDeltas, setKpiDeltas] = useState({})
  const [hoveredKpi, setHoveredKpi] = useState(null)
  const [budget, setBudget] = useState('')
  const tooltipTimerRef = useRef(null)

  function handleKpiEnter(idx) {
    clearTimeout(tooltipTimerRef.current)
    tooltipTimerRef.current = setTimeout(() => setHoveredKpi(idx), 320)
  }
  function handleKpiLeave() {
    clearTimeout(tooltipTimerRef.current)
    setHoveredKpi(null)
  }

  function getKpiTooltip(key) {
    const cityLabel = CITY_LABELS[city] || city || 'this market'
    const channelLabel = (CHANNEL_LABELS[channel] || channel || 'traditional').toLowerCase()
    const deviationLabel = DEVIATION_OPTIONS.find(o => o.value === routeDeviation)?.label || `${routeDeviation}m`
    const goldCount = inReach.filter(s => s.tier === 'gold').length
    const silverCount = inReach.filter(s => s.tier === 'silver').length
    const topTierPct = inReach.length > 0 ? Math.round(((goldCount + silverCount) / inReach.length) * 100) : 0
    const delta = kpiDeltas[key]
    switch (key) {
      case 'vol':
        if (delta && delta < 0) return `Volume decrease — fewer accounts pass the ${isDensity ? `${deviationLabel} deviation` : 'active tier and category'} filters in the ${cityLabel} ${channelLabel} segment.`
        if (delta && delta > 0) return `Volume increase — ${isDensity ? `${deviationLabel} deviation captures more accounts near active routes` : 'additional high-potential clusters entered scope'} in ${cityLabel}.`
        return `Total UC/wk potential across ${inReach.length} ${channelLabel} accounts in ${cityLabel} under the active filter set.`
      case 'prob':
        if (delta && delta > 0) return `Probability up — ${topTierPct}% Gold/Silver mix and ${persistence}-week cycle align with historical ${channelLabel} conversion rates in ${cityLabel}.`
        if (delta && delta < 0) return `Probability down — lower-tier accounts or a shorter cycle reduce expected conversion for the ${channelLabel} channel in ${cityLabel}.`
        return `Driven by ${topTierPct}% premium-tier mix and ${persistence}-week persistence. Historical ${channelLabel} rate for this segment in ${cityLabel}.`
      case 'cac':
        if (delta && delta > 0) return `CAC increased — ${isDensity ? `${deviationLabel} deviation adds travel overhead per account` : `${persistence}-week cycle raises total visit cost per store`}.`
        if (delta && delta < 0) return `CAC down — tighter filter constraints reduce visits and travel overhead per account.`
        return `$${cacPerStore}/account based on ${isDensity ? `${deviationLabel} route deviation` : `${persistence}-week outreach cycle`}. ${inReach.length} accounts in scope.`
      case 'invest':
        if (delta && delta > 0) return `Investment up — ${inReach.length} accounts in scope at $${cacPerStore} CAC. Adjust tier or ${isDensity ? 'distance' : 'category'} filters to reduce total spend.`
        if (delta && delta < 0) return `Investment down — fewer accounts after filter change. Currently ${inReach.length} × $${cacPerStore}.`
        return `${inReach.length} accounts × $${cacPerStore} CAC at current ${cityLabel} ${channelLabel} constraints.`
      default: return ''
    }
  }

  const isDensity = strategy === 'density'
  const stratConfig = STRATEGY_CONFIG[strategy] || {}
  const executionMode = stratConfig.executionMode || 'Own Team'

  function toggleTier(t) { setTierFilter(p => p.includes(t) ? p.filter(x => x !== t) : [...p, t]) }
  function toggleRoute(r) { setRouteFilter(p => p.includes(r) ? p.filter(x => x !== r) : [...p, r]) }
  function toggleCategory(c) { setBusinessCategory(p => p.includes(c) ? p.filter(x => x !== c) : [...p, c]) }
  function toggleWay(w) { setWaysOfReaching(p => p.includes(w) ? p.filter(x => x !== w) : [...p, w]) }

  const pool = STRATEGY_POOLS[strategy] || []

  // Initialize businessCategory on first render if empty
  useEffect(() => {
    if (businessCategory.length === 0) {
      const cats = [...new Set(pool.map(s => s.category).filter(Boolean))]
      if (cats.length > 0) setBusinessCategory(cats)
    }
  }, [])

  // Phone-only mode: clusters with only phone selected
  const phoneOnly = !isDensity && waysOfReaching.length === 1 && waysOfReaching.includes('phone')
  const isHybrid = !isDensity && waysOfReaching.includes('phone') && waysOfReaching.includes('in-person')

  // Density: filter by tier, route, category, distance
  // Clusters: filter by tier, category (no route/distance), then optionally by phone
  const baseInReach = pool.filter(s => {
    if (!tierFilter.includes(s.tier)) return false
    if (businessCategory.length > 0 && !businessCategory.includes(s.category)) return false
    if (isDensity) {
      if (!routeFilter.includes(s.route)) return false
      if (s.distance > routeDeviation) return false
    }
    return true
  })
  // Phone-only: exclude stores without phone data
  const inReach = phoneOnly ? baseInReach.filter(s => s.hasPhone) : baseInReach
  const filteredPool = pool.filter(s => {
    if (!tierFilter.includes(s.tier)) return false
    if (businessCategory.length > 0 && !businessCategory.includes(s.category)) return false
    if (isDensity && !routeFilter.includes(s.route)) return false
    return true
  })

  // Missing Data Gap: stores without phone when phone is a selected reaching method
  const phoneMissingStores = (!isDensity && waysOfReaching.includes('phone'))
    ? baseInReach.filter(s => !s.hasPhone).sort((a, b) => b.potential - a.potential)
    : []
  const phoneMissingPotential = phoneMissingStores.reduce((sum, s) => sum + s.potential, 0)

  const committedPhases = [1, 2, 3].filter(n => n <= persistence)
  const totalPotential = inReach.reduce((s, x) => s + x.potential, 0)
  const monthlyRevenue = totalPotential * MARGIN * 4
  const successProb = calcSuccessProbability(inReach, persistence)
  const cacPerStore = calcCACPerStore(routeDeviation, persistence)
  const totalCAC = cacPerStore * inReach.length
  const expectedStores = Math.round(inReach.length * (successProb / 100))
  const pathEff = PATH_EFFICIENCY[routeDeviation] ?? 0.82
  const avgUC = inReach.length > 0 ? totalPotential / inReach.length : 0
  const paybackMo = totalCAC > 0 && monthlyRevenue > 0 ? (totalCAC / monthlyRevenue).toFixed(1) : null

  // Decision Guardrail — high-priority alerts only
  const budgetLimit = parseFloat(budget) || 0
  const alertBudget = budgetLimit > 0 && totalCAC > budgetLimit
    ? { msg: `Campaign cost $${totalCAC} exceeds your $${budgetLimit} limit by $${totalCAC - budgetLimit}.` }
    : null
  const alertSuccessCritical = inReach.length > 0 && successProb < 55
    ? { msg: `${successProb}% conversion likelihood is below the 55% viability threshold. Tighten tier filter or extend persistence.` }
    : null
  const coveragePct = inReach.length > 0 ? Math.round((inReach.length / filteredPool.length) * 100) : 0
  const expectedWeeklyVol = Math.round(expectedStores * avgUC)
  const roiPct = totalCAC > 0 && monthlyRevenue > 0 ? ((monthlyRevenue / totalCAC - 1) * 100).toFixed(1) : null

  useEffect(() => {
    const current = { totalPotential, successProb, cacPerStore, totalCAC }
    if (prevKpiRef.current) {
      const prev = prevKpiRef.current
      const d = {}
      if (current.totalPotential !== prev.totalPotential) d.vol = current.totalPotential - prev.totalPotential
      if (current.successProb !== prev.successProb) d.prob = current.successProb - prev.successProb
      if (current.cacPerStore !== prev.cacPerStore) d.cac = current.cacPerStore - prev.cacPerStore
      if (current.totalCAC !== prev.totalCAC) d.invest = current.totalCAC - prev.totalCAC
      if (Object.keys(d).length > 0) setKpiDeltas(prev => ({ ...prev, ...d }))
    }
    prevKpiRef.current = current
  }, [totalPotential, successProb, cacPerStore, totalCAC])

  const allTiers = [...new Set(pool.map(s => s.tier))]
  const allRoutes = [...new Set(pool.map(s => s.route))]
  const allCategories = [...new Set(pool.map(s => s.category).filter(Boolean))]
  const tierBreakdown = allTiers.map(t => ({ t, count: pool.filter(s => s.tier === t).length, active: tierFilter.includes(t) }))
  const routeBreakdown = allRoutes.map(r => ({ r, count: pool.filter(s => s.route === r).length, active: routeFilter.includes(r) }))
  const categoryBreakdown = allCategories.map(c => ({ c, count: pool.filter(s => s.category === c).length, active: businessCategory.includes(c) }))

  return (
    <div style={{ height: 'calc(100vh - 56px)', display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'radial-gradient(ellipse at 0% 0%, #E0E7FF 0%, #F7F9FB 50%, #F7F9FB 100%)' }}>

      {/* ── Context + Actions ── */}
      <div style={{
        flexShrink: 0, padding: '8px 24px 4px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 20, padding: '0 8px', flexWrap: 'wrap' }}>
          {[
            { label: 'City',      value: CITY_LABELS[city] || city,             yellow: false },
            { label: 'Channel',   value: CHANNEL_LABELS[channel] || channel,    yellow: false },
            { label: 'Strategy',  value: STRATEGY_LABELS[strategy] || strategy, yellow: true  },
            { label: 'Execution', value: executionMode,                          yellow: false },
          ].filter(t => t.value).map(t => (
            <div key={t.label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{
                fontSize: 11, fontWeight: 700, color: '#6366F1',
                textTransform: 'uppercase', lineHeight: 1, letterSpacing: '0.08em',
              }}>{t.label}:</span>
              <span style={{
                fontSize: 12, fontWeight: 600,
                color: 'var(--ne-text)',
                background: t.yellow ? 'var(--ne-yellow)' : '#fff',
                padding: '4px 12px',
                borderRadius: 9999,
                boxShadow: t.yellow ? '0 2px 8px rgba(229,255,1,0.25)' : '0 1px 3px rgba(0,0,0,0.06)',
              }}>{t.value}</span>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
          <button onClick={onBack} style={{
            background: '#fff', color: 'var(--ne-text-secondary)',
            border: '1px solid var(--ne-border)', borderRadius: 'var(--ne-radius-pill)',
            padding: '8px 17px', fontSize: 12, fontWeight: 500, cursor: 'pointer',
          }}>{'\u2190'} Back</button>
          <button onClick={onNext} disabled={inReach.length === 0} style={{
            background: inReach.length > 0 ? 'var(--ne-text)' : 'var(--ne-surface-base)',
            color: inReach.length > 0 ? '#fff' : 'var(--ne-text-muted)',
            fontWeight: 700, padding: '7px 18px', borderRadius: 'var(--ne-radius-pill)',
            border: 'none', fontSize: 12,
            cursor: inReach.length > 0 ? 'pointer' : 'not-allowed',
          }}>Proceed with {inReach.length}{phoneOnly ? ' phone' : ''} accounts {'\u2192'}</button>
        </div>
      </div>

      {/* ── Three-column body ── */}
      <div style={{
        flex: 1, display: 'flex', gap: 24, minHeight: 0, overflow: 'hidden',
        padding: '0 24px 24px',
      }}>

        {/* ── LEFT — 292px ── */}
        <div style={{
          width: 270, flexShrink: 0, overflowY: 'auto',
          paddingBottom: 24,
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, paddingTop: 1 }}>

            {/* Card 1: Target Filters — Segment + Business Category */}
            <div style={{
              background: '#fff', borderRadius: 12, padding: '14px 16px',
              boxShadow: 'var(--ne-shadow-rest)',
              display: 'flex', flexDirection: 'column', gap: 16,
            }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--ne-text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                Target Filters
              </div>

              {/* Segment */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--ne-text-secondary)', letterSpacing: '-0.03em' }}>Segment</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 22, fontWeight: 800, color: 'var(--ne-text)', lineHeight: '22px', letterSpacing: '-0.03em' }}>{inReach.length}</span>
                    <span style={{ fontSize: 11, color: 'var(--ne-text-secondary)' }}>{phoneOnly ? 'contactable by phone' : 'accounts'}</span>
                  </div>
                  {phoneOnly && baseInReach.length > inReach.length && (
                    <div style={{ fontSize: 10, color: '#B45309', fontWeight: 600 }}>
                      {baseInReach.length - inReach.length} excluded (no phone)
                    </div>
                  )}
                  {isHybrid && (
                    <div style={{ fontSize: 10, color: 'var(--ne-text-muted)' }}>
                      {inReach.filter(s => s.hasPhone).length} by phone · {inReach.filter(s => !s.hasPhone).length} in-person only
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {tierBreakdown.map(({ t, count, active }) => (
                    <button key={t} onClick={() => toggleTier(t)} style={{
                      display: 'inline-flex', alignItems: 'center', gap: 4,
                      padding: '5px 12px', borderRadius: 100,
                      border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600,
                      background: active ? 'var(--ne-yellow)' : 'transparent',
                      color: active ? 'var(--ne-text)' : 'var(--ne-text-muted)',
                      boxShadow: active ? '0 2px 8px rgba(229,255,1,0.25)' : 'inset 0 0 0 1.5px rgba(0,0,0,0.08)',
                      letterSpacing: '-0.03em',
                    }}>
                      {TIER_META[t]?.label || t}
                      <span style={{ fontSize: 10.5, opacity: active ? 0.6 : 0.7 }}>({count})</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Business Category */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--ne-text-secondary)', letterSpacing: '-0.03em' }}>Business Category</div>
                <MultiSelectDropdown
                  options={categoryBreakdown.map(({ c, count }) => ({ id: c, label: CATEGORY_META[c]?.label || c, count }))}
                  selected={businessCategory}
                  onChange={setBusinessCategory}
                />
              </div>
            </div>

            {/* Card 2: Routing (density) or Reaching (clusters) */}
            {isDensity ? (
              <div style={{
                background: '#fff', borderRadius: 12, padding: '14px 16px',
                boxShadow: 'var(--ne-shadow-rest)',
              }}>
                <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--ne-text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>
                  Active Routing
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {routeBreakdown.map(({ r, count, active }) => {
                    const rep = ROUTE_META[r]?.supervisor
                    return (
                      <button key={r} onClick={() => toggleRoute(r)} style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '8px 12px 8px 14px', borderRadius: 8, cursor: 'pointer',
                        border: 'none', textAlign: 'left',
                        background: 'var(--ne-surface-base)',
                        borderLeft: '2.4px solid var(--ne-yellow)',
                        opacity: active ? 1 : 0.5,
                        transition: 'opacity var(--ne-ease-color)',
                      }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--ne-text)', letterSpacing: '-0.03em' }}>{r}</span>
                          {rep && <span style={{ fontSize: 10, color: 'var(--ne-text-muted)' }}>{rep}</span>}
                        </div>
                        <span style={{
                          fontSize: 10, fontWeight: 700,
                          padding: '2px 8px', borderRadius: 100,
                          background: 'rgba(55,96,249,0.6)',
                          color: '#fff',
                        }}>
                          {count}
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>
            ) : (
              <div style={{
                background: '#fff', borderRadius: 12, padding: '14px 16px',
                boxShadow: 'var(--ne-shadow-rest)',
                display: 'flex', flexDirection: 'column', gap: 16,
              }}>
                <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--ne-text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  Outreach
                </div>

                {/* Ways of reaching */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--ne-text-secondary)', letterSpacing: '-0.03em' }}>Ways of Reaching</div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {[{ id: 'phone', label: 'Phone' }, { id: 'in-person', label: 'In-person' }].map(w => {
                      const active = waysOfReaching.includes(w.id)
                      const count = w.id === 'phone'
                        ? pool.filter(s => s.hasPhone).length
                        : pool.length
                      return (
                        <button key={w.id} onClick={() => toggleWay(w.id)} style={{
                          display: 'inline-flex', alignItems: 'center', gap: 4,
                          padding: '5px 12px', borderRadius: 100,
                          border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600,
                          background: active ? 'var(--ne-yellow)' : 'transparent',
                          color: active ? 'var(--ne-text)' : 'var(--ne-text-muted)',
                          boxShadow: active ? '0 2px 8px rgba(229,255,1,0.25)' : 'inset 0 0 0 1.5px rgba(0,0,0,0.08)',
                          letterSpacing: '-0.03em',
                        }}>
                          {w.label}
                          <span style={{ fontSize: 10.5, opacity: active ? 0.6 : 0.7 }}>({count})</span>
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Number of people */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--ne-text)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>People</span>
                    <span style={{
                      fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 100,
                      background: 'var(--ne-yellow)', color: 'var(--ne-text)',
                    }}>
                      {numPeople}
                    </span>
                  </div>
                  <SegPill options={NUM_PEOPLE_OPTIONS} value={numPeople} onChange={setNumPeople} />
                  <div style={{ fontSize: 10, color: 'var(--ne-text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ fontSize: 11 }}>{'\u24D8'}</span>
                    External team headcount assigned to this territory.
                  </div>
                </div>

                {/* Missing Data Gap Alert */}
                {phoneMissingStores.length > 0 && (
                  <div style={{
                    padding: '10px 14px', borderRadius: 10,
                    background: phoneOnly ? 'rgba(245,158,11,0.08)' : 'rgba(99,102,241,0.06)',
                    border: `1px solid ${phoneOnly ? 'rgba(245,158,11,0.2)' : 'rgba(99,102,241,0.12)'}`,
                    display: 'flex', flexDirection: 'column', gap: 6,
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={phoneOnly ? '#D97706' : '#6366F1'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                        <line x1="12" y1="9" x2="12" y2="13" />
                        <line x1="12" y1="17" x2="12.01" y2="17" />
                      </svg>
                      <span style={{ fontSize: 11, fontWeight: 700, color: phoneOnly ? '#B45309' : '#6366F1', letterSpacing: '-0.02em' }}>
                        Missing Data Gap
                      </span>
                    </div>
                    <div style={{ fontSize: 10.5, color: phoneOnly ? '#92400E' : 'var(--ne-text-secondary)', lineHeight: 1.5 }}>
                      {phoneOnly
                        ? `+${phoneMissingPotential} UC/wk potential excluded — no phone on file.`
                        : `${phoneMissingStores.length} account${phoneMissingStores.length > 1 ? 's' : ''} will need in-person visits.`}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      {phoneMissingStores.map(s => (
                        <div key={s.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 10.5 }}>
                          <span style={{ color: 'var(--ne-text)', fontWeight: 500 }}>{s.name}</span>
                          <span style={{ color: phoneOnly ? '#D97706' : '#6366F1', fontWeight: 700 }}>+{s.potential}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Card 3: Constraints */}
            <div style={{
              background: '#fff', borderRadius: 12, padding: '14px 16px',
              boxShadow: 'var(--ne-shadow-rest)',
              display: 'flex', flexDirection: 'column', gap: 16,
            }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--ne-text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                Constraints
              </div>

              {/* Route Deviation — density only */}
              {isDensity && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--ne-text)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Route Deviation</span>
                    <span style={{
                      fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 100,
                      background: 'var(--ne-yellow)', color: 'var(--ne-text)',
                    }}>
                      {DEVIATION_OPTIONS.find(o => o.value === routeDeviation)?.label}
                    </span>
                  </div>
                  <SegPill options={DEVIATION_OPTIONS} value={routeDeviation} onChange={setRouteDeviation} />
                  <div style={{ fontSize: 10, color: 'var(--ne-text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ fontSize: 11 }}>{'\u24D8'}</span>
                    {routeDeviation <= 100 && 'Walk-across-the-street reach.'}
                    {routeDeviation === 500 && 'Short detour. Minimal overhead.'}
                    {routeDeviation === 1000 && 'Planned deviation. Supervisor briefing advised.'}
                    {routeDeviation >= 2000 && 'Territory expansion. Route redesign likely.'}
                  </div>
                </div>
              )}

              {/* Establishment Cycle — density only */}
              {isDensity && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--ne-text)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Establishment Cycle</span>
                    <span style={{
                      fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 100,
                      background: 'var(--ne-yellow)', color: 'var(--ne-text)',
                    }}>
                      {persistence} wk{persistence > 1 ? 's' : ''}
                    </span>
                  </div>
                  <SegPill options={PERSISTENCE_OPTIONS} value={persistence} onChange={setPersistence} />
                  <div style={{ fontSize: 10, color: 'var(--ne-text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ fontSize: 11 }}>{'\u24D8'}</span>
                    {persistence === 1 && 'One drop. Not enough for Active Drop.'}
                    {persistence === 2 && 'Covers first two visits. Phase 3 excluded.'}
                    {persistence === 3 && 'Full Rule of 3. Minimum to reach Active Drop.'}
                    {persistence === 4 && 'Rule of 3 + buffer for slow converters.'}
                  </div>
                </div>
              )}

              {/* Extra POS per day */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--ne-text)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                    Extra POS / {isDensity ? 'person /' : ''} day
                  </span>
                  <span style={{
                    fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 100,
                    background: 'var(--ne-yellow)', color: 'var(--ne-text)',
                  }}>
                    {extraPosPerDay}
                  </span>
                </div>
                <SegPill options={EXTRA_POS_OPTIONS} value={extraPosPerDay} onChange={setExtraPosPerDay} />
                <div style={{ fontSize: 10, color: 'var(--ne-text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ fontSize: 11 }}>{'\u24D8'}</span>
                  {isDensity
                    ? 'Additional stops each rep adds to their daily route.'
                    : 'New accounts external team visits per day.'}
                </div>
              </div>

              {/* Campaign Budget */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ne-text)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  Campaign Budget
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--ne-text-muted)' }}>$</span>
                  <input
                    type="number"
                    value={budget}
                    onChange={e => setBudget(e.target.value)}
                    placeholder="Set limit…"
                    style={{
                      flex: 1, padding: '6px 10px', borderRadius: 8,
                      border: `1.5px solid ${alertBudget ? '#DC2626' : 'var(--ne-border)'}`,
                      fontSize: 12, fontFamily: 'var(--ka-font-body)',
                      background: 'var(--ne-surface-base)', color: 'var(--ne-text)', outline: 'none',
                    }}
                  />
                </div>
                <div style={{ fontSize: 10, color: alertBudget ? '#DC2626' : 'var(--ne-text-muted)', fontWeight: alertBudget ? 600 : 400 }}>
                  Current investment: <strong>${totalCAC}</strong>
                </div>
              </div>

              {/* Rule of 3 Tracker — density only, collapsible */}
              {isDensity && (
                <>
                  <button
                    onClick={() => setRule3Open(o => !o)}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      width: '100%', padding: rule3Open ? '18px 20px 0' : '18px 20px',
                      background: '#fff', border: 'none', cursor: 'pointer',
                      borderTop: '0.8px solid var(--ne-border)',
                      margin: '0 -16px', marginBottom: rule3Open ? 0 : -14,
                      width: 'calc(100% + 32px)',
                    }}
                  >
                    <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--ne-text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                      Rule of 3 Tracker
                    </span>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--ne-text-muted)" strokeWidth="2" style={{ transform: rule3Open ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s ease' }}>
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </button>

                  {rule3Open && (
                    <div style={{ display: 'flex', flexDirection: 'column', paddingTop: 4 }}>
                      {[1, 2, 3].map(n => {
                        const ph = PHASE_META[n]
                        const on = committedPhases.includes(n)
                        const isLast = n === 3
                        return (
                          <div key={n} style={{
                            display: 'flex', alignItems: 'flex-start', gap: 12, padding: '10px 0',
                            opacity: on ? 1 : 0.35, transition: 'opacity var(--ne-ease-color)',
                          }}>
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 28, flexShrink: 0 }}>
                              <div style={{
                                width: 28, height: 28, borderRadius: 8,
                                background: on && isLast ? 'var(--ne-yellow)' : '#fff',
                                boxShadow: 'var(--ne-shadow-lifted)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: 11, fontWeight: 800, color: 'var(--ne-text)',
                              }}>
                                {on && isLast ? '\u2713' : n}
                              </div>
                              {!isLast && <div style={{ width: 2, height: 16, background: on ? 'var(--ne-yellow)' : 'var(--ne-border)', borderRadius: 1, marginTop: 4 }} />}
                            </div>
                            <div style={{ flex: 1, paddingTop: 2 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 1 }}>
                                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--ne-text)', letterSpacing: '-0.03em' }}>{ph.label}</span>
                                <span style={{
                                  fontSize: 9.5, fontWeight: 600, color: 'var(--ne-text-muted)',
                                  padding: '1px 7px', borderRadius: 100,
                                  background: 'var(--ne-surface-base)',
                                }}>{ph.week}</span>
                              </div>
                              <div style={{ fontSize: 11, color: 'var(--ne-text-muted)', lineHeight: 1.4, letterSpacing: '-0.03em' }}>{ph.desc}</div>
                            </div>
                          </div>
                        )
                      })}
                      <div style={{
                        padding: '10px 14px 8px', borderRadius: 12, fontSize: 11.5, fontWeight: 600,
                        background: persistence >= 3 ? 'var(--ne-yellow-soft)' : 'var(--ne-surface-base)',
                        color: persistence >= 3 ? 'var(--ne-text)' : 'var(--ne-text-muted)',
                        letterSpacing: '-0.03em',
                      }}>
                        {persistence >= 3 ? '\u2713 Full Rule of 3 committed' : `\u26A0 ${persistence}-week cycle does not cover Phase 3`}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>

        {/* ── CENTER — KPIs + Map ── */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 11, alignItems: 'center', justifyContent: 'center', minWidth: 0 }}>

          {/* KPI strip — 4 uniform cards */}
          <div style={{ display: 'flex', alignItems: 'stretch', gap: 10, width: '100%', height: 80, flexShrink: 0 }}>
            {[
              {
                idx: 0, dk: 'vol', isHero: true,
                label: 'Potential Volume',
                value: inReach.length > 0 ? `+${totalPotential}` : '\u2014',
                unit: 'UC/wk',
              },
              { idx: 1, dk: 'prob', label: 'Success Probability', value: inReach.length > 0 ? `${successProb}%` : '\u2014', inv: false },
              { idx: 2, dk: 'cac',  label: 'Est. CAC / Store',    value: `$${cacPerStore}`,  inv: true  },
              { idx: 3, dk: 'invest', label: 'Total Investment',   value: `$${totalCAC}`,    inv: true  },
            ].map(k => (
              <div
                key={k.idx}
                style={{ flex: 1, position: 'relative', cursor: 'default' }}
                onMouseEnter={() => handleKpiEnter(k.idx)}
                onMouseLeave={handleKpiLeave}
              >
                {k.isHero ? (
                  <div style={{
                    background: 'linear-gradient(141deg, #6366F1 0%, #818CF8 100%)',
                    borderRadius: 12, padding: '14px 18px',
                    position: 'relative', overflow: 'hidden',
                    boxShadow: '0 4px 16px rgba(99,102,241,0.25)',
                    display: 'flex', flexDirection: 'column', gap: 5,
                    height: '100%', boxSizing: 'border-box',
                  }}>
                    <div style={{ position: 'absolute', top: -10, right: -10, width: 44, height: 44, borderRadius: 22, background: 'rgba(255,255,255,0.08)' }} />
                    <div style={{ fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,0.55)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                      {k.label}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                      <span style={{ fontSize: 22, fontWeight: 800, color: '#fff', lineHeight: 1, letterSpacing: '-0.025em' }}>{k.value}</span>
                      {k.unit && <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', fontWeight: 500 }}>{k.unit}</span>}
                      <KpiDelta delta={kpiDeltas[k.dk]} onDark />
                    </div>
                  </div>
                ) : (
                  <div style={{
                    background: '#fff', borderRadius: 12, padding: '14px 18px',
                    boxShadow: 'var(--ne-shadow-rest)',
                    display: 'flex', flexDirection: 'column', gap: 5,
                    height: '100%', boxSizing: 'border-box',
                  }}>
                    <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--ne-text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', whiteSpace: 'nowrap' }}>
                      {k.label}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 3 }}>
                      <span style={{ fontSize: 22, fontWeight: 800, color: 'var(--ne-text)', lineHeight: 1, letterSpacing: '-0.02em' }}>{k.value}</span>
                      <KpiDelta delta={kpiDeltas[k.dk]} inverted={k.inv} />
                    </div>
                  </div>
                )}
                {hoveredKpi === k.idx && (
                  <div style={{
                    position: 'absolute', top: 'calc(100% + 8px)', left: '50%',
                    transform: 'translateX(-50%)',
                    background: 'rgba(12,12,16,0.95)', color: 'rgba(255,255,255,0.9)',
                    fontSize: 11, fontWeight: 400, lineHeight: 1.5,
                    padding: '8px 12px', borderRadius: 7,
                    maxWidth: 260, width: 'max-content',
                    pointerEvents: 'none', zIndex: 200,
                    boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
                  }}>
                    <div style={{ position: 'absolute', bottom: '100%', left: '50%', transform: 'translateX(-50%)', width: 0, height: 0, borderLeft: '5px solid transparent', borderRight: '5px solid transparent', borderBottom: '5px solid rgba(12,12,16,0.95)' }} />
                    {getKpiTooltip(k.dk)}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Map */}
          <div style={{
            flex: 1, width: '100%', position: 'relative', minHeight: 0,
            overflow: 'hidden', background: '#161821', borderRadius: 12,
          }}>
            <CalibrationMap strategy={strategy} filteredPool={filteredPool} inReach={inReach} routeDeviation={routeDeviation} />
            <div style={{
              position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 2,
              background: 'rgba(22,24,33,0.85)', backdropFilter: 'blur(4px)',
              padding: '8px 16px',
              display: 'flex', alignItems: 'center', gap: 20,
              borderTop: '0.8px solid rgba(255,255,255,0.06)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 5, height: 5, borderRadius: 2.5, background: 'var(--ne-yellow)' }} />
                <span style={{ fontSize: 10, fontWeight: 600, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Coverage</span>
                <span style={{ fontSize: 13, fontWeight: 800, color: '#fff', letterSpacing: '-0.03em' }}>{coveragePct || 100}%</span>
              </div>
              <div style={{ width: 1, height: 14, background: 'rgba(255,255,255,0.1)' }} />
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 10, fontWeight: 600, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Nodes</span>
                <span style={{ fontSize: 13, fontWeight: 800, color: '#fff', letterSpacing: '-0.03em' }}>{OWNED_POS.length * 8 + inReach.length}</span>
              </div>
              <div style={{ width: 1, height: 14, background: 'rgba(255,255,255,0.1)' }} />
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 10, fontWeight: 600, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Match</span>
                <span style={{ fontSize: 13, fontWeight: 800, color: '#fff', letterSpacing: '-0.03em' }}>98.4%</span>
              </div>
            </div>
          </div>
        </div>

        {/* ── RIGHT — Projected Outcome ── */}
        <div style={{
          width: 340, flexShrink: 0,
          display: 'flex', flexDirection: 'column',
          background: '#fff',
          borderRadius: 12,
          boxShadow: 'var(--ne-shadow-rest)',
          overflow: 'hidden',
        }}>
          <div style={{
            flexShrink: 0, padding: '18px 20px 16px',
            borderBottom: '0.8px solid var(--ne-border)',
          }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--ne-text)', letterSpacing: '-0.03em' }}>PROJECTED OUTCOME</span>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px 24px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

              {/* ── Decision Guardrail ── */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--ne-text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  Execution Feasibility
                </div>

                {alertBudget && (
                  <div style={{ background: '#FEF2F2', borderRadius: 10, padding: '12px 14px', borderLeft: '3px solid #DC2626' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#DC2626" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
                      </svg>
                      <span style={{ fontSize: 9, fontWeight: 800, color: '#DC2626', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Budget Exceeded</span>
                    </div>
                    <div style={{ fontSize: 11, color: '#7F1D1D', lineHeight: 1.5 }}>{alertBudget.msg}</div>
                  </div>
                )}

                {alertSuccessCritical && (
                  <div style={{ background: '#FEF2F2', borderRadius: 10, padding: '12px 14px', borderLeft: '3px solid #DC2626' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#DC2626" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
                      </svg>
                      <span style={{ fontSize: 9, fontWeight: 800, color: '#DC2626', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Low Viability</span>
                    </div>
                    <div style={{ fontSize: 11, color: '#7F1D1D', lineHeight: 1.5 }}>{alertSuccessCritical.msg}</div>
                  </div>
                )}

                {!alertBudget && !alertSuccessCritical && (
                  <div style={{ background: 'rgba(16,185,129,0.06)', borderRadius: 10, padding: '12px 14px', border: '1px solid rgba(16,185,129,0.18)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                        <circle cx="7" cy="7" r="6.5" stroke="#10B981" strokeWidth="1.2" />
                        <polyline points="4,7 6,9.5 10,4.5" stroke="#10B981" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 700, color: '#059669', marginBottom: 1 }}>Plan is feasible</div>
                        <div style={{ fontSize: 10, color: '#065F46', lineHeight: 1.4 }}>No critical blockers detected.</div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div style={{ height: 1, background: 'var(--ne-border)' }} />

              {/* Weekly Volume */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: 10,
                    background: 'linear-gradient(135deg, #6366F1 0%, #818CF8 100%)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0,
                  }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
                      <polyline points="17 6 23 6 23 12" />
                    </svg>
                  </div>
                  <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--ne-info)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                    Weekly Volume
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', paddingBottom: 4 }}>
                  <span style={{ fontSize: 22, fontWeight: 800, color: 'var(--ne-text)', letterSpacing: '-0.03em' }}>
                    +{expectedWeeklyVol} UC/wk
                  </span>
                  {roiPct && Number(roiPct) > 0 && (
                    <span style={{
                      fontSize: 10, fontWeight: 700, color: 'var(--ne-info)',
                      background: 'rgba(99,102,241,0.15)', padding: '4px 12px',
                      borderRadius: 9999, textTransform: 'uppercase', letterSpacing: '0.08em',
                    }}>
                      +{roiPct}%
                    </span>
                  )}
                </div>
              </div>

              {/* Metric rows */}
              {[
                {
                  label: 'Projected Active Accounts',
                  value: `${expectedStores} of ${inReach.length}`,
                  icon: (
                    <svg width="20" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--ne-text-muted)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                      <circle cx="9" cy="7" r="4" />
                      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                    </svg>
                  ),
                },
                {
                  label: 'Time to Maturity',
                  value: `${persistence + 1} weeks`,
                  icon: (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--ne-text-muted)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10" />
                      <polyline points="12 6 12 12 16 14" />
                    </svg>
                  ),
                },
                {
                  label: 'Payback Period',
                  value: paybackMo ? `~${paybackMo} mo` : '\u2014',
                  icon: (
                    <svg width="20" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--ne-text-muted)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="12" y1="1" x2="12" y2="23" />
                      <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                    </svg>
                  ),
                },
              ].map((row, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0' }}>
                  <div style={{ width: 22, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {row.icon}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--ne-text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                      {row.label}
                    </span>
                    <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--ne-text)', letterSpacing: '-0.03em' }}>
                      {row.value}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
