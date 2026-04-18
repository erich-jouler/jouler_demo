import React from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  BarChart, Bar, ResponsiveContainer, ReferenceLine
} from 'recharts';

const MONTH_END = [744, 1416, 2160, 2880, 3624, 4344, 5088, 5832, 6552, 7296, 8016, 8760];
const MONTH_START = [0, 744, 1416, 2160, 2880, 3624, 4344, 5088, 5832, 6552, 7296, 8016];
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const ENERGY_RATE = 0.20;        // $/kWh
const DEMAND_RATE = 15;          // $/kW-month
const CAPACITY_RATE = 200;       // $/kW-year

function hourToDate(hour) {
  for (let m = 0; m < 12; m++) {
    if (hour <= MONTH_END[m]) {
      const day = Math.max(1, Math.ceil((hour - MONTH_START[m]) / 24));
      return `${MONTH_NAMES[m]} ${day}`;
    }
  }
  return `h${hour}`;
}

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

function PeakWeekChart({ week, title, accent }) {
  return (
    <div className="border border-[#E5E5E5] bg-white p-5 rounded-sm">
      <div className="flex items-baseline justify-between mb-1">
        <p className="text-xs font-medium tracking-widest uppercase text-[#356B4F]">{title}</p>
        <p className="text-xs font-mono text-[#525252]">{hourToDate(week.startHour)} – {hourToDate(week.endHour)}</p>
      </div>
      <p className="text-xs text-[#525252] mb-4">Peak demand hour: <span className="font-mono text-[#0A0A0A]">{hourToDate(week.peakHour)}</span></p>
      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={week.data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#E5E5E5" />
          <XAxis dataKey="hour" tick={{ fontSize: 10, fill: '#525252' }} tickFormatter={hourToDate} interval={23} />
          <YAxis yAxisId="energy" orientation="left" tick={{ fontSize: 10, fill: '#525252' }} tickFormatter={v => `${v.toFixed(0)} kW`} />
          <YAxis yAxisId="cop" orientation="right" tick={{ fontSize: 10, fill: '#525252' }} domain={[0, 'auto']} />
          <Tooltip
            contentStyle={{ border: '1px solid #E5E5E5', borderRadius: 2, fontSize: 11 }}
            labelFormatter={h => `Hour ${h} (${hourToDate(h)})`}
            formatter={(v, name) =>
              name.includes('COP') ? [v.toFixed(2), name] : [`${v.toFixed(0)} kW`, name]
            }
          />
          <Legend wrapperStyle={{ fontSize: 10 }} iconSize={10} />
          <ReferenceLine yAxisId="energy" x={week.peakHour} stroke={accent} strokeDasharray="2 3" strokeWidth={1} />
          <Line yAxisId="energy" type="monotone" dataKey="airTotal" stroke="#ef4444" strokeWidth={1.8} name="Air-source (kW)" dot={false} />
          <Line yAxisId="energy" type="monotone" dataKey="geoTotal" stroke="#356B4F" strokeWidth={1.8} name="TEN (kW)" dot={false} />
          <Line yAxisId="cop" type="monotone" dataKey="airCOP" stroke="#ef4444" strokeWidth={1.2} strokeDasharray="5 5" name="Air-source COP" dot={false} />
          <Line yAxisId="cop" type="monotone" dataKey="geoCOP" stroke="#356B4F" strokeWidth={1.2} strokeDasharray="5 5" name="TEN COP" dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

const EfficiencyDashboard = ({ annual, winterWeek, summerWeek }) => {
  if (!annual) {
    return (
      <div className="flex items-center justify-center h-48 border border-[#E5E5E5] bg-white">
        <p className="text-sm text-[#525252] font-mono">Computing annual metrics...</p>
      </div>
    );
  }

  const energySavings$ = annual.annualSavingsKwh * ENERGY_RATE;
  const demandSavings$ = annual.monthlyDemandSavingsKwMonth * DEMAND_RATE;
  const capacitySavings$ = annual.annualPeakReductionKw * CAPACITY_RATE;
  const totalSavings$ = energySavings$ + demandSavings$ + capacitySavings$;

  const seasonalCopData = [
    { season: 'Winter',    TEN: annual.winterCOP.geoCOP, AirSource: annual.winterCOP.airCOP },
    { season: 'Summer',    TEN: annual.summerCOP.geoCOP, AirSource: annual.summerCOP.airCOP },
    { season: 'Full year', TEN: annual.avgGeoCOP,        AirSource: annual.avgAirCOP       },
  ];

  const monthlyDemandData = MONTH_NAMES.map((name, i) => ({
    month: name,
    TEN: annual.monthlyPeakGeoKw[i],
    AirSource: annual.monthlyPeakAirKw[i],
    Reduction: annual.monthlyPeakReductionKw[i]
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-baseline justify-between">
        <p className="text-xs font-medium tracking-widest uppercase text-[#356B4F]">Annual performance, full year</p>
        <p className="text-xs text-[#525252] font-mono">8,760 hours</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          label="Energy savings"
          value={`${(annual.annualSavingsKwh / 1000).toFixed(0)}`}
          unit="MWh"
          sub={`$${ENERGY_RATE.toFixed(2)}/kWh → $${(energySavings$ / 1000).toFixed(0)}K`}
        />
        <MetricCard
          label="Demand savings"
          value={`${annual.monthlyDemandSavingsKwMonth.toFixed(0)}`}
          unit="kW-mo"
          sub={`$${DEMAND_RATE}/kW-mo → $${(demandSavings$ / 1000).toFixed(0)}K`}
        />
        <MetricCard
          label="Capacity savings"
          value={`${annual.annualPeakReductionKw.toFixed(0)}`}
          unit="kW-yr"
          sub={`$${CAPACITY_RATE}/kW-yr → $${(capacitySavings$ / 1000).toFixed(0)}K`}
        />
        <MetricCard
          highlight
          label="Total annual savings"
          value={`$${(totalSavings$ / 1000).toFixed(0)}K`}
          unit="/yr"
          sub="Stacked across energy, demand, capacity"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="border border-[#E5E5E5] bg-white p-5 rounded-sm">
          <p className="text-xs font-medium tracking-widest uppercase text-[#525252] mb-4">COP by season</p>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={seasonalCopData} barCategoryGap="25%">
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E5E5" />
              <XAxis dataKey="season" tick={{ fontSize: 11, fill: '#525252' }} />
              <YAxis tick={{ fontSize: 11, fill: '#525252' }} />
              <Tooltip
                formatter={v => [v.toFixed(2), 'COP']}
                contentStyle={{ border: '1px solid #E5E5E5', borderRadius: 2, fontSize: 12 }}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} iconSize={10} />
              <Bar dataKey="TEN" fill="#356B4F" name="Thermal network" />
              <Bar dataKey="AirSource" fill="#D1D5DB" name="Air-source baseline" />
            </BarChart>
          </ResponsiveContainer>
          <p className="text-xs text-[#525252] mt-3">Load-weighted. Winter = Dec–Feb, Summer = Jun–Aug.</p>
        </div>

        <div className="border border-[#E5E5E5] bg-white p-5 rounded-sm">
          <p className="text-xs font-medium tracking-widest uppercase text-[#525252] mb-4">Monthly peak demand</p>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={monthlyDemandData} barCategoryGap="15%">
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E5E5" />
              <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#525252' }} />
              <YAxis tick={{ fontSize: 10, fill: '#525252' }} tickFormatter={v => `${v.toFixed(0)}`} />
              <Tooltip
                formatter={(v, name) => [`${v.toFixed(0)} kW`, name]}
                contentStyle={{ border: '1px solid #E5E5E5', borderRadius: 2, fontSize: 12 }}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} iconSize={10} />
              <Bar dataKey="AirSource" fill="#ef4444" name="Air-source peak (kW)" />
              <Bar dataKey="TEN" fill="#356B4F" name="TEN peak (kW)" />
            </BarChart>
          </ResponsiveContainer>
          <p className="text-xs text-[#525252] mt-3">Gap between bars = monthly demand reduction.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <PeakWeekChart week={winterWeek} title="Peak winter week" accent="#356B4F" />
        <PeakWeekChart week={summerWeek} title="Peak summer week" accent="#356B4F" />
      </div>
    </div>
  );
};

export default EfficiencyDashboard;
