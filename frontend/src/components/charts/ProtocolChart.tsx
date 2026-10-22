import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { ProtocolMetric } from '../../types/api';
import { GlassCard } from '../common/GlassCard';
import { EmptyState } from '../common/EmptyState';
import { Radio } from 'lucide-react';

interface ProtocolChartProps {
  protocols?: ProtocolMetric[];
}

export const ProtocolChart: React.FC<ProtocolChartProps> = ({ protocols = [] }) => {
  const hasData = protocols.length > 0;

  const COLORS = ['#ff5e00', '#00e5ff', '#00e676', '#ffab00', '#9aa5b8'];

  return (
    <GlassCard
      title="Layer 3 Protocol Breakdown"
      subtitle="Observed attack distribution across transport protocols"
      action={
        hasData && (
          <span style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
            {protocols.length} Protocols
          </span>
        )
      }
    >
      {!hasData ? (
        <EmptyState
          icon={<Radio size={32} color="var(--accent-green)" />}
          title="No Protocol Distribution Data"
          description="Transport protocol distributions (TCP, UDP, ICMP, GRE) will display here once upstream metrics are synchronized."
          hint="Radar Endpoint: /radar/attacks/layer3/summary/protocol"
        />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', alignItems: 'center' }}>
          <div style={{ height: '180px', width: '100%' }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={protocols}
                  dataKey="percentage"
                  nameKey="protocol"
                  cx="50%"
                  cy="50%"
                  innerRadius={45}
                  outerRadius={70}
                  paddingAngle={4}
                >
                  {protocols.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: any) => [`${value}%`, 'Share']}
                  contentStyle={{
                    backgroundColor: '#0c1018',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-md)',
                    fontSize: '12px',
                    fontFamily: 'var(--font-mono)',
                    color: 'var(--text-primary)',
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {protocols.map((item, idx) => (
              <div
                key={item.protocol}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  fontSize: '12px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span
                    style={{
                      width: '10px',
                      height: '10px',
                      borderRadius: '2px',
                      backgroundColor: COLORS[idx % COLORS.length],
                    }}
                  />
                  <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--text-primary)' }}>
                    {item.protocol}
                  </span>
                </div>
                <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
                  {item.percentage}%
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </GlassCard>
  );
};
