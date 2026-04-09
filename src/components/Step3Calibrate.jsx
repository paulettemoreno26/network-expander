import { useState, useRef, useEffect } from 'react'
import mapboxgl from 'mapbox-gl'
import ContextStrip from './ContextStrip.jsx'
import { DENSITY_WS, CLUSTER_WS, OWNED_POS, ROUTES, OTHER_WS, TIER_META, ROUTE_META, svgToLngLat } from './Step2Discovery.jsx'

// ── KPI Delta indicator ───────────────────────────────────────────────────────
function KpiDelta({ delta, inverted = false }) {
  if (!delta || delta === 0) return null
  const isUp = delta > 0
  const isGood = inverted ? !isUp : isUp
  const color = isGood ? 'var(--ne-positive)' : 'var(--ne-attention)'
  const arrow = isUp ? '▲' : '▼'
  const formatted = Math.abs(delta)
  return (
    <span style={{
      fontSize: 9, fontWeight: 700, color,
      marginLeft: 4, whiteSpace: 'nowrap',
      animation: 'fadeSlideIn 0.15s ease forwards',
      opacity: 1, transition: 'opacity 0.4s ease',
    }}>
      {arrow} {formatted > 0 ? (isUp ? '+' : '-') + formatted : ''}
    </span>
  )
}

// ── Strategy config ────────────────────────────────────────────────────────────
const STRATEGY_POOLS = { density: DENSITY_WS, clusters: CLUSTER_WS }
const STRATEGY_META  = {
  density:  { label: 'Density Fill',           color: '#141417', bg: '#F2F2F2', border: '#d4d5d6' },
  clusters: { label: 'High-Potential Clusters', color: '#141417', bg: '#F2F2F2', border: '#d4d5d6' },
}

const MARGIN = 0.255

// ── Tier base probability ──────────────────────────────────────────────────────
const TIER_BASE_PROB = { gold: 0.84, silver: 0.67, bronze: 0.48 }
const PERSISTENCE_PROB_MULT = { 1: 0.67, 2: 0.85, 3: 1.00, 4: 1.06 }
function calcSuccessProbability(stores, persistence) {
  if (!stores.length) return 0
  const mult = PERSISTENCE_PROB_MULT[persistence] ?? 1.0
  const avg  = stores.reduce((sum, s) => sum + (TIER_BASE_PROB[s.tier] ?? 0.5) * mult, 0) / stores.length
  return Math.min(95, Math.round(avg * 100))
}

// ── Route Efficiency / CAC ────────────────────────────────────────────────────
const DEVIATION_BASE_CAC      = { 100: 5, 500: 9, 1000: 16, 2000: 26 }
const PERSISTENCE_VISIT_COUNT = { 1: 1.0, 2: 1.8, 3: 2.6, 4: 3.2 }
function calcCACPerStore(routeDeviation, persistence) {
  return Math.round((DEVIATION_BASE_CAC[routeDeviation] ?? 16) * (PERSISTENCE_VISIT_COUNT[persistence] ?? 2.6))
}

// ── Strategic Alignment ───────────────────────────────────────────────────────
const PATH_EFFICIENCY = { 100: 0.98, 500: 0.91, 1000: 0.82, 2000: 0.68 }
function getValueScore(avgUC) {
  if (avgUC > 60) return 1.00
  if (avgUC >= 35) return 0.85
  if (avgUC >= 20) return 0.65
  return 0.45
}

// ── Potential range classification ───────────────────────────────────────────
const POTENTIAL_RANGES = [
  { id: 'low',   label: 'Low',       max: 20,       color: '#141417', bg: '#F2F2F2', border: '#d4d5d6' },
  { id: 'med',   label: 'Med',       max: 35,       color: '#141417', bg: '#F2F2F2', border: '#d4d5d6' },
  { id: 'high',  label: 'High',      max: 60,       color: '#141417', bg: '#F2F2F2', border: '#d4d5d6' },
  { id: 'vhigh', label: 'Very High', max: Infinity, color: '#141417', bg: '#F2F2F2', border: '#d4d5d6' },
]
function getPotentialRange(p) {
  if (p < 20) return 'low'
  if (p < 35) return 'med'
  if (p <= 60) return 'high'
  return 'vhigh'
}

// ── Match confidence by tier ──────────────────────────────────────────────────
const TIER_CONFIDENCE = { gold: 94, silver: 81, bronze: 67 }

// ── UI constants ──────────────────────────────────────────────────────────────
const DEVIATION_OPTIONS = [
  { value: 100,  label: '100m', desc: 'Doorstep' },
  { value: 500,  label: '500m', desc: 'Block' },
  { value: 1000, label: '1km',  desc: 'District' },
  { value: 2000, label: '2km',  desc: 'Territory' },
]
const PERSISTENCE_OPTIONS = [
  { value: 1, label: '1 wk',  desc: 'Sprint' },
  { value: 2, label: '2 wks', desc: 'Push' },
  { value: 3, label: '3 wks', desc: 'Program', recommended: true },
  { value: 4, label: '4 wks', desc: 'Campaign' },
]
const PHASE_META = {
  1: { label: 'Conversion', week: 'Week 1',    color: 'var(--ne-attention)', bg: '#F2F2F2',
       desc: 'Rep visits accounts. Goal: get one Core SKU on shelf.' },
  2: { label: 'Retention',  week: 'Weeks 2–3', color: 'var(--ne-text-secondary)', bg: '#F2F2F2',
       desc: 'Validate placement and reinforce the relationship.' },
  3: { label: 'Active Drop', week: 'Week 4+',  color: 'var(--ne-positive)', bg: 'var(--ne-yellow)',
       desc: 'Third order confirmed. Account graduates to Growth Engine.' },
}

