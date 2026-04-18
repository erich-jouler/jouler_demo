import React, { useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ScatterChart, Scatter } from 'recharts';

const AssetValuation = ({ assetData, selectedAsset, onAssetSelect }) => {
  const [sortBy, setSortBy] = useState('networkValue');
  const [filterType, setFilterType] = useState('all');

  if (!assetData || assetData.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 bg-white rounded-lg shadow-md">
        <div className="text-gray-500">Loading asset valuation data...</div>
      </div>
    );
  }

  // Filter and sort assets
  const filteredAssets = assetData
    .filter(asset => filterType === 'all' || asset.type.toLowerCase().includes(filterType.toLowerCase()))
    .sort((a, b) => {
      switch (sortBy) {
        case 'networkValue': return b.networkValue - a.networkValue;
        case 'annualSavings': return b.annualSavings - a.annualSavings;
        case 'efficiency': return b.efficiency - a.efficiency;
        case 'utilization': return b.utilization - a.utilization;
        case 'paybackPeriod': return a.paybackPeriod - b.paybackPeriod;
        default: return 0;
      }
    });

  // Top 10 assets for charts
  const topAssets = filteredAssets.slice(0, 10);

  // Summary statistics
  const totalNetworkValue = filteredAssets.reduce((sum, asset) => sum + asset.networkValue, 0);
  const avgEfficiency = filteredAssets.reduce((sum, asset) => sum + asset.efficiency, 0) / filteredAssets.length;
  const avgUtilization = filteredAssets.reduce((sum, asset) => sum + asset.utilization, 0) / filteredAssets.length;
  const totalAnnualSavings = filteredAssets.reduce((sum, asset) => sum + asset.annualSavings, 0);

  // Asset type distribution
  const assetTypes = filteredAssets.reduce((acc, asset) => {
    acc[asset.type] = (acc[asset.type] || 0) + 1;
    return acc;
  }, {});

  const AssetCard = ({ asset, isSelected, onClick }) => (
    <div 
      className={`bg-white rounded-lg shadow-md p-4 border cursor-pointer transition-all hover:shadow-lg ${
        isSelected ? 'border-blue-500 ring-2 ring-blue-200' : 'border-gray-200'
      }`}
      onClick={() => onClick(asset)}
    >
      <div className="flex justify-between items-start mb-3">
        <div>
          <h4 className="font-semibold text-gray-900">{asset.name}</h4>
          <p className="text-sm text-gray-600">{asset.type}</p>
        </div>
        <div className="text-right">
          <div className="text-lg font-bold text-green-600">
            ${(asset.networkValue / 1000).toFixed(0)}K
          </div>
          <div className="text-xs text-gray-500">Network Value</div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <div className="text-gray-600">Capacity</div>
          <div className="font-medium">{(asset.capacity / 1000).toFixed(0)} kW</div>
        </div>
        <div>
          <div className="text-gray-600">Utilization</div>
          <div className="font-medium">{asset.utilization.toFixed(0)}%</div>
        </div>
        <div>
          <div className="text-gray-600">Efficiency</div>
          <div className="font-medium">{asset.efficiency.toFixed(1)} COP</div>
        </div>
        <div>
          <div className="text-gray-600">Ground Temp</div>
          <div className="font-medium">{asset.groundTemp}°F</div>
        </div>
      </div>

      <div className="mt-3 pt-3 border-t border-gray-100 space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-gray-600">Annual Savings:</span>
          <span className="font-medium text-green-600">
            ${(asset.annualSavings / 1000).toFixed(0)}K
          </span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-600">Installation Cost:</span>
          <span className="font-medium text-blue-600">
            ${(asset.installationCost / 1000000).toFixed(1)}M
          </span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-600">Payback Period:</span>
          <span className="font-medium text-purple-600">
            {asset.paybackPeriod.toFixed(1)} yrs
          </span>
        </div>
      </div>

      {/* Efficiency bar */}
      <div className="mt-3">
        <div className="flex justify-between text-xs text-gray-500 mb-1">
          <span>COP Performance</span>
          <span>{((asset.efficiency / 5) * 100).toFixed(0)}%</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div 
            className="bg-gradient-to-r from-green-400 to-green-600 h-2 rounded-full"
            style={{ width: `${Math.min(100, (asset.efficiency / 5) * 100)}%` }}
          ></div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
          <div className="text-sm text-gray-600 uppercase tracking-wide">Total Network Value</div>
          <div className="text-2xl font-bold text-green-600 mt-2">
            ${(totalNetworkValue / 1000000).toFixed(1)}M
          </div>
          <div className="text-xs text-gray-500 mt-1">Annual revenue potential</div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
          <div className="text-sm text-gray-600 uppercase tracking-wide">Avg Efficiency</div>
          <div className="text-2xl font-bold text-blue-600 mt-2">
            {avgEfficiency.toFixed(2)}
          </div>
          <div className="text-xs text-gray-500 mt-1">System COP</div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
          <div className="text-sm text-gray-600 uppercase tracking-wide">Avg Utilization</div>
          <div className="text-2xl font-bold text-orange-600 mt-2">
            {avgUtilization.toFixed(0)}%
          </div>
          <div className="text-xs text-gray-500 mt-1">Capacity usage</div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
          <div className="text-sm text-gray-600 uppercase tracking-wide">Total Savings</div>
          <div className="text-2xl font-bold text-purple-600 mt-2">
            ${(totalAnnualSavings / 1000).toFixed(0)}K
          </div>
          <div className="text-xs text-gray-500 mt-1">Annual operational savings</div>
        </div>
      </div>

      {/* Controls */}
      <div className="bg-white rounded-lg shadow-md p-4 border border-gray-200">
        <div className="flex flex-wrap gap-4 items-center">
          <div>
            <label className="text-sm font-medium text-gray-700 mr-2">Sort by:</label>
            <select 
              value={sortBy} 
              onChange={(e) => setSortBy(e.target.value)}
              className="border border-gray-300 rounded-md px-3 py-1 text-sm"
            >
              <option value="networkValue">Network Value</option>
              <option value="annualSavings">Annual Savings</option>
              <option value="efficiency">Efficiency</option>
              <option value="utilization">Utilization</option>
              <option value="paybackPeriod">Payback Period</option>
            </select>
          </div>
          
          <div>
            <label className="text-sm font-medium text-gray-700 mr-2">Filter:</label>
            <select 
              value={filterType} 
              onChange={(e) => setFilterType(e.target.value)}
              className="border border-gray-300 rounded-md px-3 py-1 text-sm"
            >
              <option value="all">All Borefields</option>
              <option value="geothermal">Geothermal Assets</option>
            </select>
          </div>

          <div className="ml-auto text-sm text-gray-600">
            Showing {filteredAssets.length} assets
          </div>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Assets by Network Value */}
        <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
          <h3 className="text-lg font-semibold mb-4">Top Assets by Network Value</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={topAssets} layout="horizontal">
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" />
              <YAxis dataKey="name" type="category" width={80} fontSize={10} />
              <Tooltip formatter={(value) => [`$${(value/1000).toFixed(0)}K`, 'Value']} />
              <Bar dataKey="networkValue" fill="#22c55e" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Efficiency vs Utilization Scatter */}
        <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
          <h3 className="text-lg font-semibold mb-4">Efficiency vs Utilization</h3>
          <ResponsiveContainer width="100%" height={300}>
            <ScatterChart data={filteredAssets}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="utilization" name="Utilization" unit="%" />
              <YAxis dataKey="efficiency" name="Efficiency" unit=" COP" />
              <Tooltip 
                cursor={{ strokeDasharray: '3 3' }}
                formatter={(value, name) => [
                  name === 'efficiency' ? `${value.toFixed(2)} COP` : `${value.toFixed(0)}%`,
                  name === 'efficiency' ? 'Efficiency' : 'Utilization'
                ]}
                labelFormatter={(_, payload) => payload?.[0]?.payload?.name || ''}
              />
              <Scatter 
                dataKey="efficiency" 
                fill="#3b82f6"
                r={6}
              />
            </ScatterChart>
          </ResponsiveContainer>
          <div className="mt-2 text-sm text-gray-600">
            Higher efficiency and utilization = better asset performance
          </div>
        </div>
      </div>

      {/* Asset Grid */}
      <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-lg font-semibold">Borefield Asset Analysis</h3>
          <div className="text-sm text-gray-600">
            {filteredAssets.length} Geothermal Borefields
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredAssets.map(asset => (
            <AssetCard 
              key={asset.id}
              asset={asset}
              isSelected={selectedAsset === asset.id}
              onClick={onAssetSelect}
            />
          ))}
        </div>
      </div>

      {/* Investment Analysis */}
      <div className="bg-gradient-to-r from-green-50 to-blue-50 rounded-lg shadow-md p-6 border border-gray-200">
        <h3 className="text-lg font-semibold mb-4 text-gray-800">Geothermal Borefield Investment Analysis</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <h4 className="font-medium text-gray-700 mb-2">Geothermal Infrastructure</h4>
            <p className="text-sm text-gray-600">
              Three geothermal borefields provide the thermal foundation for the network, 
              delivering consistent ground-source energy with high efficiency.
            </p>
          </div>
          <div>
            <h4 className="font-medium text-gray-700 mb-2">Performance Metrics</h4>
            <p className="text-sm text-gray-600">
              Borefields operate at 4.7-4.9 COP with 68-82% capacity utilization, 
              significantly outperforming individual air-source heat pumps.
            </p>
          </div>
          <div>
            <h4 className="font-medium text-gray-700 mb-2">Investment Returns</h4>
            <p className="text-sm text-gray-600">
              Total investment of $5.4M across all borefields generates $650K annual savings 
              with 7.8-9.1 year payback periods.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AssetValuation;