import { useRef, useState, useEffect } from 'react'
import mapboxgl from 'mapbox-gl'
import ContextStrip from './ContextStrip.jsx'

// ── Exported data (referenced by Steps 3 & 4) ─────────────────────────────────

export const TIER_META = {
  gold:   { label: 'Gold',   color: '#141417', bg: '#F2F2F2', border: '#d4d5d6', minPotential: 90 },
  silver: { label: 'Silver', color: '#141417', bg: '#F2F2F2', border: '#d4d5d6', minPotential: 30 },
  bronze: { label: 'Bronze', color: '#141417', bg: '#F2F2F2', border: '#d4d5d6', minPotential: 0  },
}

export const ROUTE_META = {
  'Route 4': { supervisor: 'Miguel Ángel Torres' },
  'Route 2': { supervisor: 'Carlos Ramírez' },
  'Route 1': { supervisor: 'Ana Martínez' },
}

export const DENSITY_WS = [
  { id: 'd1',  x: 118, y: 82,  name: 'Abarrotes Cruz',      potential: 31,  tier: 'silver', route: 'Route 4', distance: 85  },
  { id: 'd2',  x: 178, y: 128, name: 'Mini Mart Sol',        potential: 28,  tier: 'bronze', route: 'Route 4', distance: 120 },
  { id: 'd3',  x: 238, y: 80,  name: 'Tienda Rivera',        potential: 35,  tier: 'silver', route: 'Route 4', distance: 95  },
  { id: 'd4',  x: 345, y: 128, name: 'Miscelánea Norte',     potential: 29,  tier: 'bronze', route: 'Route 4', distance: 140 },
  { id: 'd5',  x: 428, y: 82,  name: 'Abarrotes Plaza',      potential: 33,  tier: 'silver', route: 'Route 4', distance: 75  },
  { id: 'd6',  x: 470, y: 128, name: 'Mini Stop',            potential: 27,  tier: 'bronze', route: 'Route 4', distance: 160 },
  { id: 'd7',  x: 116, y: 315, name: 'Tienda del Barrio',    potential: 30,  tier: 'silver', route: 'Route 2', distance: 110 },
  { id: 'd8',  x: 162, y: 268, name: 'Super Rápido',         potential: 26,  tier: 'bronze', route: 'Route 2', distance: 130 },
  { id: 'd9',  x: 268, y: 198, name: 'Abarrotes Luz',        potential: 32,  tier: 'silver', route: 'Route 2', distance: 90  },
  { id: 'd10', x: 522, y: 212, name: 'Kiosko Central',       potential: 24,  tier: 'bronze', route: 'Route 1', distance: 180 },
  { id: 'd11', x: 158, y: 90,  name: 'Súper González',       potential: 97,  tier: 'gold',   route: 'Route 4', distance: 80  },
  { id: 'd12', x: 308, y: 90,  name: 'Abarrotes Premium',    potential: 104, tier: 'gold',   route: 'Route 4', distance: 65  },
  { id: 'd13', x: 222, y: 292, name: 'Mega Barrio',          potential: 93,  tier: 'gold',   route: 'Route 2', distance: 120 },
]

export const CLUSTER_WS = [
  { id: 'c1', x: 415, y: 258, name: 'MegaMart Oriente',    potential: 112, tier: 'gold',   route: 'Route 4', distance: 650  },
  { id: 'c2', x: 458, y: 290, name: 'Supercito Las Vegas', potential: 98,  tier: 'gold',   route: 'Route 4', distance: 720  },
  { id: 'c3', x: 395, y: 318, name: 'Tienda Mercado',      potential: 87,  tier: 'silver', route: 'Route 2', distance: 580  },
  { id: 'c4', x: 475, y: 335, name: 'Abarrotes Fuerte',    potential: 103, tier: 'gold',   route: 'Route 4', distance: 850  },
  { id: 'c5', x: 438, y: 358, name: 'Mini Central',        potential: 79,  tier: 'silver', route: 'Route 2', distance: 920  },
  { id: 'c6', x: 505, y: 305, name: 'Expendio Popular',    potential: 94,  tier: 'gold',   route: 'Route 4', distance: 780  },
  { id: 'c7', x: 368, y: 350, name: 'Abarrotes Colonia',   potential: 76,  tier: 'silver', route: 'Route 2', distance: 1100 },
  { id: 'c8', x: 508, y: 365, name: 'Super Vecino',        potential: 88,  tier: 'silver', route: 'Route 2', distance: 1400 },
]

