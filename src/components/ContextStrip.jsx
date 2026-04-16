const CITY_LABELS     = { monterrey: 'Monterrey', cdmx: 'CDMX', guadalajara: 'Guadalajara', puebla: 'Puebla', tijuana: 'Tijuana' }
const CHANNEL_LABELS  = { traditional: 'Traditional', modern: 'Modern' }
const STRATEGY_LABELS = { density: 'Density Fill', clusters: 'High-Potential Clusters' }
const EXEC_LABELS     = { 'Own Team': 'Own Team', 'External Team': 'External Team' }

function Tag({ label, value, isStrategy }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{
        fontSize: 11, fontWeight: 700, color: '#6366F1',
        textTransform: 'uppercase', letterSpacing: '0.08em',
        lineHeight: 1,
      }}>
        {label}:
      </span>
      <span style={{
        fontSize: 12, fontWeight: 600,
        color: 'var(--ne-text)',
        background: isStrategy ? 'var(--ne-yellow)' : '#fff',
        padding: '4px 12px',
        borderRadius: 9999,
        boxShadow: isStrategy ? '0 2px 8px rgba(229,255,1,0.25)' : '0 1px 3px rgba(0,0,0,0.06)',
      }}>
        {value}
      </span>
    </div>
  )
}

export default function ContextStrip({ city, channel, strategy, executionMode }) {
  const tags = [
    city          && { label: 'City',      value: CITY_LABELS[city],                                isStrategy: false },
    channel       && { label: 'Channel',   value: CHANNEL_LABELS[channel],                          isStrategy: false },
    strategy      && { label: 'Strategy',  value: STRATEGY_LABELS[strategy],                        isStrategy: true  },
    executionMode && { label: 'Execution', value: EXEC_LABELS[executionMode] || executionMode,       isStrategy: false },
  ].filter(Boolean)

  if (!tags.length) return null

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 20, padding: '6px 0', flexWrap: 'wrap' }}>
      {tags.map(t => <Tag key={t.label} {...t} />)}
    </div>
  )
}
