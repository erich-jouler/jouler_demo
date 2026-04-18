import React, { useState, useEffect } from 'react';
import { ThermalNetworkDataProcessor } from './dataProcessor.js';
import NetworkVisualization from './NetworkVisualization.jsx';
import EfficiencyDashboard from './EfficiencyDashboard.jsx';
import AssetValuation from './AssetValuation.jsx';

const TABS = [
  { id: 'network', label: 'Network Topology' },
  { id: 'performance', label: 'Performance' },
  { id: 'assets', label: 'Asset Economics' },
];

const MONTH_HOURS = [744, 1416, 2160, 2880, 3624, 4344, 5088, 5832, 6552, 7296, 8016, 8760];
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function getMonthLabel(hour) {
  for (let i = 0; i < MONTH_HOURS.length; i++) {
    if (hour <= MONTH_HOURS[i]) return MONTH_NAMES[i];
  }
  return 'Dec';
}

export default function ThermalDemo() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [processor, setProcessor] = useState(null);
  const [currentHour, setCurrentHour] = useState(1);
  const [currentData, setCurrentData] = useState(null);
  const [timeSeriesData, setTimeSeriesData] = useState([]);
  const [borefieldBreakdown, setBorefieldBreakdown] = useState([]);
  const [activeTab, setActiveTab] = useState('network');
  const [selectedNode, setSelectedNode] = useState(null);
  const [selectedAsset, setSelectedAsset] = useState(null);
  const [status, setStatus] = useState('initializing');

  useEffect(() => {
    let cancelled = false;
    const t0 = performance.now();
    const log = (msg) => {
      const elapsed = ((performance.now() - t0) / 1000).toFixed(2);
      console.log(`[ThermalDemo +${elapsed}s] ${msg}`);
      if (!cancelled) setStatus(msg);
    };

    (async () => {
      try {
        log('mounting component');
        const proc = new ThermalNetworkDataProcessor();
        log('fetching /thermal-data.json');
        await proc.loadData();
        if (cancelled) return;
        log('processing first hour');
        const hourData = proc.getHourlyData(1);
        if (cancelled) return;
        setProcessor(proc);
        setBorefieldBreakdown(proc.getBorefieldBreakdown());
        setCurrentData(hourData);
        setLoading(false);
        log('ready');
      } catch (err) {
        console.error('[ThermalDemo] load failed:', err);
        if (!cancelled) {
          setError(`Load failed: ${err?.message || err}`);
          setLoading(false);
        }
      }
    })();

    return () => { cancelled = true; };
  }, []);

  const handleHourChange = (hour) => {
    setCurrentHour(hour);
    if (processor) {
      processor.setCurrentHour(hour);
      setCurrentData(processor.getHourlyData(hour));
    }
  };

  if (loading) {
    return (
      <div className="w-full border border-[#E5E5E5] bg-white flex items-center justify-center rounded-sm" style={{ minHeight: '480px' }}>
        <div className="text-center space-y-4">
          <div className="w-7 h-7 border-2 border-[#356B4F] border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm text-[#525252] font-mono">Loading 8,760 hours of data...</p>
          <p className="text-xs text-[#9CA3AF] font-mono">{status}</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full border border-[#E5E5E5] bg-white flex items-center justify-center rounded-sm" style={{ minHeight: '480px' }}>
        <p className="text-sm text-[#525252] font-mono">{error}</p>
      </div>
    );
  }

  const outdoorF = currentData?.outdoorTemp?.fahrenheit;

  return (
    <div className="border border-[#E5E5E5] bg-white rounded-sm">
      {/* Tab bar */}
      <div className="border-b border-[#E5E5E5] px-6">
        <div className="flex gap-8">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`py-4 text-sm border-b-2 transition-colors whitespace-nowrap ${
                activeTab === tab.id
                  ? 'border-[#356B4F] text-[#356B4F] font-medium'
                  : 'border-transparent text-[#525252] hover:text-[#0A0A0A]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Hour slider + outdoor temp */}
      <div className="border-b border-[#E5E5E5] px-6 py-4 flex flex-wrap items-center gap-6">
        <div className="flex-1 min-w-[220px]">
          <label className="text-xs font-mono text-[#525252] block mb-2">
            Hour {currentHour.toLocaleString()} of 8,760 &nbsp;&middot;&nbsp; {getMonthLabel(currentHour)}
          </label>
          <input
            type="range"
            min="1"
            max="8760"
            value={currentHour}
            onChange={e => handleHourChange(parseInt(e.target.value))}
            className="w-full accent-[#356B4F] cursor-pointer"
          />
        </div>
        {outdoorF !== undefined && (
          <div className="text-right shrink-0">
            <p className="text-xs text-[#525252]">Outdoor temp</p>
            <p className="font-mono text-xl text-[#0A0A0A]">{outdoorF.toFixed(1)}°F</p>
          </div>
        )}
      </div>

      {/* Tab content */}
      <div className="p-6">
        {activeTab === 'network' && (
          <NetworkVisualization
            data={currentData?.buildings}
            systemData={currentData?.systemData}
            onNodeSelect={setSelectedNode}
            selectedNode={selectedNode?.id}
            currentHour={currentHour}
          />
        )}
        {activeTab === 'performance' && processor && (
          <EfficiencyDashboard
            annual={processor.getAnnualSummary()}
            winterWeek={processor.getPeakWeek('winter')}
            summerWeek={processor.getPeakWeek('summer')}
          />
        )}
        {activeTab === 'assets' && (
          <AssetValuation
            breakdown={borefieldBreakdown}
            selectedAsset={selectedAsset?.id}
            onAssetSelect={setSelectedAsset}
          />
        )}
      </div>
    </div>
  );
}