export const OTHER_WS = [
  { id: 'n1', x: 308, y: 270 }, { id: 'n2', x: 268, y: 335 },
  { id: 'n3', x: 200, y: 388 }, { id: 'n4', x: 140, y: 165 },
  { id: 'n5', x: 220, y: 158 }, { id: 'n6', x: 338, y: 388 },
]

export const OWNED_POS = [
  { id: 'o1',  x: 100, y: 105 }, { id: 'o2',  x: 200, y: 105 },
  { id: 'o3',  x: 295, y: 105 }, { id: 'o4',  x: 390, y: 105 },
  { id: 'o5',  x: 490, y: 105 }, { id: 'o6',  x: 88,  y: 358 },
  { id: 'o7',  x: 146, y: 298 }, { id: 'o8',  x: 204, y: 248 },
  { id: 'o9',  x: 540, y: 150 }, { id: 'o10', x: 540, y: 245 },
  { id: 'o11', x: 540, y: 345 },
]

export const ROUTES = [
  { id: 'r1', points: '55,105 155,105 255,105 350,105 445,105 545,105' },
  { id: 'r2', points: '60,385 118,325 175,270 232,225 290,185' },
  { id: 'r3', points: '545,105 545,175 545,250 545,325 545,390' },
]

// ── Geo coordinate helpers ─────────────────────────────────────────────────────
// SVG viewport: 600 × 410 → Monterrey metro area
export function svgToLngLat(x, y) {
  return [-100.360 + (x / 600) * 0.070, 25.720 - (y / 410) * 0.065]
}

function routeToGeoFeature(r) {
  return {
    type: 'Feature',
    properties: { id: r.id },
    geometry: {
      type: 'LineString',
      coordinates: r.points.split(' ').map(pt => {
        const [x, y] = pt.split(',').map(Number)
        return svgToLngLat(x, y)
      }),
    },
  }
}