// ── Geo helpers ────────────────────────────────────────────────────────────────

function buildPoolGeo(pool, inReachIds, filteredIds) {
  return {
    type: 'FeatureCollection',
    features: pool.map(s => {
      const isActive = inReachIds.has(s.id)
      const isScoped = !isActive && filteredIds.has(s.id)
      return {
        type: 'Feature',
        properties: {
          id: s.id, name: s.name, potential: s.potential, tier: s.tier,
          dotState: isActive ? 'active' : isScoped ? 'scoped' : 'muted',
        },
        geometry: { type: 'Point', coordinates: svgToLngLat(s.x, s.y) },
      }
    }),
  }
}

const GEO_ROUTES = {
  type: 'FeatureCollection',
  features: ROUTES.map(r => ({
    type: 'Feature',
    properties: { id: r.id },
    geometry: {
      type: 'LineString',
      coordinates: r.points.split(' ').map(pt => {
        const [x, y] = pt.split(',').map(Number)
        return svgToLngLat(x, y)
      }),
    },
  })),
}

const GEO_OWNED_POS = {
  type: 'FeatureCollection',
  features: OWNED_POS.map(p => ({
    type: 'Feature',
    properties: { id: p.id },
    geometry: { type: 'Point', coordinates: svgToLngLat(p.x, p.y) },
  })),
}

const GEO_OTHER_WS = {
  type: 'FeatureCollection',
  features: OTHER_WS.map(d => ({
    type: 'Feature',
    properties: { id: d.id },
    geometry: { type: 'Point', coordinates: svgToLngLat(d.x, d.y) },
  })),
}

// ── Calibration Map (Mapbox) ───────────────────────────────────────────────────
function CalibrationMap({ strategy, filteredPool, inReach, routeDeviation }) {
  const containerRef   = useRef(null)
  const mapRef         = useRef(null)
  const readyRef       = useRef(false)
  const filteredRef    = useRef(filteredPool)
  const inReachRef     = useRef(inReach)
  const deviationRef   = useRef(routeDeviation)

  const pool = STRATEGY_POOLS[strategy] || []

  useEffect(() => {
    if (!containerRef.current) return
    mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN || ''

    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: 'mapbox://styles/mapbox/dark-v11',
      center: [-100.325, 25.688],
      zoom: 12.5,
      interactive: true,
      attributionControl: false,
      logoPosition: 'bottom-right',
    })
    mapRef.current = map

    map.on('load', () => {
      const inReachIds  = new Set(inReachRef.current.map(s => s.id))
      const filteredIds = new Set(filteredRef.current.map(s => s.id))
      const dev         = deviationRef.current

      // Route buffer (wide blurred line = visual proxy for buffer zone)
      map.addSource('routes', { type: 'geojson', data: GEO_ROUTES })
      map.addLayer({
        id: 'route-buffer', type: 'line', source: 'routes',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': 'rgba(229,255,1,0.15)',
          'line-opacity': 0.07,
          'line-blur': 6,
          'line-width': ['interpolate', ['exponential', 2], ['zoom'],
            11, dev / 80,
            14, dev / 10,
            17, dev / 1.2,
          ],
        },
      })
      map.addLayer({
        id: 'route-line', type: 'line', source: 'routes',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': 'rgba(255,255,255,0.6)', 'line-width': 2.2, 'line-opacity': 0.65 },
      })

      // Ambient other white-space dots
      map.addSource('other-ws', { type: 'geojson', data: GEO_OTHER_WS })
      map.addLayer({
        id: 'other-ws-dot', type: 'circle', source: 'other-ws',
        paint: {
          'circle-radius': 3, 'circle-color': '#666666', 'circle-opacity': 0.5,
          'circle-stroke-width': 0.8, 'circle-stroke-color': '#444444',
        },
      })

      // Pool stores with data-driven dotState
      map.addSource('pool-ws', { type: 'geojson', data: buildPoolGeo(pool, inReachIds, filteredIds) })
      map.addLayer({
        id: 'pool-ws-dot', type: 'circle', source: 'pool-ws',
        paint: {
          'circle-radius':  ['match', ['get', 'dotState'], 'active', 6, 'scoped', 4.5, 3.5],
          'circle-color':   ['match', ['get', 'dotState'], 'active', '#E5FF01', 'scoped', '#E5FF01', '#666666'],
          'circle-opacity': ['match', ['get', 'dotState'], 'active', 1, 'scoped', 0.35, 0.2],
          'circle-stroke-width': ['match', ['get', 'dotState'], 'active', 1.5, 0.8],
          'circle-stroke-color': '#FFFFFF',
        },
      })
      map.setPaintProperty('pool-ws-dot', 'circle-radius-transition', { duration: 300 })
      map.setPaintProperty('pool-ws-dot', 'circle-opacity-transition', { duration: 300 })

      // Owned POS (always on top)
      map.addSource('owned-pos', { type: 'geojson', data: GEO_OWNED_POS })
      map.addLayer({
        id: 'owned-pos-dot', type: 'circle', source: 'owned-pos',
        paint: {
          'circle-radius': 5.5, 'circle-color': '#FFFFFF',
          'circle-stroke-width': 1.5, 'circle-stroke-color': 'rgba(255,255,255,0.5)',
        },
      })

      // Tooltip popup
      const popup = new mapboxgl.Popup({ closeButton: false, closeOnClick: false, offset: 10 })
      map.on('mouseenter', 'pool-ws-dot', e => {
        map.getCanvas().style.cursor = 'pointer'
        const { name, potential, tier, dotState } = e.features[0].properties
        const conf     = TIER_CONFIDENCE[tier] ?? 70
        const ucColor  = dotState !== 'muted' ? '#141417' : '#999ea6'
        popup.setLngLat(e.lngLat)
          .setHTML(
            `<div style="font:700 10.5px/1.4 Inter,sans-serif;color:#141417">${name}</div>` +
            `<div style="font:normal 10px/1.4 Inter,sans-serif;color:${ucColor}">+${potential} UC/wk</div>` +
            `<div style="font:normal 10px/1.4 Inter,sans-serif;color:#999ea6">${conf}% Match Confidence</div>`
          )
          .addTo(map)
      })
      map.on('mouseleave', 'pool-ws-dot', () => {
        map.getCanvas().style.cursor = ''
        popup.remove()
      })

      readyRef.current = true
    })

    return () => {
      readyRef.current = false
      map.remove()
    }
  }, [])

  // Update pool dots when filter or inReach changes
  useEffect(() => {
    filteredRef.current = filteredPool
    inReachRef.current  = inReach
    if (!readyRef.current) return
    const inReachIds  = new Set(inReach.map(s => s.id))
    const filteredIds = new Set(filteredPool.map(s => s.id))
    const src = mapRef.current?.getSource('pool-ws')
    if (src) src.setData(buildPoolGeo(pool, inReachIds, filteredIds))
  }, [filteredPool, inReach])

  // Update route buffer width when deviation changes
  useEffect(() => {
    deviationRef.current = routeDeviation
    if (!readyRef.current) return
    mapRef.current?.setPaintProperty('route-buffer', 'line-width', [
      'interpolate', ['exponential', 2], ['zoom'],
      11, routeDeviation / 80,
      14, routeDeviation / 10,
      17, routeDeviation / 1.2,
    ])
  }, [routeDeviation])

  return <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
}

