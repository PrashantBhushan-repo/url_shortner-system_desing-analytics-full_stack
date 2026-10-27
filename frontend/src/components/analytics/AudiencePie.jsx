import { useState } from 'react';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { pieBreakdown } from '../../services/chartData.js';

const fmt = v => Number(v).toLocaleString();
const pct = (v, t) => t ? (v / t * 100).toFixed(1) + '%' : '—';

export default function AudiencePie({ title, values, nameKey }) {
  const { slices, total } = pieBreakdown(values, nameKey);
  const [hovered, setHovered] = useState(null);
  const focused = slices.find(s => s.name === hovered);

  if (!total) return (
    <div className="an-donut-empty">
      <span />
      <p>No data in this period.</p>
    </div>
  );

  return (
    <figure className="an-donut-figure" aria-label={`${title}: ${fmt(total)} total clicks`}>
      <div className="an-donut-wrap">
        <ResponsiveContainer width="100%" height={190} minWidth={0}>
          <PieChart>
            <Pie
              data={slices} dataKey="value" nameKey="name"
              innerRadius={58} outerRadius={80}
              paddingAngle={slices.length > 1 ? 3 : 0}
              cornerRadius={4} startAngle={90} endAngle={-270}
              stroke="var(--ws-panel)" strokeWidth={2}
              isAnimationActive={false}
              onMouseEnter={item => setHovered(item.name)}
              onMouseLeave={() => setHovered(null)}
            >
              {slices.map(s => (
                <Cell key={s.name} fill={s.color} opacity={!hovered || hovered === s.name ? 1 : 0.22} />
              ))}
            </Pie>
            <Tooltip content={({ active, payload }) =>
              active && payload?.length ? (
                <div className="an-tooltip">
                  <strong>{payload[0].name}</strong>
                  <span>{fmt(payload[0].value)} · {pct(payload[0].value, total)}</span>
                </div>
              ) : null
            } />
          </PieChart>
        </ResponsiveContainer>
        <div className="an-donut-center" aria-hidden="true">
          <strong>{fmt(focused?.value ?? total)}</strong>
          <span>{focused?.name ?? 'total clicks'}</span>
        </div>
      </div>
      <ul className="an-legend" aria-label={`${title} breakdown`}>
        {slices.map(s => (
          <li
            key={s.name}
            className={'an-legend-row' + (hovered === s.name ? ' is-hovered' : '')}
            onMouseEnter={() => setHovered(s.name)}
            onMouseLeave={() => setHovered(null)}
          >
            <span className="an-legend-dot" style={{ background: s.color }} />
            <span className="an-legend-name" title={s.name}>{s.name}</span>
            <span className="an-legend-val">{fmt(s.value)}</span>
            <span className="an-legend-pct">{pct(s.value, total)}</span>
          </li>
        ))}
      </ul>
    </figure>
  );
}