const GEO_ROUTES = {
  type: 'FeatureCollection',
  features: ROUTES.map(routeToGeoFeature),
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

const GEO_DENSITY_WS = {
  type: 'FeatureCollection',
  features: DENSITY_WS.map(d => ({
    type: 'Feature',
    properties: { id: d.id, name: d.name, potential: d.potential, distance: d.distance, tier: d.tier },
    geometry: { type: 'Point', coordinates: svgToLngLat(d.x, d.y) },
  })),
}

const GEO_CLUSTER_WS = {
  type: 'FeatureCollection',
  features: CLUSTER_WS.map(c => ({
    type: 'Feature',
    properties: { id: c.id, name: c.name, potential: c.potential, distance: c.distance, tier: c.tier },
    geometry: { type: 'Point', coordinates: svgToLngLat(c.x, c.y) },
  })),
}

// ── Strategy config ────────────────────────────────────────────────────────────
const STRATEGIES = {
  density: {
    label: 'Density Fill',
    tagline: 'ROUTE-ADJACENT · LOW COST TO SERVE',
    description: 'Accounts within 200–500m of existing routes. Rep covers these without changing the truck stop schedule. Lower average volume per account, lower cost to serve.',
    stores: '287', ucmo: '+2,300 UC/mo',
    color: '#141417', bg: '#F2F2F2', border: '#d4d5d6',
  },
  clusters: {
    label: 'High-Potential Clusters',
    tagline: '>35 UC/WK · REQUIRES ROUTE DEVIATION',
    description: 'Accounts with >35 UC/wk that sit outside route proximity. Requires a planned detour or partial route restructure. Higher volume per account, higher cost to serve.',
    stores: '60', ucmo: '+1,900 UC/mo',
    color: '#141417', bg: '#F2F2F2', border: '#d4d5d6',
  },
}

// ── Mapbox map ─────────────────────────────────────────────────────────────────

function applyStrategyLayers(map, strategy, compMode) {
  if (compMode) {
    map.setPaintProperty('density-ws-halo', 'circle-opacity', 0.07)
    map.setPaintProperty('density-ws-dot', 'circle-radius', 5)
    map.setPaintProperty('density-ws-dot', 'circle-opacity', 0.9)
    map.setPaintProperty('cluster-ws-dot', 'circle-radius', 6)
    map.setPaintProperty('cluster-ws-dot', 'circle-opacity', 0.9)
    map.setPaintProperty('route-line', 'line-opacity', 0.45)
    map.setPaintProperty('route-glow', 'line-opacity', 0.05)
  } else if (strategy === 'density') {
    map.setPaintProperty('density-ws-halo', 'circle-opacity', 0.07)
    map.setPaintProperty('density-ws-dot', 'circle-radius', 6)
    map.setPaintProperty('density-ws-dot', 'circle-opacity', 1)
    map.setPaintProperty('cluster-ws-dot', 'circle-radius', 3.5)
    map.setPaintProperty('cluster-ws-dot', 'circle-opacity', 0.2)
    map.setPaintProperty('route-line', 'line-opacity', 0.75)
    map.setPaintProperty('route-glow', 'line-opacity', 0.08)
  } else if (strategy === 'clusters') {
    map.setPaintProperty('density-ws-halo', 'circle-opacity', 0)
    map.setPaintProperty('density-ws-dot', 'circle-radius', 3.5)
    map.setPaintProperty('density-ws-dot', 'circle-opacity', 0.2)
    map.setPaintProperty('cluster-ws-dot', 'circle-radius', 7)
    map.setPaintProperty('cluster-ws-dot', 'circle-opacity', 1)
    map.setPaintProperty('route-line', 'line-opacity', 0.15)
    map.setPaintProperty('route-glow', 'line-opacity', 0)
  } else {
    map.setPaintProperty('density-ws-halo', 'circle-opacity', 0)
    map.setPaintProperty('density-ws-dot', 'circle-radius', 4)
    map.setPaintProperty('density-ws-dot', 'circle-opacity', 0.4)
    map.setPaintProperty('cluster-ws-dot', 'circle-radius', 4)
    map.setPaintProperty('cluster-ws-dot', 'circle-opacity', 0.4)
    map.setPaintProperty('route-line', 'line-opacity', 0.3)
    map.setPaintProperty('route-glow', 'line-opacity', 0)
  }
}

function MapboxDiscoveryMap({ strategy, compMode }) {
  const containerRef = useRef(null)
  const mapRef       = useRef(null)
  const readyRef     = useRef(false)
  const stratRef     = useRef(strategy)
  const compRef      = useRef(compMode)

  useEffect(() => {
    if (!containerRef.current) return
    mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN || ''

    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: 'mapbox://styles/mapbox/light-v11',
      center: [-100.325, 25.688],
      zoom: 12.5,
      interactive: true,
      attributionControl: false,
      logoPosition: 'bottom-right',
    })
    mapRef.current = map

    map.on('load', () => {
      // Routes
      map.addSource('routes', { type: 'geojson', data: GEO_ROUTES })
      map.addLayer({
        id: 'route-glow', type: 'line', source: 'routes',
        paint: { 'line-color': '#141417', 'line-width': 18, 'line-opacity': 0, 'line-blur': 6 },
      })
      map.addLayer({
        id: 'route-line', type: 'line', source: 'routes',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': '#141417', 'line-width': 2.5, 'line-opacity': 0.3 },
      })

      // Other white space (ambient)
      map.addSource('other-ws', { type: 'geojson', data: GEO_OTHER_WS })
      map.addLayer({
        id: 'other-ws-dot', type: 'circle', source: 'other-ws',
        paint: {
          'circle-radius': 3, 'circle-color': '#B8B3A8', 'circle-opacity': 0.4,
          'circle-stroke-width': 0.8, 'circle-stroke-color': '#FFFFFF',
        },
      })

      // Density WS
      map.addSource('density-ws', { type: 'geojson', data: GEO_DENSITY_WS })
      map.addLayer({
        id: 'density-ws-halo', type: 'circle', source: 'density-ws',
        paint: { 'circle-radius': 18, 'circle-color': '#141417', 'circle-opacity': 0 },
      })
      map.addLayer({
        id: 'density-ws-dot', type: 'circle', source: 'density-ws',
        paint: {
          'circle-radius': 4, 'circle-color': '#141417', 'circle-opacity': 0.4,
          'circle-stroke-width': 1.5, 'circle-stroke-color': '#FFFFFF',
        },
      })

      // Cluster WS
      map.addSource('cluster-ws', { type: 'geojson', data: GEO_CLUSTER_WS })
      map.addLayer({
        id: 'cluster-ws-dot', type: 'circle', source: 'cluster-ws',
        paint: {
          'circle-radius': 4, 'circle-color': '#141417', 'circle-opacity': 0.4,
          'circle-stroke-width': 1.5, 'circle-stroke-color': '#FFFFFF',
        },
      })

      // Owned POS (always on top)
      map.addSource('owned-pos', { type: 'geojson', data: GEO_OWNED_POS })
      map.addLayer({
        id: 'owned-pos-dot', type: 'circle', source: 'owned-pos',
        paint: {
          'circle-radius': 6, 'circle-color': '#141417',
          'circle-stroke-width': 1.5, 'circle-stroke-color': '#FFFFFF',
        },
      })

      // Popups
      const popup = new mapboxgl.Popup({ closeButton: false, closeOnClick: false, offset: 10 })

      function showPopup(e) {
        map.getCanvas().style.cursor = 'pointer'
        const { name, potential, distance } = e.features[0].properties
        popup.setLngLat(e.lngLat)
          .setHTML(
            `<div style="font:700 10.5px/1.4 Inter,sans-serif;color:#141417">${name}</div>` +
            `<div style="font:normal 10px/1.4 Inter,sans-serif;color:#444">+${potential} UC/wk · ${distance}m from route</div>`
          )
          .addTo(map)
      }
      function hidePopup() {
        map.getCanvas().style.cursor = ''
        popup.remove()
      }

      map.on('mouseenter', 'density-ws-dot', showPopup)
      map.on('mouseleave', 'density-ws-dot', hidePopup)
      map.on('mouseenter', 'cluster-ws-dot', showPopup)
      map.on('mouseleave', 'cluster-ws-dot', hidePopup)

      readyRef.current = true
      applyStrategyLayers(map, stratRef.current, compRef.current)
    })

    return () => {
      readyRef.current = false
      map.remove()
    }
  }, [])

  useEffect(() => {
    stratRef.current = strategy
    compRef.current  = compMode
    if (!readyRef.current) return
    applyStrategyLayers(mapRef.current, strategy, compMode)
  }, [strategy, compMode])

  return <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
}