// ── Segmented control ──────────────────────────────────────────────────────────
function SegmentedControl({ options, value, onChange }) {
  return (
    <div style={{ display: 'flex', gap: 4 }}>
      {options.map(opt => {
        const active = value === opt.value
        return (
          <button key={opt.value} onClick={() => onChange(opt.value)} style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1,
            padding: '5px 8px', borderRadius: 'var(--ka-radius)', cursor: 'pointer',
            flex: 1, position: 'relative',
            background: active ? 'var(--ne-surface-card)' : 'transparent',
            border: `1.5px solid ${active ? 'var(--ne-border-active)' : 'var(--ne-border)'}`,
            transition: 'all var(--ne-ease-color)',
          }}>
            <span style={{ fontSize: 11, fontWeight: active ? 700 : 500, color: active ? 'var(--ne-text)' : 'var(--ne-text-muted)', whiteSpace: 'nowrap' }}>
              {opt.label}
            </span>
            <span style={{ fontSize: 9, color: active ? 'var(--ne-text-secondary)' : 'var(--ne-text-muted)', whiteSpace: 'nowrap' }}>
              {opt.desc}
            </span>
            {opt.recommended && (
              <span style={{
                position: 'absolute', top: -7, right: -5,
                fontSize: 7.5, fontWeight: 700, color: 'var(--ne-text)',
                background: 'var(--ne-yellow)', border: '1px solid var(--ne-border-active)',
                borderRadius: 8, padding: '1px 4px', letterSpacing: '0.04em',
              }}>REC</span>
            )}
          </button>
        )
      })}
    </div>
  )
}

