import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, BarChart, Bar, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

const EfficiencyDashboard = ({ currentData, timeSeriesData, systemMetrics }) => {
  if (!currentData || !systemMetrics) {
    return (
      <div className="flex items-center justify-center h-64 bg-white rounded-lg shadow-md">
        <div className="text-gray-500">Loading efficiency data...</div>
      </div>
    );
  }

  // Calculate key metrics
  const totalGeoElectric = systemMetrics.totalGeoElectric / 1000; // Convert to kW
  const totalAirElectric = systemMetrics.totalAirElectric / 1000;
  const totalSavings = systemMetrics.totalEnergySavings / 1000;
  const efficiencyGain = systemMetrics.systemEfficiencyGain;
  const avgGeoCOP = systemMetrics.avgGeoCOP;
  const avgAirCOP = systemMetrics.avgAirCOP;

  // Cost calculations (assuming $0.12/kWh)
  const energyRate = 0.12;
  const hourlyCostSavings = totalSavings * energyRate;
  const annualCostSavings = hourlyCostSavings * 8760;
  const peakDemandReduction = totalSavings;

  // Investment assumptions
  const infrastructureInvestment = 5000000; // $5M network investment
  const paybackPeriod = infrastructureInvestment / Math.max(1, annualCostSavings);

  // Prepare chart data
  const copComparisonData = [
    { name: 'TEN System', COP: avgGeoCOP, color: '#22c55e' },
    { name: 'Individual Heat Pumps', COP: avgAirCOP, color: '#ef4444' }
  ];

  const energyComparisonData = [
    { name: 'TEN Consumption', value: totalGeoElectric, color: '#22c55e' },
    { name: 'Heat Pump Consumption', value: totalAirElectric, color: '#ef4444' }
  ];

  const MetricCard = ({ title, value, unit, subtitle, trend, color = "text-gray-900" }) => (
    <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-600 uppercase tracking-wide font-medium">{title}</p>
          <p className={`text-3xl font-bold ${color} mt-2`}>
            {typeof value === 'number' ? value.toLocaleString() : value}{unit}
          </p>
          {subtitle && <p className="text-sm text-gray-500 mt-1">{subtitle}</p>}
        </div>
        {trend && (
          <div className={`text-2xl ${trend > 0 ? 'text-green-500' : 'text-red-500'}`}>
            {trend > 0 ? '↗' : '↘'}
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Key Metrics Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard
          title="System COP Advantage"
          value={efficiencyGain.toFixed(1)}
          unit="%"
          subtitle="TEN vs Heat Pumps"
          trend={efficiencyGain}
          color="text-green-600"
        />
        <MetricCard
          title="Energy Savings"
          value={totalSavings.toFixed(0)}
          unit=" kW"
          subtitle="Current hour reduction"
          trend={totalSavings}
          color="text-blue-600"
        />
        <MetricCard
          title="Cost Savings"
          value={`$${hourlyCostSavings.toFixed(0)}`}
          unit="/hr"
          subtitle={`$${(annualCostSavings/1000).toFixed(0)}K annually`}
          trend={hourlyCostSavings}
          color="text-green-600"
        />
        <MetricCard
          title="Payback Period"
          value={paybackPeriod.toFixed(1)}
          unit=" years"
          subtitle="Infrastructure ROI"
          color="text-purple-600"
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* COP Comparison Chart */}
        <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
          <h3 className="text-lg font-semibold mb-4">COP Performance Comparison</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={copComparisonData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip formatter={(value) => [value.toFixed(2), 'COP']} />
              <Bar dataKey="COP" fill="#22c55e" />
            </BarChart>
          </ResponsiveContainer>
          <div className="mt-4 text-sm text-gray-600">
            Higher COP = More efficient heating/cooling
          </div>
        </div>

        {/* Energy Consumption Pie Chart */}
        <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
          <h3 className="text-lg font-semibold mb-4">Energy Consumption Split</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={energyComparisonData}
                cx="50%"
                cy="50%"
                outerRadius={100}
                fill="#8884d8"
                dataKey="value"
                label={({ name, value }) => `${name}: ${value.toFixed(0)} kW`}
              >
                {energyComparisonData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip formatter={(value) => [`${value.toFixed(0)} kW`, 'Consumption']} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Time Series Performance Chart */}
      {timeSeriesData && timeSeriesData.length > 0 && (
        <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
          <h3 className="text-lg font-semibold mb-4">January Performance Trends (First 168 Hours)</h3>
          <ResponsiveContainer width="100%" height={400}>
            <LineChart data={timeSeriesData.slice(0, 168)}> {/* Show first week of January */}
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="hour" />
              <YAxis yAxisId="energy" orientation="left" />
              <YAxis yAxisId="cop" orientation="right" />
              <Tooltip 
                formatter={(value, name) => {
                  if (name.includes('COP')) return [value.toFixed(2), name];
                  return [`${value.toFixed(0)} kW`, name];
                }}
              />
              <Legend />
              <Line 
                yAxisId="energy"
                type="monotone" 
                dataKey="geoTotal" 
                stroke="#22c55e" 
                strokeWidth={2}
                name="TEN Consumption (kW)"
                dot={false}
              />
              <Line 
                yAxisId="energy"
                type="monotone" 
                dataKey="airTotal" 
                stroke="#ef4444" 
                strokeWidth={2}
                name="Heat Pump Consumption (kW)"
                dot={false}
              />
              <Line 
                yAxisId="cop"
                type="monotone" 
                dataKey="geoCOP" 
                stroke="#059669" 
                strokeWidth={2}
                strokeDasharray="5 5"
                name="TEN COP"
                dot={false}
              />
              <Line 
                yAxisId="cop"
                type="monotone" 
                dataKey="airCOP" 
                stroke="#dc2626" 
                strokeWidth={2}
                strokeDasharray="5 5"
                name="Heat Pump COP"
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
          <div className="mt-4 text-sm text-gray-600">
            Solid lines: Energy consumption (kW, left axis) | Dashed lines: COP efficiency (right axis) | Showing first week of January
          </div>
        </div>
      )}

      {/* Executive Summary */}
      <div className="bg-gradient-to-r from-blue-50 to-green-50 rounded-lg shadow-md p-6 border border-gray-200">
        <h3 className="text-lg font-semibold mb-4 text-gray-800">Executive Summary</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <h4 className="font-medium text-gray-700 mb-2">Efficiency Advantage</h4>
            <p className="text-sm text-gray-600">
              The thermal network operates at {avgGeoCOP.toFixed(1)} COP vs {avgAirCOP.toFixed(1)} for individual heat pumps, 
              delivering <span className="font-semibold text-green-600">{efficiencyGain.toFixed(1)}%</span> efficiency improvement.
            </p>
          </div>
          <div>
            <h4 className="font-medium text-gray-700 mb-2">Economic Impact</h4>
            <p className="text-sm text-gray-600">
              Annual savings of <span className="font-semibold text-green-600">${(annualCostSavings/1000).toFixed(0)}K</span> with 
              infrastructure payback in <span className="font-semibold">{paybackPeriod.toFixed(1)} years</span>.
            </p>
          </div>
          <div>
            <h4 className="font-medium text-gray-700 mb-2">Grid Benefits</h4>
            <p className="text-sm text-gray-600">
              Peak demand reduction of <span className="font-semibold text-blue-600">{peakDemandReduction.toFixed(0)} kW</span> 
              reduces grid stress and infrastructure requirements.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EfficiencyDashboard;