import React from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';

const ENERGY_RATE = 0.20;   // $/kWh
const DEMAND_RATE = 15;     // $/kW-month
const CAPACITY_RATE = 200;  // $/kW-year

const MetricCard = ({ label, value, unit, sub, highlight }) => (
  <div className={`border p-5 rounded-sm ${highlight ? 'border-[#356B4F] bg-[#EEF5F0]' : 'border-[#E5E5E5] bg-white'}`}>
    <p className="text-xs font-medium tracking-widest uppercase text-[#525252] mb-3">{label}</p>
    <p className="font-mono text-2xl text-[#0A0A0A]">
      {value}
      {unit && <span className="text-base text-[#525252] ml-1">{unit}</span>}
    </p>
    {sub && <p className="text-xs text-[#525252] mt-1">{sub}</p>}
  </div>
);

const AssetValuation = ({ breakdown, selectedAsset, onAssetSelect }) => {
  if (!breakdown?.length) {
    return (
      <div className="flex items-center justify-center h-48 border border-[#E5E5E5] bg-white">
        <p className="text-sm text-[#525252] font-mono">Loading asset data...</p>
      </div>
    );
  }

  const rows = breakdown.map(b => {
    const energy$ = b.annualSavingsKwh * ENERGY_RATE;
    const demand$ = b.monthlyDemandSavingsKwMonth * DEMAND_RATE;
    const capacity$ = b.annualPeakReductionKw * CAPACITY_RATE;
    const total$ = energy$ + demand$ + capacity$;
    return { ...b, energy$, demand$, capacity$, total$ };
  });

  const totalCapital = rows.reduce((s, r) => s + r.capital, 0);
  const totalSavings = rows.reduce((s, r) => s + r.total$, 0);
  const totalThermalMwh = rows.reduce((s, r) => s + r.thermalServiceMwh, 0);
  const blendedLcotPerMwh = rows.reduce(
    (s, r) => s + r.lcotPerMwh * r.thermalServiceMwh, 0
  ) / Math.max(1, totalThermalMwh);
  const totalHeatingMwh = rows.reduce((s, r) => s + r.heatingMwh, 0);
  const totalCoolingMwh = rows.reduce((s, r) => s + r.coolingMwh, 0);

  const savingsChartData = rows.map(r => ({
    name: r.name,
    Energy: Math.round(r.energy$),
    Demand: Math.round(r.demand$),
    Capacity: Math.round(r.capacity$)
  }));

  const thermalMixData = rows.map(r => ({
    name: r.name,
    Heating: Number(r.heatingMwh.toFixed(1)),
    Cooling: Number(r.coolingMwh.toFixed(1))
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-baseline justify-between">
        <p className="text-xs font-medium tracking-widest uppercase text-[#356B4F]">Asset economics, per borefield</p>
        <p className="text-xs text-[#525252] font-mono">{rows.length} assets · {rows.reduce((s, r) => s + r.buildingCount, 0)} buildings served</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          label="Infrastructure"
          value={`$${(totalCapital / 1_000_000).toFixed(1)}M`}
          sub="Across three borefields"
        />
        <MetricCard
          label="Thermal delivered"
          value={`${(totalThermalMwh / 1000).toFixed(1)}`}
          unit="GWh/yr"
          sub="Heating + cooling service"
        />
        <MetricCard
          label="Levelized cost of thermal"
          value={`$${blendedLcotPerMwh.toFixed(0)}`}
          unit="/MWh"
          sub={`${(totalHeatingMwh / totalThermalMwh * 100).toFixed(0)}% heating · ${(totalCoolingMwh / totalThermalMwh * 100).toFixed(0)}% cooling`}
        />
        <MetricCard
          highlight
          label="Total annual savings"
          value={`$${(totalSavings / 1000).toFixed(0)}K`}
          unit="/yr"
          sub="Energy + demand + capacity"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="border border-[#E5E5E5] bg-white p-5 rounded-sm">
          <p className="text-xs font-medium tracking-widest uppercase text-[#525252] mb-4">Annual savings by borefield</p>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={savingsChartData} barCategoryGap="25%">
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E5E5" />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#525252' }} />
              <YAxis tick={{ fontSize: 10, fill: '#525252' }} tickFormatter={v => `$${(v / 1000).toFixed(0)}K`} />
              <Tooltip
                formatter={v => [`$${(v / 1000).toFixed(1)}K`, '']}
                contentStyle={{ border: '1px solid #E5E5E5', borderRadius: 2, fontSize: 12 }}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} iconSize={10} />
              <Bar dataKey="Energy"   stackId="s" fill="#356B4F" />
              <Bar dataKey="Demand"   stackId="s" fill="#6B9A7E" />
              <Bar dataKey="Capacity" stackId="s" fill="#A8C8B5" />
            </BarChart>
          </ResponsiveContainer>
          <p className="text-xs text-[#525252] mt-3">Stacked at the same rates as the Performance tab.</p>
        </div>

        <div className="border border-[#E5E5E5] bg-white p-5 rounded-sm">
          <p className="text-xs font-medium tracking-widest uppercase text-[#525252] mb-4">Heating vs cooling service</p>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={thermalMixData} barCategoryGap="25%">
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E5E5" />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#525252' }} />
              <YAxis tick={{ fontSize: 10, fill: '#525252' }} tickFormatter={v => `${v.toFixed(0)}`} />
              <Tooltip
                formatter={v => [`${v.toFixed(0)} MWh`, '']}
                contentStyle={{ border: '1px solid #E5E5E5', borderRadius: 2, fontSize: 12 }}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} iconSize={10} />
              <Bar dataKey="Heating" fill="#D97706" />
              <Bar dataKey="Cooling" fill="#356B4F" />
            </BarChart>
          </ResponsiveContainer>
          <p className="text-xs text-[#525252] mt-3">Thermal energy delivered annually, split by service type.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {rows.map(asset => (
          <div
            key={asset.id}
            onClick={() => onAssetSelect?.({ id: asset.id })}
            className={`border rounded-sm p-5 cursor-pointer transition-colors ${
              selectedAsset === asset.id
                ? 'border-[#356B4F] bg-[#EEF5F0]'
                : 'border-[#E5E5E5] bg-white hover:border-[#356B4F]'
            }`}
          >
            <div className="flex justify-between items-start mb-4">
              <div>
                <p className="font-medium text-[#0A0A0A]">{asset.name}</p>
                <p className="text-xs text-[#525252] mt-0.5">{asset.buildingCount} buildings served</p>
              </div>
              <div className="text-right">
                <p className="font-mono text-lg text-[#356B4F]">${(asset.total$ / 1000).toFixed(0)}K</p>
                <p className="text-xs text-[#525252]">annual savings</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm mb-4">
              <div>
                <p className="text-xs text-[#525252]">Heating delivered</p>
                <p className="font-mono text-[#0A0A0A]">{asset.heatingMwh.toFixed(0)} MWh</p>
              </div>
              <div>
                <p className="text-xs text-[#525252]">COP</p>
                <p className="font-mono text-[#0A0A0A]">{asset.cop.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-xs text-[#525252]">Cooling delivered</p>
                <p className="font-mono text-[#0A0A0A]">{asset.coolingMwh.toFixed(0)} MWh</p>
              </div>
              <div>
                <p className="text-xs text-[#525252]">LCOT</p>
                <p className="font-mono text-[#0A0A0A]">${asset.lcotPerKwh.toFixed(3)}/kWh</p>
              </div>
            </div>

            <div className="border-t border-[#E5E5E5] pt-3 space-y-1.5 text-sm">
              <div className="flex justify-between">
                <span className="text-[#525252]">Energy savings</span>
                <span className="font-mono text-[#0A0A0A]">${(asset.energy$ / 1000).toFixed(0)}K</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#525252]">Demand savings</span>
                <span className="font-mono text-[#0A0A0A]">${(asset.demand$ / 1000).toFixed(0)}K</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#525252]">Capacity savings</span>
                <span className="font-mono text-[#0A0A0A]">${(asset.capacity$ / 1000).toFixed(0)}K</span>
              </div>
              <div className="flex justify-between border-t border-[#E5E5E5] pt-1.5 mt-1.5">
                <span className="text-[#525252]">Capital</span>
                <span className="font-mono text-[#525252]">${(asset.capital / 1_000_000).toFixed(1)}M</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default AssetValuation;
