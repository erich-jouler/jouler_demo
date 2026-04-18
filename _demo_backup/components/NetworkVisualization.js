import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';

const NetworkVisualization = ({ data, systemData, onNodeSelect, selectedNode, currentHour }) => {
  const svgRef = useRef();
  const [tooltip, setTooltip] = useState({ visible: false, x: 0, y: 0, content: '' });

  useEffect(() => {
    if (!data) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const width = 1217;
    const height = 900;
    const margin = { top: 40, right: 40, bottom: 40, left: 40 };

    svg.attr('width', width).attr('height', height);

    const g = svg.append('g')
      .attr('transform', `translate(${width/2},${height/2})`);

    // Define the complete network topology in flow order
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

    // Add residential buildings 6-15 (Res 1-10)
    for (let i = 6; i <= 15; i++) {
      networkTopology.push({
        id: `b_${i}`, 
        type: 'building', 
        name: `Res ${i-5}`, 
        shortName: `R${i-5}`
      });
    }

    // Add borefield_3 after building 15
    networkTopology.push({ 
      id: 'borefield_3', 
      type: 'borefield', 
      name: 'Borefield 3', 
      shortName: 'BF3' 
    });

    // Add remaining residential buildings 16-36 (Res 11-31)
    for (let i = 16; i <= 36; i++) {
      networkTopology.push({
        id: `b_${i}`, 
        type: 'building', 
        name: `Res ${i-5}`, 
        shortName: `R${i-5}`
      });
    }

    // Calculate positions in a circle
    const radius = 300;
    const nodePositions = {};
    
    networkTopology.forEach((node, index) => {
      const angle = (2 * Math.PI * index / networkTopology.length) - Math.PI/2;
      nodePositions[node.id] = {
        x: radius * Math.cos(angle),
        y: radius * Math.sin(angle),
        ...node
      };
    });

    // Get building data from CSV for performance metrics
    const buildingData = data || {};

    // Create enhanced node data with performance metrics
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
      } else {
        // For non-building nodes (borefields, pump)
        return {
          ...node,
          temperature: node.type === 'borefield' ? 54 : 59, // Default temps in F
          load: node.type === 'borefield' ? 5000 : 1000,
          geoEfficiency: node.type === 'borefield' ? 5.0 : 0,
          airEfficiency: 0,
          energySavings: 0,
          efficiencyGain: 0
        };
      }
    });

    // Color scales
    const getNodeColor = (node) => {
      switch (node.type) {
        case 'borefield': return '#22c55e'; // Green
        case 'pump': return '#eab308'; // Yellow
        case 'building':
          // Get the building data to check load
          if (buildingData[node.id] && buildingData[node.id].load !== undefined) {
            return buildingData[node.id].load < 0 ? '#ef4444' : '#3b82f6'; // Red for heating (negative), Blue for cooling (positive)
          }
          return '#6b7280'; // Gray if no data
        default: return '#6b7280'; // Gray
      }
    };

    const getNodeSize = (node) => {
      switch (node.type) {
        case 'borefield': return 25;
        case 'pump': return 20;
        case 'building': return Math.max(8, Math.min(20, (node.load / 1000) * 2));
        default: return 15;
      }
    };

    // Draw connections between adjacent nodes
    const connections = [];
    for (let i = 0; i < enhancedNodes.length; i++) {
      const current = enhancedNodes[i];
      const next = enhancedNodes[(i + 1) % enhancedNodes.length];
      connections.push({ source: current, target: next });
    }

    // Draw flow arrows
    g.selectAll('.flow-line')
      .data(connections)
      .join('path')
      .attr('class', 'flow-line')
      .attr('d', d => {
        const dx = d.target.x - d.source.x;
        const dy = d.target.y - d.source.y;
        const dr = Math.sqrt(dx * dx + dy * dy);
        
        // Create curved paths for better flow visualization
        const sweep = 0; // 0 for clockwise, 1 for counter-clockwise
        return `M${d.source.x},${d.source.y}A${dr},${dr} 0 0,${sweep} ${d.target.x},${d.target.y}`;
      })
      .attr('stroke', '#6b7280')
      .attr('stroke-width', 3)
      .attr('fill', 'none')
      .attr('opacity', 0.6)
      .attr('marker-end', 'url(#arrowhead)');

    // Add arrowhead marker
    svg.append('defs').append('marker')
      .attr('id', 'arrowhead')
      .attr('viewBox', '0 -5 10 10')
      .attr('refX', 8)
      .attr('refY', 0)
      .attr('markerWidth', 6)
      .attr('markerHeight', 6)
      .attr('orient', 'auto')
      .append('path')
      .attr('d', 'M0,-5L10,0L0,5')
      .attr('fill', '#6b7280');

    // Draw nodes
    const nodes = g.selectAll('.network-node')
      .data(enhancedNodes)
      .join('circle')
      .attr('class', 'network-node')
      .attr('cx', d => d.x)
      .attr('cy', d => d.y)
      .attr('r', d => getNodeSize(d))
      .attr('fill', d => getNodeColor(d))
      .attr('stroke', d => selectedNode === d.id ? '#000' : '#fff')
      .attr('stroke-width', d => selectedNode === d.id ? 3 : 2)
      .style('cursor', 'pointer')
      .style('transition', 'stroke 0.2s ease, stroke-width 0.2s ease')
      .on('click', (event, d) => {
        event.stopPropagation();
        onNodeSelect(d);
      })
      .on('mouseenter', (event, d) => {
        // Highlight the hovered node
        d3.select(event.target)
          .attr('stroke', '#333')
          .attr('stroke-width', 3);
          
        let content = `<strong>${d.name}</strong><br/>Type: ${d.type}`;
        
        if (d.type === 'building') {
          const building = buildingData[d.id];
          const loadKw = (building?.load || 0) / 1000;
          const loadType = building?.load < 0 ? 'Heating' : 'Cooling';
          
          content += `<br/>Load: ${Math.abs(loadKw).toFixed(1)} kW (${loadType})`;
          content += `<br/>Efficiency Gain: ${d.efficiencyGain?.toFixed(1) || 'N/A'}%`;
        } else if (d.type === 'borefield') {
          content += `<br/>Geothermal heat source/sink`;
          content += `<br/>Ground temperature: 55°F`;
          
          // Add borefield heat data
          if (systemData) {
            let heatValue = 0;
            if (d.id === 'borefield_1') heatValue = systemData.borefield1HeatW;
            else if (d.id === 'borefield_2') heatValue = systemData.borefield2HeatW;
            else if (d.id === 'borefield_3') heatValue = systemData.borefield3HeatW;
            
            if (heatValue) {
              const heatKw = heatValue / 1000;
              content += `<br/>Heat Supply: ${heatKw.toFixed(1)} kW`;
            }
          }
        } else if (d.type === 'pump') {
          content += `<br/>Main circulation pump`;
          content += `<br/>Circulates fluid through network`;
          
          // Add mass flow data
          if (systemData && systemData.massFlowKgs) {
            content += `<br/>Mass Flow: ${systemData.massFlowKgs.toFixed(2)} kg/s`;
          }
        }
        
        setTooltip({
          visible: true,
          x: event.pageX + 10,
          y: event.pageY - 10,
          content
        });
      })
      .on('mouseleave', (event, d) => {
        // Reset hover highlighting (but preserve selection highlighting)
        d3.select(event.target)
          .attr('stroke', selectedNode === d.id ? '#000' : '#fff')
          .attr('stroke-width', selectedNode === d.id ? 3 : 2);
          
        setTooltip({ visible: false, x: 0, y: 0, content: '' });
      });

    // Add node labels
    g.selectAll('.node-label')
      .data(enhancedNodes)
      .join('text')
      .attr('class', 'node-label')
      .attr('x', d => {
        // Position labels outside the circle
        const labelRadius = radius + 40;
        const angle = Math.atan2(d.y, d.x);
        return labelRadius * Math.cos(angle);
      })
      .attr('y', d => {
        const labelRadius = radius + 40;
        const angle = Math.atan2(d.y, d.x);
        return labelRadius * Math.sin(angle);
      })
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'middle')
      .attr('font-size', '10px')
      .attr('font-weight', d => d.type !== 'building' ? 'bold' : 'normal')
      .attr('fill', '#374151')
      .text(d => d.shortName)
      .each(function(d) {
        // Handle multi-line labels
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

    // Add physical meter indicators for specific buildings
    const physicalMeterBuildings = ['b_1', 'b_3', 'b_4', 'b_15', 'b_16', 'b_36']; // Fire Dept, Corner Cabinet, Public School, R10, R11, R31
    
    g.selectAll('.meter-indicator')
      .data(enhancedNodes.filter(d => physicalMeterBuildings.includes(d.id)))
      .join('text')
      .attr('class', 'meter-indicator')
      .attr('x', d => d.x)
      .attr('y', d => d.y + 3)
      .attr('text-anchor', 'middle')
      .attr('font-size', '10px')
      .attr('font-weight', 'bold')
      .attr('fill', '#ffffff')
      .text('P');

    // Add legend
    const legend = svg.append('g')
      .attr('transform', `translate(30, 30)`);

    legend.append('text')
      .attr('x', 0)
      .attr('y', 0)
      .attr('font-size', '18px')
      .attr('font-weight', 'bold')
      .text(`Thermal Network - Hour ${currentHour || 1}`);

    const legendItems = [
      { color: '#22c55e', label: 'Borefield (Geothermal)', size: 25 },
      { color: '#eab308', label: 'Main Pump', size: 20 },
      { color: '#ef4444', label: 'Building (Heating)', size: 15 },
      { color: '#3b82f6', label: 'Building (Cooling)', size: 15 }
    ];

    legendItems.forEach((item, i) => {
      const y = 25 + i * 25;
      
      legend.append('circle')
        .attr('cx', 10)
        .attr('cy', y)
        .attr('r', 8)
        .attr('fill', item.color);
      
      legend.append('text')
        .attr('x', 25)
        .attr('y', y + 4)
        .attr('font-size', '12px')
        .attr('fill', '#374151')
        .text(item.label);
    });

  }, [data, systemData, selectedNode, onNodeSelect, currentHour]);

  return (
    <div className="relative">
      <svg ref={svgRef} className="border border-gray-300 rounded-lg bg-white shadow-lg"></svg>
      {tooltip.visible && (
        <div
          className="tooltip"
          style={{
            left: tooltip.x,
            top: tooltip.y,
            position: 'fixed',
            background: 'rgba(0, 0, 0, 0.9)',
            color: 'white',
            padding: '8px 12px',
            borderRadius: '4px',
            fontSize: '12px',
            pointerEvents: 'none',
            zIndex: 1000,
            maxWidth: '200px'
          }}
          dangerouslySetInnerHTML={{ __html: tooltip.content }}
        />
      )}
    </div>
  );
};

export default NetworkVisualization;