// ── Strategy card ──────────────────────────────────────────────────────────────

function StrategyCard({ id, data, selected, onSelect }) {
  const [hovered, setHovered] = useState(false)
  const active = selected || hovered

  return (
    <div
      onClick={() => onSelect(id)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: active ? data.bg : '#FFFFFF',
        border: `2px solid ${active ? data.color : 'var(--ka-color-border)'}`,
        borderRadius: '0.875rem', padding: '14px 16px',
        cursor: 'pointer', transition: 'all 0.2s ease',
        position: 'relative', overflow: 'hidden',
        flexShrink: 0,
      }}
    >
      {selected && (
        <div style={{
          position: 'absolute', top: 10, right: 10,
          width: 20, height: 20, borderRadius: '50%',
          background: '#141417',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <polyline points="2,5 4,7 8,3" stroke="#FFFFFF" strokeWidth="1.6"
              strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      )}

      <div style={{ marginBottom: 6 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: '#141417',
          letterSpacing: '-0.01em', lineHeight: 1.2 }}>
          {data.label}
        </div>
        <div style={{ fontSize: 10, fontWeight: 600, color: '#999ea6', letterSpacing: '0.06em',
          textTransform: 'uppercase', marginTop: 2 }}>
          {data.tagline}
        </div>
      </div>

      <p style={{ fontSize: 11.5, color: 'var(--ka-color-text-secondary)', lineHeight: 1.55, margin: '0 0 12px' }}>
        {data.description}
      </p>

      <div style={{
        display: 'flex', gap: 0,
        paddingTop: 10,
        borderTop: '1px solid var(--ka-color-border)',
      }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 8.5, fontWeight: 600, color: 'var(--ka-color-text-tertiary)',
            textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 3 }}>
            Accounts
          </div>
          <div style={{ fontSize: 22, fontWeight: 900, color: 'var(--ka-color-text)',
            letterSpacing: '-0.03em', lineHeight: 1 }}>
            {data.stores}
          </div>
        </div>
        <div style={{ width: 1, background: 'var(--ka-color-border)', margin: '0 14px' }} />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 8.5, fontWeight: 600, color: 'var(--ka-color-text-tertiary)',
            textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 3 }}>
            Net Volume
          </div>
          <div style={{ fontSize: 18, fontWeight: 900, color: 'var(--ka-color-text)',
            letterSpacing: '-0.02em', lineHeight: 1, whiteSpace: 'nowrap' }}>
            {data.ucmo}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── AI Recommendation box ──────────────────────────────────────────────────────

