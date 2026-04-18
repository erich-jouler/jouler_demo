import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';

const NetworkVisualization = ({ data, systemData, onNodeSelect, selectedNode, currentHour }) => {
  const svgRef = useRef();
  const [tooltip, setTooltip] = useState({ visible: false, x: 0, y: 0, content: '' });

  useEffect(() => {
    if (!data) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const width = 1100;
    const height = 820;

    svg
      .attr('width', width)
      .attr('height', height)
      .attr('viewBox', `0 0 ${width} ${height}`);

    const g = svg.append('g').attr('transform', `translate(${width / 2},${height / 2})`);

    const networkTopology = [
      { id: 'borefield_1', type: 'borefield', name: 'Borefield 1', shortName: 'BF1' },
      { id: 'b_1', type: 'building', name: 'Fire Dept', shortName: 'Fire Dept' },
      { id: 'b_2', type: 'building', name: 'Gulf', shortName: 'Gulf' },
      { id: 'b_3', type: 'building', name: 'Corner Cabinet', shortName: 'Corner\nCabinet' },
      { id: 'borefield_2', type: 'borefield', name: 'Borefield 2', shortName: 'BF2' },
      { id: 'pump', type: 'pump', name: 'Main Pump', shortName: 'Pump' },
      { id: 'b_4', type: 'building', name: 'Public School', shortName: 'Public\nSchool' },
      { id: 'b_5', type: 'building', name: 'Housing Dept', shortName: 'Housing\nDept' },
    ];

    for (let i = 6; i <= 15; i++) {
      networkTopology.push({ id: `b_${i}`, type: 'building', name: `Res ${i - 5}`, shortName: `R${i - 5}` });
    }
    networkTopology.push({ id: 'borefield_3', type: 'borefield', name: 'Borefield 3', shortName: 'BF3' });
    for (let i = 16; i <= 36; i++) {
      networkTopology.push({ id: `b_${i}`, type: 'building', name: `Res ${i - 5}`, shortName: `R${i - 5}` });
    }

    const radius = 280;
    const nodePositions = {};
    networkTopology.forEach((node, index) => {
      const angle = (2 * Math.PI * index / networkTopology.length) - Math.PI / 2;
      nodePositions[node.id] = { x: radius * Math.cos(angle), y: radius * Math.sin(angle), ...node };
    });

    const buildingData = data || {};
    const enhancedNodes = Object.values(nodePositions).map(node => {
      if (node.type === 'building' && buildingData[node.id]) {
        const building = buildingData[node.id];
        return {
          ...node,
          temperature: building.inletTemp?.fahrenheit || 50,
          load: Math.abs(building.load || 0),
          geoEfficiency: building.geo?.cop || 0,
          airEfficiency: building.air?.cop || 0,
          energySavings: building.efficiency?.energySavings || 0,
          efficiencyGain: building.efficiency?.efficiencyGain || 0
        };
      }
      return {
        ...node,
        temperature: node.type === 'borefield' ? 54 : 59,
        load: node.type === 'borefield' ? 5000 : 1000,
        geoEfficiency: node.type === 'borefield' ? 5.0 : 0,
        airEfficiency: 0,
        energySavings: 0,
        efficiencyGain: 0
      };
    });

    const getNodeColor = (node) => {
      switch (node.type) {
        case 'borefield': return '#356B4F';
        case 'pump': return '#92400E';
        case 'building':
          if (buildingData[node.id] && buildingData[node.id].load !== undefined) {
            return buildingData[node.id].load < 0 ? '#ef4444' : '#3b82f6';
          }
          return '#9CA3AF';
        default: return '#9CA3AF';
      }
    };

    const getNodeSize = (node) => {
      switch (node.type) {
        case 'borefield': return 22;
        case 'pump': return 18;
        case 'building': return Math.max(7, Math.min(18, (node.load / 1000) * 2));
        default: return 12;
      }
    };

    const connections = enhancedNodes.map((node, i) => ({
      source: node,
      target: enhancedNodes[(i + 1) % enhancedNodes.length]
    }));

    svg.append('defs').append('marker')
      .attr('id', 'arrowhead')
      .attr('viewBox', '0 -5 10 10')
      .attr('refX', 8).attr('refY', 0)
      .attr('markerWidth', 5).attr('markerHeight', 5)
      .attr('orient', 'auto')
      .append('path').attr('d', 'M0,-5L10,0L0,5').attr('fill', '#D1D5DB');

    g.selectAll('.flow-line')
      .data(connections)
      .join('path')
      .attr('class', 'flow-line')
      .attr('d', d => {
        const dx = d.target.x - d.source.x;
        const dy = d.target.y - d.source.y;
        const dr = Math.sqrt(dx * dx + dy * dy);
        return `M${d.source.x},${d.source.y}A${dr},${dr} 0 0,0 ${d.target.x},${d.target.y}`;
      })
      .attr('stroke', '#D1D5DB')
      .attr('stroke-width', 2)
      .attr('fill', 'none')
      .attr('opacity', 0.7)
      .attr('marker-end', 'url(#arrowhead)');

    g.selectAll('.network-node')
      .data(enhancedNodes)
      .join('circle')
      .attr('class', 'network-node')
      .attr('cx', d => d.x).attr('cy', d => d.y)
      .attr('r', d => getNodeSize(d))
      .attr('fill', d => getNodeColor(d))
      .attr('stroke', d => selectedNode === d.id ? '#0A0A0A' : '#ffffff')
      .attr('stroke-width', d => selectedNode === d.id ? 3 : 1.5)
      .style('cursor', 'pointer')
      .on('click', (event, d) => { event.stopPropagation(); onNodeSelect(d); })
      .on('mouseenter', (event, d) => {
        d3.select(event.target).attr('stroke', '#0A0A0A').attr('stroke-width', 2.5);
        let content = `<strong>${d.name}</strong>`;
        if (d.type === 'building') {
          const b = buildingData[d.id];
          const loadKw = (b?.load || 0) / 1000;
          const loadType = b?.load < 0 ? 'Heating' : 'Cooling';
          content += `<br/>${Math.abs(loadKw).toFixed(1)} kW (${loadType})`;
          content += `<br/>Efficiency gain: ${d.efficiencyGain?.toFixed(1) || 'N/A'}%`;
        } else if (d.type === 'borefield') {
          if (systemData) {
            const heatW = d.id === 'borefield_1' ? systemData.borefield1HeatW
              : d.id === 'borefield_2' ? systemData.borefield2HeatW
              : systemData.borefield3HeatW;
            if (heatW) content += `<br/>Heat supply: ${(heatW / 1000).toFixed(1)} kW`;
          }
        } else if (d.type === 'pump' && systemData?.massFlowKgs) {
          content += `<br/>Flow: ${systemData.massFlowKgs.toFixed(2)} kg/s`;
        }
        setTooltip({ visible: true, x: event.pageX + 12, y: event.pageY - 12, content });
      })
      .on('mouseleave', (event, d) => {
        d3.select(event.target)
          .attr('stroke', selectedNode === d.id ? '#0A0A0A' : '#ffffff')
          .attr('stroke-width', selectedNode === d.id ? 3 : 1.5);
        setTooltip({ visible: false, x: 0, y: 0, content: '' });
      });

    g.selectAll('.node-label')
      .data(enhancedNodes)
      .join('text')
      .attr('class', 'node-label')
      .attr('x', d => { const lr = radius + 38; const a = Math.atan2(d.y, d.x); return lr * Math.cos(a); })
      .attr('y', d => { const lr = radius + 38; const a = Math.atan2(d.y, d.x); return lr * Math.sin(a); })
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'middle')
      .attr('font-size', '9px')
      .attr('font-weight', d => d.type !== 'building' ? '600' : '400')
      .attr('fill', '#525252')
      .text(d => d.shortName)
      .each(function (d) {
        if (d.shortName.includes('\n')) {
          const lines = d.shortName.split('\n');
          d3.select(this).text('');
          lines.forEach((line, i) => {
            d3.select(this).append('tspan')
              .attr('x', d3.select(this).attr('x'))
              .attr('dy', i === 0 ? 0 : '1.2em')
              .text(line);
          });
        }
      });

    // Legend
    const legend = svg.append('g').attr('transform', 'translate(24, 24)');
    const legendItems = [
      { color: '#356B4F', label: 'Borefield' },
      { color: '#92400E', label: 'Pump' },
      { color: '#ef4444', label: 'Heating' },
      { color: '#3b82f6', label: 'Cooling' },
    ];
    legendItems.forEach((item, i) => {
      legend.append('circle').attr('cx', 7).attr('cy', i * 22).attr('r', 6).attr('fill', item.color);
      legend.append('text').attr('x', 18).attr('y', i * 22 + 4).attr('font-size', '11px').attr('fill', '#525252').text(item.label);
    });

  }, [data, systemData, selectedNode, onNodeSelect, currentHour]);

  return (
    <div className="relative w-full overflow-x-auto">
      <svg ref={svgRef} style={{ width: '100%', height: 'auto', minWidth: '500px' }} />
      {tooltip.visible && (
        <div
          style={{
            left: tooltip.x, top: tooltip.y, position: 'fixed',
            background: '#0A0A0A', color: '#F8F9FA',
            padding: '8px 12px', borderRadius: '2px',
            fontSize: '12px', fontFamily: 'JetBrains Mono, monospace',
            pointerEvents: 'none', zIndex: 1000, maxWidth: '200px',
            lineHeight: '1.6'
          }}
          dangerouslySetInnerHTML={{ __html: tooltip.content }}
        />
      )}
    </div>
  );
};

export default NetworkVisualization;