// ── Step 3 ─────────────────────────────────────────────────────────────────────
export default function Step3Calibrate({
  city, channel, strategy,
  tierFilter: initialTierFilter, routeFilter: initialRouteFilter,
  routeDeviation, setRouteDeviation,
  persistence, setPersistence,
  onBack, onNext,
}) {
  const [rightTab, setRightTab] = useState('logic')
  const [localTierFilter, setLocalTierFilter]       = useState(() => initialTierFilter)
  const [localRouteFilter, setLocalRouteFilter]     = useState(() => initialRouteFilter)
  const [potentialFilter, setPotentialFilter]       = useState(() => {
    const p = STRATEGY_POOLS[strategy] || []
    return POTENTIAL_RANGES
      .filter(r => p.filter(s => getPotentialRange(s.potential) === r.id).length > 0)
      .map(r => r.id)
  })

  const prevKpiRef = useRef(null)
  const [kpiDeltas, setKpiDeltas] = useState({})

  function toggleTier(t) {
    setLocalTierFilter(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t])
  }
  function toggleRoute(r) {
    setLocalRouteFilter(prev => prev.includes(r) ? prev.filter(x => x !== r) : [...prev, r])
  }
  function togglePotential(id) {
    setPotentialFilter(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  const meta = STRATEGY_META[strategy] || STRATEGY_META.density
  const pool = STRATEGY_POOLS[strategy] || []

  const inReach = pool.filter(s =>
    localTierFilter.includes(s.tier) &&
    localRouteFilter.includes(s.route) &&
    potentialFilter.includes(getPotentialRange(s.potential)) &&
    s.distance <= routeDeviation
  )
  const filteredPool = pool.filter(s =>
    localTierFilter.includes(s.tier) &&
    localRouteFilter.includes(s.route) &&
    potentialFilter.includes(getPotentialRange(s.potential))
  )

  const committedPhases = [1, 2, 3].filter(n => n <= persistence)
  const totalPotential  = inReach.reduce((s, x) => s + x.potential, 0)
  const monthlyRevenue  = totalPotential * MARGIN * 4
  const successProb     = calcSuccessProbability(inReach, persistence)
  const cacPerStore     = calcCACPerStore(routeDeviation, persistence)
  const totalCAC        = cacPerStore * inReach.length
  const expectedStores  = Math.round(inReach.length * (successProb / 100))

  const pathEff          = PATH_EFFICIENCY[routeDeviation] ?? 0.82
  const avgUC            = inReach.length > 0 ? totalPotential / inReach.length : 0
  const strategicAlign   = inReach.length > 0 ? Math.round(pathEff * getValueScore(avgUC) * 100) : 0
  const paybackMo        = totalCAC > 0 && monthlyRevenue > 0 ? (totalCAC / monthlyRevenue).toFixed(1) : null

  useEffect(() => {
    const current = { totalPotential, successProb, strategicAlign, cacPerStore, totalCAC }
    if (prevKpiRef.current) {
      const prev = prevKpiRef.current
      const deltas = {}
      if (current.totalPotential !== prev.totalPotential) deltas.vol = current.totalPotential - prev.totalPotential
      if (current.successProb !== prev.successProb) deltas.prob = current.successProb - prev.successProb
      if (current.strategicAlign !== prev.strategicAlign) deltas.align = current.strategicAlign - prev.strategicAlign
      if (current.cacPerStore !== prev.cacPerStore) deltas.cac = current.cacPerStore - prev.cacPerStore
      if (current.totalCAC !== prev.totalCAC) deltas.invest = current.totalCAC - prev.totalCAC
      if (Object.keys(deltas).length > 0) {
        setKpiDeltas(deltas)
        const timer = setTimeout(() => setKpiDeltas({}), 2000)
        return () => clearTimeout(timer)
      }
    }
    prevKpiRef.current = current
  }, [totalPotential, successProb, strategicAlign, cacPerStore, totalCAC])

  const allTiers  = [...new Set(pool.map(s => s.tier))]
  const allRoutes = [...new Set(pool.map(s => s.route))]
  const tierBreakdown  = allTiers.map(t  => ({ t, count: pool.filter(s => s.tier  === t).length,  active: localTierFilter.includes(t) }))
  const routeBreakdown = allRoutes.map(r => ({ r, count: pool.filter(s => s.route === r).length, active: localRouteFilter.includes(r) }))

  const goldN   = inReach.filter(s => s.tier === 'gold').length
  const silverN = inReach.filter(s => s.tier === 'silver').length
  const bronzeN = inReach.filter(s => s.tier === 'bronze').length

  const deviationStr = routeDeviation >= 1000 ? `${routeDeviation / 1000}km` : `${routeDeviation}m`
  const kpis = [
    {
      label: 'Potential Volume',
      value: inReach.length > 0 ? `+${totalPotential}` : '—',
      unit: inReach.length > 0 ? 'UC/wk' : null,
      deltaKey: 'vol', inverted: false,
      tip: 'Total UC/week from accounts in reach at full conversion',
    },
    {
      label: 'Success Probability',
      value: inReach.length > 0 ? `${successProb}%` : '—',
      deltaKey: 'prob', inverted: false,
      tip: 'Estimated conversion rate based on tier mix and visit cycle',
    },
    {
      label: 'Strategic Alignment',
      value: inReach.length > 0 ? `${strategicAlign}%` : '—',
      deltaKey: 'align', inverted: false,
      tip: 'Path Efficiency × Value Score — balances logistics cost and commercial potential',
    },
    {
      label: 'Est. CAC / Store',
      value: `$${cacPerStore}`,
      deltaKey: 'cac', inverted: true,
      tip: 'Acquisition cost per account based on route deviation and visit cadence',
    },
    {
      label: 'Total Investment',
      value: inReach.length > 0 ? `$${totalCAC}` : '—',
      deltaKey: 'invest', inverted: true,
      tip: 'Total mission cost across all accounts in reach',
    },
    {
      label: 'Payback Period',
      value: paybackMo ? `${paybackMo} mo` : '—',
      tip: 'Months to recover total acquisition cost from gross margin',
    },
  ]

  return (
    <div style={{
      height: 'calc(100vh - 56px)',
      display: 'flex', flexDirection: 'column',
      overflow: 'hidden', background: 'var(--ne-surface-base)',
    }}>

      {/* ── Header KPI bar ── */}
      <div style={{
        flexShrink: 0, background: 'var(--ne-surface-dark)', borderBottom: '1px solid rgba(255,255,255,0.08)',
        padding: '0 24px', height: 64,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', overflow: 'hidden' }}>
          {kpis.map((kpi, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center' }}>
              <div style={{ padding: '0 18px', paddingLeft: i === 0 ? 0 : 18 }} title={kpi.tip}>
                <div style={{ fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 3, whiteSpace: 'nowrap' }}>
                  {kpi.label}
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                  <span style={{ fontSize: 22, fontWeight: 900, color: '#FFFFFF', letterSpacing: '-0.03em', lineHeight: 1 }}>
                    {kpi.value}
                  </span>
                  {kpi.unit && <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>{kpi.unit}</span>}
                  <KpiDelta delta={kpiDeltas[kpi.deltaKey]} inverted={kpi.inverted} />
                </div>
              </div>
              {i < kpis.length - 1 && (
                <div style={{ width: 1, height: 32, background: 'rgba(255,255,255,0.12)', flexShrink: 0 }} />
              )}
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0, marginLeft: 16 }}>
          <button onClick={onBack} style={{
            background: 'transparent', color: 'rgba(255,255,255,0.7)', border: '1px solid rgba(255,255,255,0.15)',
            borderRadius: 'var(--ka-radius)', padding: '6px 14px', fontSize: 12.5, cursor: 'pointer',
          }}>← Back</button>
          <button onClick={onNext} disabled={inReach.length === 0} style={{
            background: inReach.length > 0 ? 'var(--ne-yellow)' : 'rgba(255,255,255,0.08)',
            color: inReach.length > 0 ? 'var(--ne-text)' : 'rgba(255,255,255,0.3)',
            fontWeight: 700, padding: '6px 18px', borderRadius: 'var(--ka-radius-pill)',
            border: 'none', fontSize: 12.5, cursor: inReach.length > 0 ? 'pointer' : 'not-allowed',
            transition: 'all 0.15s',
          }}>Build Hunting Brief →</button>
        </div>
      </div>

      {/* ── Context strip ── */}
      <div style={{
        flexShrink: 0, background: 'var(--ne-surface-card)',
        padding: '6px 28px 8px', borderBottom: '1px solid var(--ne-border)',
      }}>
        <ContextStrip city={city} channel={channel} strategy={strategy} />
      </div>

      {/* ── Three-column body ── */}
      <div style={{ flex: 1, display: 'flex', minHeight: 0, overflow: 'hidden' }}>

        {/* ── LEFT: Controls (26%) ── */}
        <div style={{
          width: '26%', flexShrink: 0,
          borderRight: '1px solid var(--ne-border)',
          display: 'flex', flexDirection: 'column',
          overflowY: 'auto', background: 'var(--ne-surface-base)',
        }}>

          {/* Section 1 — Target Selection */}
          <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--ne-border)', background: 'var(--ne-surface-base)' }}>
            <div style={{ fontSize: 9.5, fontWeight: 700, color: 'var(--ne-text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>
              Target Selection
            </div>

            {/* Segment */}
            <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--ne-text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 5 }}>
              Segment
            </div>
            <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 12 }}>
              {tierBreakdown.map(({ t, count, active }) => (
                <button key={t} onClick={() => toggleTier(t)} style={{
                  display: 'flex', alignItems: 'center', gap: 5,
                  padding: '4px 8px 4px 7px', borderRadius: 20,
                  cursor: 'pointer', transition: 'all var(--ne-ease-color)',
                  background: active ? 'var(--ne-surface-card)' : 'transparent',
                  border: `1.5px solid ${active ? 'var(--ne-border-active)' : 'var(--ne-border)'}`,
                  boxShadow: active ? 'var(--ne-shadow-rest)' : 'none',
                }}>
                  <span style={{
                    width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
                    background: active ? 'var(--ne-border-active)' : 'var(--ne-border)',
                    transition: 'background var(--ne-ease-color)',
                  }} />
                  <span style={{ fontSize: 10.5, fontWeight: active ? 600 : 400, color: active ? 'var(--ne-text)' : 'var(--ne-text-muted)' }}>
                    {TIER_META[t].label}
                  </span>
                  <span style={{
                    fontSize: 9, fontWeight: 600, lineHeight: 1,
                    padding: '1px 5px', borderRadius: 10,
                    background: active ? 'var(--ne-surface-base)' : 'transparent',
                    color: active ? 'var(--ne-text-secondary)' : 'var(--ne-text-muted)',
                  }}>{count}</span>
                </button>
              ))}
            </div>

            {/* Potential */}
            <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--ne-text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 5 }}>
              Potential
            </div>
            <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 12 }}>
              {POTENTIAL_RANGES.map(r => {
                const count  = pool.filter(s => getPotentialRange(s.potential) === r.id).length
                const active = potentialFilter.includes(r.id)
                return (
                  <button key={r.id} onClick={() => togglePotential(r.id)} style={{
                    display: 'flex', alignItems: 'center', gap: 5,
                    padding: '4px 8px 4px 7px', borderRadius: 20,
                    cursor: 'pointer', transition: 'all var(--ne-ease-color)',
                    background: active ? 'var(--ne-surface-card)' : 'transparent',
                    border: `1.5px solid ${active ? 'var(--ne-border-active)' : 'var(--ne-border)'}`,
                    boxShadow: active ? 'var(--ne-shadow-rest)' : 'none',
                  }}>
                    <span style={{
                      width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
                      background: active ? 'var(--ne-border-active)' : 'var(--ne-border)',
                      transition: 'background var(--ne-ease-color)',
                    }} />
                    <span style={{ fontSize: 10.5, fontWeight: active ? 600 : 400, color: active ? 'var(--ne-text)' : 'var(--ne-text-muted)' }}>
                      {r.label}
                    </span>
                    <span style={{
                      fontSize: 9, fontWeight: 600, lineHeight: 1,
                      padding: '1px 5px', borderRadius: 10,
                      background: active ? 'var(--ne-surface-base)' : 'transparent',
                      color: active ? 'var(--ne-text-secondary)' : 'var(--ne-text-muted)',
                    }}>{count}</span>
                  </button>
                )
              })}
            </div>

            {/* Route */}
            <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--ne-text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 5 }}>
              Route
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {routeBreakdown.map(({ r, count, active }) => {
                const rep = ROUTE_META[r]?.supervisor
                return (
                  <button key={r} onClick={() => toggleRoute(r)} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '7px 10px',
                    paddingLeft: active ? 8 : 10,
                    borderRadius: 'var(--ka-radius)', cursor: 'pointer',
                    transition: 'all var(--ne-ease-color)',
                    background: active ? 'var(--ne-surface-card)' : 'transparent',
                    border: `1px solid ${active ? 'var(--ne-border)' : 'var(--ne-border)'}`,
                    borderLeft: active ? '3px solid var(--ne-border-active)' : '1px solid var(--ne-border)',
                    boxShadow: active ? 'var(--ne-shadow-rest)' : 'none',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                      <div style={{
                        width: 14, height: 14, borderRadius: '0.2rem',
                        background: active ? 'var(--ne-border-active)' : 'transparent',
                        border: `1.5px solid ${active ? 'var(--ne-border-active)' : 'var(--ne-border)'}`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                      }}>
                        {active && (
                          <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                            <polyline points="1,4 3,6 7,2" stroke="#FFFFFF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        )}
                      </div>
                      <div>
                        <div style={{ fontSize: 11, fontWeight: active ? 600 : 400, color: active ? 'var(--ne-text)' : 'var(--ne-text-secondary)' }}>{r}</div>
                        {rep && <div style={{ fontSize: 9.5, color: 'var(--ne-text-muted)', marginTop: 1 }}>{rep}</div>}
                      </div>
                    </div>
                    <span style={{ fontSize: 10, color: 'var(--ne-text-muted)' }}>{count}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Section 2 — Logistics Constraints */}
          <div style={{ padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 16, background: 'var(--ne-surface-base)' }}>
            <div style={{ fontSize: 9.5, fontWeight: 700, color: 'var(--ne-text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Logistics Constraints
            </div>

            {/* Route Deviation */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--ne-text)' }}>Route Deviation</span>
                <span style={{
                  fontSize: 10.5, fontWeight: 700, padding: '2px 8px', borderRadius: 6,
                  color: '#141417', background: 'var(--ne-surface-base)', border: '1px solid var(--ne-border)',
                }}>
                  {DEVIATION_OPTIONS.find(o => o.value === routeDeviation)?.label}
                </span>
              </div>
              <SegmentedControl options={DEVIATION_OPTIONS} value={routeDeviation} onChange={setRouteDeviation} />
              <div style={{ marginTop: 7, fontSize: 10.5, color: 'var(--ne-text-muted)', lineHeight: 1.5 }}>
                {routeDeviation <= 100 && 'Walk-across-the-street reach. No route change needed.'}
                {routeDeviation === 500 && 'Short detour. Minimal overhead.'}
                {routeDeviation === 1000 && 'Planned deviation. Supervisor briefing advised.'}
                {routeDeviation >= 2000 && 'Territory expansion. Partial route redesign likely.'}
              </div>
            </div>

            {/* Establishment Cycle */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--ne-text)' }}>Establishment Cycle</span>
                <span style={{
                  fontSize: 10.5, fontWeight: 700, padding: '2px 8px', borderRadius: 6,
                  color: '#141417', background: 'var(--ne-surface-base)', border: '1px solid var(--ne-border)',
                }}>
                  {persistence} wk{persistence > 1 ? 's' : ''}
                </span>
              </div>
              <SegmentedControl options={PERSISTENCE_OPTIONS} value={persistence} onChange={setPersistence} />
              <div style={{ marginTop: 7, fontSize: 10.5, color: 'var(--ne-text-muted)', lineHeight: 1.5 }}>
                {persistence === 1 && 'One drop per account. Not enough visits to reach Active Drop.'}
                {persistence === 2 && 'Covers first two visits. Phase 3 not included.'}
                {persistence === 3 && 'Full Rule of 3. Minimum to reach Active Drop.'}
                {persistence === 4 && 'Rule of 3 + buffer for slow converters.'}
              </div>
            </div>
          </div>

        </div>

        {/* ── CENTER: Map ── */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden' }}>
          <div style={{ flex: 1, position: 'relative', minHeight: 0, overflow: 'hidden' }}>
            <CalibrationMap strategy={strategy} filteredPool={filteredPool} inReach={inReach} routeDeviation={routeDeviation} />


            <div style={{
              position: 'absolute', top: 10, left: 12,
              background: 'rgba(28,31,46,0.85)', backdropFilter: 'blur(6px)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 'var(--ka-radius)', padding: '5px 10px',
              display: 'flex', flexDirection: 'column', gap: 4,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#E5FF01' }} />
                <span style={{ fontSize: 9.5, fontWeight: 600, color: 'rgba(255,255,255,0.7)' }}>In reach ({inReach.length})</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#E5FF01', opacity: 0.35 }} />
                <span style={{ fontSize: 9.5, fontWeight: 600, color: 'rgba(255,255,255,0.7)' }}>
                  Outside buffer ({filteredPool.length - inReach.length})
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#666666' }} />
                <span style={{ fontSize: 9.5, fontWeight: 600, color: 'rgba(255,255,255,0.7)' }}>Filtered out</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#FFFFFF' }} />
                <span style={{ fontSize: 9.5, fontWeight: 600, color: 'rgba(255,255,255,0.7)' }}>Active POS</span>
              </div>
            </div>
          </div>
        </div>

        {/* ── RIGHT: Analysis (30%) ── */}
        <div style={{
          width: '30%', flexShrink: 0,
          borderLeft: '1px solid var(--ne-border)',
          display: 'flex', flexDirection: 'column',
          overflow: 'hidden', background: 'var(--ne-surface-base)',
        }}>
          {/* Tab bar */}
          <div style={{
            flexShrink: 0, padding: '0 18px',
            background: 'var(--ne-surface-card)',
            borderBottom: '1px solid var(--ne-border)',
            display: 'flex', gap: 20,
          }}>
            {[
              { id: 'logic',    label: 'Selection Logic' },
              { id: 'forecast', label: 'Execution Forecast' },
            ].map(tab => (
              <button key={tab.id} onClick={() => setRightTab(tab.id)} style={{
                padding: '12px 0', fontSize: 12, fontWeight: 700, cursor: 'pointer',
                background: 'none', border: 'none',
                color: rightTab === tab.id ? 'var(--ne-text)' : 'var(--ne-text-muted)',
                borderBottom: `2px solid ${rightTab === tab.id ? 'var(--ne-text)' : 'transparent'}`,
                transition: 'all 0.15s', whiteSpace: 'nowrap',
              }}>
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 14, background: 'var(--ne-surface-card)' }}>

            {rightTab === 'logic' && (
              <>
                <div style={{ fontSize: 9.5, fontWeight: 700, color: 'var(--ne-text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  Why this selection
                </div>

                {inReach.length === 0 ? (
                  <div style={{ fontSize: 12, color: 'var(--ne-text-muted)', lineHeight: 1.6 }}>
                    No accounts in range. Increase route deviation or adjust filters.
                  </div>
                ) : (
                  <>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      {[
                        {
                          label: 'Total Reach',
                          value: `${inReach.length} accounts`,
                          sub: [goldN > 0 && `${goldN} Gold`, silverN > 0 && `${silverN} Silver`, bronzeN > 0 && `${bronzeN} Bronze`].filter(Boolean).join(' · '),
                        },
                        {
                          label: 'Data Match',
                          value: '98.4% Confidence',
                          valueColor: 'var(--ne-violet)',
                          sub: null,
                        },
                        {
                          label: 'Route Impact',
                          value: `${deviationStr} deviation`,
                          sub: `${Math.round(pathEff * 100)}% Path Efficiency`,
                        },
                        {
                          label: 'Local Growth',
                          value: '+48% vs Avg',
                          sub: 'Area outperforms territory average',
                        },
                      ].map((row, i, arr) => (
                        <div key={i} style={{
                          display: 'flex', alignItems: 'flex-start', gap: 10,
                          padding: '10px 0',
                          borderBottom: i < arr.length - 1 ? '1px solid var(--ne-border)' : 'none',
                        }}>
                          <div style={{
                            width: 6, height: 6, borderRadius: '50%', background: '#141417',
                            marginTop: 5, flexShrink: 0,
                          }} />
                          <div style={{ flex: 1 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
                              <span style={{ fontSize: 10.5, fontWeight: 600, color: 'var(--ne-text-secondary)' }}>{row.label}</span>
                              <span style={{ fontSize: 12, fontWeight: 800, color: row.valueColor || 'var(--ne-text)', whiteSpace: 'nowrap' }}>{row.value}</span>
                            </div>
                            {row.sub && <div style={{ fontSize: 10, color: 'var(--ne-text-muted)', marginTop: 2 }}>{row.sub}</div>}
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Success Estimate — system verdict (violet) */}
                    <div style={{
                      background: 'linear-gradient(135deg, var(--ne-violet), var(--ne-violet-deep))',
                      borderRadius: 'var(--ka-radius-lg)', padding: '16px 18px',
                      boxShadow: 'var(--ne-shadow-lifted)',
                    }}>
                      <div style={{ fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,0.6)',
                        textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>
                        Success Estimate
                      </div>
                      <div style={{ fontSize: 32, fontWeight: 900, color: '#FFFFFF', lineHeight: 1, letterSpacing: '-0.02em' }}>
                        {successProb}%
                      </div>
                      <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.55)', marginTop: 6, lineHeight: 1.4 }}>
                        Based on {persistence}-week cycle &amp; {city || 'territory'} benchmarks
                      </div>
                    </div>
                  </>
                )}

                {inReach.length > 0 && totalCAC > 0 && monthlyRevenue > 0 && totalCAC > monthlyRevenue && (
                  <div style={{
                    background: 'var(--ne-surface-base)', border: '1px solid var(--ne-border)',
                    borderLeft: '3px solid var(--ne-attention)', borderRadius: '0 0.5rem 0.5rem 0',
                    padding: '10px 12px',
                  }}>
                    <div style={{ fontSize: 9, fontWeight: 800, color: 'var(--ne-attention)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>
                      ⚠ Value Alert
                    </div>
                    <p style={{ fontSize: 11, color: 'var(--ne-text-secondary)', lineHeight: 1.6, margin: 0 }}>
                      Acquisition cost (${totalCAC}) exceeds projected monthly margin (${monthlyRevenue.toFixed(0)}). Reduce route deviation or shift to higher-tier targets.
                    </p>
                  </div>
                )}
              </>
            )}

            {rightTab === 'forecast' && (
              <>
                <div style={{ fontSize: 9.5, fontWeight: 700, color: 'var(--ne-text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  Acquisition Forecast
                </div>

                <div style={{ background: 'var(--ne-surface-base)', border: '1px solid var(--ne-border)', borderRadius: 'var(--ka-radius-lg)', padding: '14px' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ne-text)', marginBottom: 12 }}>
                    Projected Outcome
                  </div>
                  {[
                    { label: 'Accounts expected to convert', value: `${expectedStores} of ${inReach.length}` },
                    { label: 'Expected weekly volume', value: `+${Math.round(expectedStores * (totalPotential / Math.max(inReach.length, 1)))} UC/wk` },
                    { label: 'Time to maturity', value: `${persistence + 1} weeks` },
                    { label: 'Payback estimate', value: paybackMo ? `~${paybackMo} mo` : '—' },
                  ].map((row, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                      <span style={{ fontSize: 11, color: 'var(--ne-text-secondary)' }}>{row.label}</span>
                      <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--ne-text)' }}>{row.value}</span>
                    </div>
                  ))}
                </div>

                {/* Rule of 3 Tracker */}
                <div style={{ borderTop: '1px solid var(--ne-border)', paddingTop: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                    <span style={{ fontSize: 9.5, fontWeight: 700, color: 'var(--ne-text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                      Rule of 3 Tracker
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                      <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#141417' }} />
                      <span style={{ fontSize: 9, fontWeight: 600, color: 'var(--ne-text-muted)' }}>Active</span>
                    </div>
                  </div>

                  <div style={{ position: 'relative', display: 'flex', alignItems: 'flex-start' }}>
                    <div style={{
                      position: 'absolute', top: 17, left: '13%', right: '13%', height: 2,
                      background: 'var(--ne-border)', zIndex: 0,
                    }} />
                    {[1, 2, 3].map(n => {
                      const ph        = PHASE_META[n]
                      const committed = committedPhases.includes(n)
                      return (
                        <div key={n} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', zIndex: 1 }}>
                          <div style={{
                            width: 32, height: 32, borderRadius: '50%',
                            background: committed ? ph.bg : 'var(--ne-surface-base)',
                            border: `2.5px solid ${committed ? ph.color : 'var(--ne-border)'}`,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 12, fontWeight: 900, color: committed ? ph.color : 'var(--ne-text-muted)',
                            boxShadow: 'none',
                            opacity: committed ? 1 : 0.45,
                          }}>{n}</div>
                          <div style={{ marginTop: 7, textAlign: 'center', opacity: committed ? 1 : 0.4 }}>
                            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--ne-text)', marginBottom: 1 }}>{ph.label}</div>
                            <div style={{ fontSize: 9, color: 'var(--ne-text-muted)' }}>{ph.week}</div>
                            <div style={{ fontSize: 9, color: 'var(--ne-text-muted)', marginTop: 2, lineHeight: 1.4, maxWidth: 90 }}>{ph.desc}</div>
                          </div>
                        </div>
                      )
                    })}
                  </div>

                  <div style={{
                    marginTop: 12, padding: '7px 12px', borderRadius: 'var(--ka-radius)', fontSize: 10.5,
                    ...(persistence >= 3
                      ? { background: 'var(--ne-yellow)', color: 'var(--ne-text)', border: '1px solid var(--ne-border-active)' }
                      : { background: 'var(--ne-surface-base)', color: 'var(--ne-text-secondary)', border: '1px solid var(--ne-border)' }),
                  }}>
                    {persistence >= 3
                      ? '✓ Full Rule of 3 committed — all 3 phases covered'
                      : `⚠ ${persistence}-week cycle does not cover Phase 3`}
                  </div>
                </div>

                <div style={{ fontSize: 10.5, color: 'var(--ne-text-muted)', lineHeight: 1.6, fontStyle: 'italic' }}>
                  Based on benchmarks from comparable active accounts · Territory data refreshed weekly · Predictive models in manual review mode (Phase 1)
                </div>
              </>
            )}
          </div>
        </div>

      </div>
    </div>
  )
}