function AIRecommendation({ strategy }) {
  return (
    <div style={{
      background: 'var(--ka-color-bg-layout)',
      border: '1px solid var(--ka-color-border)',
      borderRadius: '0.75rem', padding: '12px 14px',
      flexShrink: 0,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 8 }}>
        <div style={{
          width: 22, height: 22, borderRadius: '0.4rem', flexShrink: 0,
          background: '#141417',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <circle cx="6" cy="6" r="4.5" stroke="#FFFFFF" strokeWidth="1.2" />
            <line x1="6" y1="3.5" x2="6" y2="6.5" stroke="#FFFFFF" strokeWidth="1.3" strokeLinecap="round" />
            <circle cx="6" cy="8.2" r="0.8" fill="#FFFFFF" />
          </svg>
        </div>
        <span style={{
          fontSize: 9.5, fontWeight: 700, letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: 'var(--ka-color-text)',
        }}>
          AI Recommendation
        </span>
      </div>
      {strategy ? (
        <p style={{ fontSize: 11.5, color: 'var(--ka-color-text)', lineHeight: 1.6, margin: 0 }}>
          {strategy === 'clusters'
            ? 'High-Potential Clusters give you the highest-ceiling accounts in the city. Route redesign required — the volume justifies the move.'
            : 'Density Fill is your fastest path to new volume — accounts are steps from your existing routes. No new trucks, no route changes needed.'}
        </p>
      ) : (
        <p style={{ fontSize: 11, color: 'var(--ka-color-text-tertiary)', lineHeight: 1.55, margin: 0 }}>
          Select a strategy to see where your territory opportunity is.
        </p>
      )}
    </div>
  )
}

// ── Floating legend ────────────────────────────────────────────────────────────

function MapLegend({ strategy }) {
  const items = [
    { color: '#141417', label: 'Owned POS', r: 5 },
    { color: strategy ? '#141417' : '#999ea6',
      label: strategy === 'density' ? 'Density targets'
           : strategy === 'clusters' ? 'High-value clusters'
           : 'White spaces', r: 4 },
    { color: '#999ea6', label: 'Other white space', r: 3 },
  ]
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 14,
      background: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(4px)',
      border: '1px solid rgba(0,0,0,0.08)', borderRadius: '0.5rem',
      padding: '6px 12px',
    }}>
      {items.map((item, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <div style={{
            width: item.r * 2, height: item.r * 2, borderRadius: '50%',
            background: item.color, flexShrink: 0,
          }} />
          <span style={{ fontSize: 10, color: 'var(--ka-color-text-secondary)', fontWeight: 500, whiteSpace: 'nowrap' }}>
            {item.label}
          </span>
        </div>
      ))}
    </div>
  )
}

// ── Step 2 ─────────────────────────────────────────────────────────────────────

