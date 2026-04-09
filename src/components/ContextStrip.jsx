const CITY_LABELS     = { monterrey: 'Monterrey', cdmx: 'CDMX', guadalajara: 'Guadalajara', puebla: 'Puebla', tijuana: 'Tijuana' }
const CHANNEL_LABELS  = { traditional: 'Traditional', modern: 'Modern' }
const STRATEGY_LABELS = { density: 'Density Fill', clusters: 'High-Potential Clusters' }

function Tag({ label, value, color, bg }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
      <span style={{
        fontSize: 10, color: 'var(--ne-text-muted)',
        fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em',
        fontFamily: 'var(--ka-font-body)',
      }}>
        {label}
      </span>
      <span style={{
        fontSize: 12, fontWeight: 600,
        fontFamily: 'var(--ka-font-body)',
        color: color || 'var(--ne-text)',
        background: bg || 'var(--ne-surface-base)',
        border: `1px solid ${color ? color + '30' : 'var(--ne-border)'}`,
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
    strategy && { label: 'Strategy', value: STRATEGY_LABELS[strategy] },
  ].filter(Boolean)

  if (!tags.length) return null

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '6px 0' }}>
      <span style={{
        fontSize: 10, color: 'var(--ne-text-muted)',
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
