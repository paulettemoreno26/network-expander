const CITY_LABELS     = { monterrey: 'Monterrey', cdmx: 'CDMX', guadalajara: 'Guadalajara', puebla: 'Puebla', tijuana: 'Tijuana' }
const CHANNEL_LABELS  = { traditional: 'Traditional', modern: 'Modern' }
const STRATEGY_LABELS = { density: 'Density Fill', clusters: 'High-Potential Clusters' }
const STRATEGY_COLORS = { density: '#141417', clusters: '#141417' }
const STRATEGY_BGS    = { density: '#F2F2F2', clusters: '#F2F2F2' }

function Tag({ label, value, color, bg }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
      <span style={{
        fontSize: 10, color: 'var(--ka-color-text-tertiary)',
        fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em',
        fontFamily: 'var(--ka-font-body)',
      }}>
        {label}
      </span>
      <span style={{
        fontSize: 12, fontWeight: 600,
        fontFamily: 'var(--ka-font-body)',
        color: color || 'var(--ka-color-text)',
        background: bg || 'var(--ka-color-bg-layout)',
        border: `1px solid ${color ? color + '30' : 'var(--ka-color-border)'}`,
        borderRadius: 'var(--ka-radius-sm)', padding: '2px 8px',
      }}>
        {value}
      </span>
    </div>
  )
}

export default function ContextStrip({ city, channel, strategy }) {
  const tags = [
    city     && { label: 'City',     value: CITY_LABELS[city] },
    channel  && { label: 'Channel',  value: CHANNEL_LABELS[channel] },
    strategy && { label: 'Strategy', value: STRATEGY_LABELS[strategy], color: STRATEGY_COLORS[strategy], bg: STRATEGY_BGS[strategy] },
  ].filter(Boolean)

  if (!tags.length) return null

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '6px 0' }}>
      <span style={{
        fontSize: 10, color: 'var(--ka-color-border)',
        fontWeight: 600, textTransform: 'uppercase',
        letterSpacing: '0.08em', flexShrink: 0,
        fontFamily: 'var(--ka-font-body)',
      }}>
        Context
      </span>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        {tags.map(t => <Tag key={t.label} {...t} />)}
      </div>
    </div>
  )
}