export default function Step2Discovery({
  city, channel, strategy, setStrategy,
  setTierFilter, setRouteFilter,
  onBack, onNext,
}) {
  const [compMode, setCompMode] = useState(false)

  function handleSelect(id) {
    const pool = id === 'density' ? DENSITY_WS : CLUSTER_WS
    setTierFilter([...new Set(pool.map(p => p.tier))])
    setRouteFilter([...new Set(pool.map(p => p.route))])
    setStrategy(id)
  }

  return (
    <div style={{
      height: 'calc(100vh - 56px)',
      display: 'flex', flexDirection: 'column',
      overflow: 'hidden', background: 'var(--ka-color-bg-layout)',
    }}>

      {/* ── Compact header ── */}
      <div style={{
        flexShrink: 0,
        background: 'var(--ka-color-bg)', borderBottom: '1px solid var(--ka-color-border)',
        padding: '10px 28px 0',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--ka-color-text-tertiary)',
              letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 2 }}>
              Step 2 — Discovery
            </div>
            <h1 style={{ fontSize: 19, fontWeight: 800, color: 'var(--ka-color-text)',
              letterSpacing: '-0.02em', margin: 0 }}>
              Choose your conquest strategy
            </h1>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
            <button onClick={onBack} style={{
              background: 'transparent', color: 'var(--ka-color-text-secondary)',
              border: '1px solid var(--ka-color-border)', borderRadius: 'var(--ka-radius)',
              padding: '6px 13px', fontSize: 12.5, cursor: 'pointer',
            }}>
              ← Back
            </button>
            <button onClick={onNext} disabled={!strategy} style={{
              background: strategy ? 'var(--ka-color-primary)' : 'var(--ka-color-bg-layout)',
              color: strategy ? 'var(--ka-color-primary-text)' : 'var(--ka-color-text-disabled)',
              fontWeight: 700, padding: '6px 16px',
              borderRadius: 'var(--ka-radius-pill)', border: 'none',
              fontSize: 12.5, cursor: strategy ? 'pointer' : 'not-allowed',
              transition: 'all 0.15s',
            }}>
              Calibrate →
            </button>
          </div>
        </div>
        <div style={{ paddingBottom: 8 }}>
          <ContextStrip city={city} channel={channel} strategy={strategy} />
        </div>
      </div>

      {/* ── Main content ── */}
      <div style={{ flex: 1, display: 'flex', minHeight: 0, overflow: 'hidden' }}>

        {/* ── Left sidebar (30%) ── */}
        <div style={{
          width: '30%', flexShrink: 0,
          padding: '14px 18px',
          borderRight: '1px solid var(--ka-color-border)',
          display: 'flex', flexDirection: 'column', gap: 10,
          overflowY: 'auto',
        }}>
          {Object.entries(STRATEGIES).map(([id, data]) => (
            <StrategyCard
              key={id} id={id} data={data}
              selected={strategy === id}
              onSelect={handleSelect}
            />
          ))}

          <AIRecommendation strategy={strategy} />
        </div>

        {/* ── Right map (70%) ── */}
        <div style={{
          flex: 1, padding: '14px 18px 14px 14px',
          display: 'flex', flexDirection: 'column', minWidth: 0,
        }}>
          <div style={{
            flex: 1, position: 'relative', minHeight: 0,
            borderRadius: '0.875rem',
            overflow: 'hidden',
            border: '1px solid #D9D5CB',
            boxShadow: '0 2px 16px rgba(0,0,0,0.06)',
          }}>
            <MapboxDiscoveryMap strategy={strategy} compMode={compMode} />

            {/* Entity Resolution badge — top right */}
            <div style={{
              position: 'absolute', top: 10, right: 10,
              display: 'flex', alignItems: 'center', gap: 5,
              background: 'rgba(255,255,255,0.94)',
              border: '1px solid var(--ka-color-border)',
              borderRadius: '0.4rem', padding: '5px 10px',
              boxShadow: '0 1px 4px rgba(0,0,0,0.07)',
              zIndex: 10,
            }}>
              <div style={{
                width: 6, height: 6, borderRadius: '50%',
                background: 'var(--ka-color-text)', flexShrink: 0,
              }} />
              <span style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--ka-color-text)' }}>
                98.4% Match Confidence
              </span>
            </div>

            {/* Compare toggle — top left */}
            <div style={{ position: 'absolute', top: 10, left: 10, zIndex: 10 }}>
              <button
                onClick={() => setCompMode(c => !c)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 5,
                  background: compMode ? '#141417' : 'rgba(255,255,255,0.94)',
                  border: `1px solid ${compMode ? '#141417' : 'var(--ka-color-border)'}`,
                  borderRadius: '0.4rem', padding: '5px 10px',
                  cursor: 'pointer', fontSize: 10.5, fontWeight: 600,
                  color: compMode ? '#FFFFFF' : 'var(--ka-color-text)',
                  boxShadow: '0 1px 4px rgba(0,0,0,0.07)',
                  transition: 'all 0.15s',
                }}
              >
                <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
                  <rect x="0.5" y="0.5" width="4.5" height="10" rx="1" fill={compMode ? '#FFFFFF' : '#999ea6'} />
                  <rect x="6" y="0.5" width="4.5" height="10" rx="1" fill={compMode ? '#FFFFFF' : '#999ea6'} />
                </svg>
                {compMode ? 'Single View' : 'Compare Strategies'}
              </button>
            </div>

            {/* Floating legend — bottom left */}
            <div style={{ position: 'absolute', bottom: 10, left: 10, zIndex: 10 }}>
              <MapLegend strategy={strategy} />
            </div>

            {/* No strategy hint — center */}
            {!strategy && !compMode && (
              <div style={{
                position: 'absolute', inset: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                pointerEvents: 'none', zIndex: 10,
              }}>
                <div style={{
                  background: 'rgba(255,255,255,0.88)',
                  border: '1px solid var(--ka-color-border)',
                  borderRadius: '0.75rem', padding: '14px 22px',
                  textAlign: 'center',
                }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ka-color-text)', marginBottom: 4 }}>
                    Pick a strategy to reveal your territory
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--ka-color-text-tertiary)' }}>
                    Select Density Fill or High-Potential Clusters
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  )
}
