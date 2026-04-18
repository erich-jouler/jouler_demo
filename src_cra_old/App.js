import React, { useState, useEffect, useRef } from 'react';
import { ThermalNetworkDataProcessor } from './utils/dataProcessor';
import NetworkVisualization from './components/NetworkVisualization';
import EfficiencyDashboard from './components/EfficiencyDashboard';
import AssetValuation from './components/AssetValuation';
import LandingPage from './components/LandingPage';
import About from './components/About';
import * as d3 from 'd3';
import jsPDF from 'jspdf';
import './App.css';

function App() {
  const [currentPage, setCurrentPage] = useState('landing'); // 'landing', 'about', 'demo'
  const [dataProcessor] = useState(new ThermalNetworkDataProcessor());
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentHour, setCurrentHour] = useState(1);
  const [selectedNode, setSelectedNode] = useState(null);
  const [selectedAsset, setSelectedAsset] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [currentData, setCurrentData] = useState(null);
  const [timeSeriesData, setTimeSeriesData] = useState([]);
  const [networkData, setNetworkData] = useState([]);
  const [assetData, setAssetData] = useState([]);

  useEffect(() => {
    const loadData = async () => {
      try {
        setIsLoading(true);
        await dataProcessor.loadData();
        updateDisplayData();
        setIsLoading(false);
      } catch (err) {
        setError(err.message);
        setIsLoading(false);
      }
    };

    loadData();
  }, [dataProcessor]);

  useEffect(() => {
    if (!isLoading && dataProcessor.processedData) {
      updateDisplayData();
    }
  }, [currentHour, isLoading, dataProcessor]);

  const updateDisplayData = () => {
    dataProcessor.setCurrentHour(currentHour);
    const hourData = dataProcessor.getCurrentHourData();
    const timeSeries = dataProcessor.getTimeSeriesData();
    const network = dataProcessor.getBuildingNetworkData();
    const assets = dataProcessor.getAssetValuation();

    setCurrentData(hourData);
    setTimeSeriesData(timeSeries);
    setNetworkData(network);
    setAssetData(assets);
  };

  const calculateBorefieldMetrics = (borefieldId) => {
    if (!currentData?.buildings) return null;

    // Define which buildings are served by each borefield
    const buildingsByBorefield = {
      'borefield_1': ['b_1', 'b_2', 'b_3'], // Fire Dept, Gulf, Corner Cabinet
      'borefield_2': ['b_4', 'b_5'].concat(Array.from({length: 10}, (_, i) => `b_${i + 6}`)), // Public School, Housing Dept, R1-R10 (buildings 4,5,6-15)
      'borefield_3': Array.from({length: 21}, (_, i) => `b_${i + 16}`) // R11-R31 (buildings 16-36)
    };

    const buildingsBeforeBorefield = buildingsByBorefield[borefieldId] || [];
    
    // Calculate current load (sum of building loads with proper sign convention: heating negative, cooling positive)
    const currentLoadW = buildingsBeforeBorefield.reduce((sum, buildingId) => {
      const building = currentData.buildings[buildingId];
      return sum + (building?.load || 0);
    }, 0);
    
    const currentLoadKW = currentLoadW / 1000;
    const capacityKW = 440; // Rated capacity of each borefield
    const capacityPercent = (Math.abs(currentLoadKW) / capacityKW) * 100;

    return {
      currentLoadKW: currentLoadKW,
      capacityPercent: capacityPercent,
      buildingsCount: buildingsBeforeBorefield.length
    };
  };

  const handleNodeSelect = (node) => {
    setSelectedNode(node.id);
    // Set selected asset but don't auto-switch tabs
    if (node.type === 'building') {
      setSelectedAsset(node.id);
    }
  };

  const handleAssetSelect = (asset) => {
    setSelectedAsset(asset.id);
    setSelectedNode(asset.id);
  };

  const handleHourChange = (hour) => {
    setCurrentHour(parseInt(hour));
  };

  const handleEnterDemo = () => {
    setCurrentPage('demo');
  };

  const handleShowAbout = () => {
    setCurrentPage('about');
  };

  const handleBackToLanding = () => {
    setCurrentPage('landing');
  };

  // Helper functions for Performance Validation calculations
  const calculateAnnualSavings = () => {
    if (!timeSeriesData || timeSeriesData.length === 0) return { savings: 0, economicValue: 0 };
    
    const totalSavings = timeSeriesData.reduce((sum, hour) => sum + (hour.savings || 0), 0);
    const economicValue = totalSavings * 0.15; // $0.15 per kWh saved
    
    return { 
      savings: totalSavings / 1000, // Convert to kWh
      economicValue: economicValue / 1000 // Convert to dollars
    };
  };

  // Calculate borefield-specific energy savings
  const calculateBorefieldSavings = (borefieldId) => {
    if (!dataProcessor.processedData || dataProcessor.processedData.length === 0) {
      return { 
        energySavings: 0, 
        economicValue: 0, 
        demandSavings: 0, 
        capacityValue: 0,
        buildingsServed: 0,
        efficiencyGain: 0
      };
    }

    // Define which buildings are served by each borefield
    const buildingsByBorefield = {
      'borefield_1': ['b_1', 'b_2', 'b_3'], // Fire Dept, Gulf, Corner Cabinet
      'borefield_2': ['b_4', 'b_5'].concat(Array.from({length: 10}, (_, i) => `b_${i + 6}`)), // Public School, Housing Dept, R1-R10 (buildings 4,5,6-15)
      'borefield_3': Array.from({length: 21}, (_, i) => `b_${i + 16}`) // R11-R31 (buildings 16-36)
    };

    const buildingsInBorefield = buildingsByBorefield[borefieldId] || [];
    
    // Calculate total energy savings and monthly demand pattern for this borefield's buildings
    let totalSavings = 0;
    let annualMaxGeoLoad = 0;
    let annualMaxAirLoad = 0;
    const hoursPerMonth = 730; // Approximate hours per month
    let totalMonthlyDemandDifference = 0;

    // Calculate annual energy savings (all hours)
    dataProcessor.processedData.forEach(hourData => {
      let hourlyGeoElectric = 0;
      let hourlyAirElectric = 0;

      // Sum electric consumption for buildings served by this borefield
      buildingsInBorefield.forEach(buildingId => {
        if (hourData.buildings && hourData.buildings[buildingId]) {
          const building = hourData.buildings[buildingId];
          hourlyGeoElectric += building.geo?.electric || 0;
          hourlyAirElectric += building.air?.electric || 0;
        }
      });

      // Track hourly savings
      const hourlySavings = hourlyAirElectric - hourlyGeoElectric;
      totalSavings += hourlySavings;

      // Track annual peak loads for capacity calculations
      annualMaxGeoLoad = Math.max(annualMaxGeoLoad, hourlyGeoElectric);
      annualMaxAirLoad = Math.max(annualMaxAirLoad, hourlyAirElectric);
    });

    // Calculate monthly demand differences (following the same pattern as calculateMonthlyDemand)
    for (let month = 0; month < 12; month++) {
      const startHour = month * hoursPerMonth;
      const endHour = Math.min((month + 1) * hoursPerMonth, dataProcessor.processedData.length);
      const monthData = dataProcessor.processedData.slice(startHour, endHour);
      
      if (monthData.length > 0) {
        let monthlyMaxGeo = 0;
        let monthlyMaxAir = 0;

        monthData.forEach(hourData => {
          let hourlyGeoElectric = 0;
          let hourlyAirElectric = 0;

          // Sum electric consumption for buildings served by this borefield
          buildingsInBorefield.forEach(buildingId => {
            if (hourData.buildings && hourData.buildings[buildingId]) {
              const building = hourData.buildings[buildingId];
              hourlyGeoElectric += building.geo?.electric || 0;
              hourlyAirElectric += building.air?.electric || 0;
            }
          });

          monthlyMaxGeo = Math.max(monthlyMaxGeo, hourlyGeoElectric);
          monthlyMaxAir = Math.max(monthlyMaxAir, hourlyAirElectric);
        });

        const monthlyDemandDifference = (monthlyMaxAir - monthlyMaxGeo) / 1000; // Convert W to kW
        totalMonthlyDemandDifference += monthlyDemandDifference;
      }
    }

    const energySavings = totalSavings / 1000; // Convert Wh to kWh (totalSavings is already in Wh)
    const energyEconomicValue = energySavings * 0.15; // $0.15 per kWh for energy savings
    const demandSavings = totalMonthlyDemandDifference; // Sum of monthly peak differences (already in kW)
    const demandEconomicValue = demandSavings * 15; // $15 per kW for demand savings 
    const capacitySavings = (annualMaxAirLoad - annualMaxGeoLoad) / 1000; // Annual peak difference in kW
    const capacityEconomicValue = capacitySavings * 200; // $200 per kW for capacity value
    const efficiencyGain = annualMaxAirLoad > 0 ? ((annualMaxAirLoad - annualMaxGeoLoad) / annualMaxAirLoad) * 100 : 0;

    return {
      energySavings: Math.max(0, energySavings),
      energyEconomicValue: Math.max(0, energyEconomicValue),
      demandSavings: Math.max(0, demandSavings), 
      demandEconomicValue: Math.max(0, demandEconomicValue),
      capacitySavings: Math.max(0, capacitySavings),
      capacityEconomicValue: Math.max(0, capacityEconomicValue),
      totalEconomicValue: Math.max(0, energyEconomicValue + demandEconomicValue + capacityEconomicValue),
      buildingsServed: buildingsInBorefield.length,
      efficiencyGain: Math.max(0, efficiencyGain)
    };
  };

  const calculateMonthlyDemand = () => {
    if (!timeSeriesData || timeSeriesData.length === 0) return { monthlyData: [], economicValue: 0 };
    
    const monthlyData = [];
    const hoursPerMonth = 730; // Approximate hours per month
    
    for (let month = 0; month < 12; month++) {
      const startHour = month * hoursPerMonth;
      const endHour = Math.min((month + 1) * hoursPerMonth, timeSeriesData.length);
      const monthData = timeSeriesData.slice(startHour, endHour);
      
      if (monthData.length > 0) {
        const maxGeoLoad = Math.max(...monthData.map(h => h.geoTotal || 0));
        const maxAirLoad = Math.max(...monthData.map(h => h.airTotal || 0));
        
        monthlyData.push({
          month: month + 1,
          geoMax: maxGeoLoad / 1000, // Convert to kW
          airMax: maxAirLoad / 1000,
          difference: (maxAirLoad - maxGeoLoad) / 1000
        });
      }
    }
    
    const totalDifference = monthlyData.reduce((sum, month) => sum + month.difference, 0);
    const economicValue = totalDifference * 15; // $15 per kW difference
    
    return { monthlyData, economicValue };
  };

  const calculateCapacityComparison = () => {
    if (!timeSeriesData || timeSeriesData.length === 0) return { geoMax: 0, airMax: 0, geoHour: 0, airHour: 0, economicValue: 0 };
    
    let maxGeoLoad = 0;
    let maxAirLoad = 0;
    let maxGeoHour = 0;
    let maxAirHour = 0;
    
    timeSeriesData.forEach((hour, index) => {
      if ((hour.geoTotal || 0) > maxGeoLoad) {
        maxGeoLoad = hour.geoTotal;
        maxGeoHour = index + 1;
      }
      if ((hour.airTotal || 0) > maxAirLoad) {
        maxAirLoad = hour.airTotal;
        maxAirHour = index + 1;
      }
    });
    
    const capacityDifference = (maxAirLoad - maxGeoLoad) / 1000; // Convert to kW
    const economicValue = capacityDifference * 200; // $200 per kW difference
    
    return {
      geoMax: maxGeoLoad / 1000,
      airMax: maxAirLoad / 1000,
      geoHour: maxGeoHour,
      airHour: maxAirHour,
      economicValue
    };
  };

  // PDF Generation Functions
  const generateEmissionsReport = () => {
    const reportData = {
      title: "Monthly Carbon Impact Report",
      period: "November 2024",
      reportType: "emissions",
      metrics: {
        executiveSummary: "The Framingham Thermal Energy Network avoided 21.4 tons of CO₂ emissions in November 2024 compared to individual air-source heat pump systems, representing an 87% reduction in carbon intensity.",
        totalEmissions: "3.2 tons",
        ashpBaseline: "24.6 tons",
        reduction: "21.4 tons (87%)",
        carbonIntensity: "22 kg/MWh",
        renewableContent: "45% grid renewable",
        totalCO2Avoided: "187 tons CO₂ (2024 YTD)",
        equivalentTo: "41 passenger vehicles removed from roads for one year"
      }
    };
    generateAdvancedPDF(reportData);
  };

  const generateEnergyReport = () => {
    const reportData = {
      title: "Monthly Energy Performance Report",
      period: "November 2024",
      reportType: "energy",
      metrics: {
        executiveSummary: "The Framingham Thermal Energy Network delivered 145,230 kWh of thermal energy in November 2024, achieving 38% energy savings compared to individual air-source heat pump systems through superior efficiency and geothermal technology.",
        thermalDelivered: "145,230 kWh",
        electricalInput: "34,579 kWh",
        ashpElectrical: "55,692 kWh",
        energySavings: "21,113 kWh (38%)",
        averageCOP: "4.2",
        peakCOP: "5.1",
        minimumCOP: "3.4",
        peakDemand: "285 kW",
        loadFactor: "71%",
        systemUptime: "99.4%"
      }
    };
    generateAdvancedPDF(reportData);
  };

  const generateEconomicReport = () => {
    const reportData = {
      title: "Quarterly Economic Performance Report",
      period: "Q4 2024 (October - December)",
      reportType: "economic",
      metrics: {
        executiveSummary: "The Framingham Thermal Energy Network delivered $28,450 in cost savings during Q4 2024 compared to individual air-source heat pump systems, driven by superior energy efficiency and reduced peak demand charges.",
        energySavings: "$9,886 (38%)",
        demandSavings: "$1,968 (38%)",
        omSavings: "$16,596 (85%)",
        totalSavings: "$28,450 (56%)",
        incentiveEarned: "$12,320",
        ytdSavings: "$113,800",
        avgBuildingSavings: "$3,286"
      }
    };
    generateAdvancedPDF(reportData);
  };

  const generatePerformanceReport = () => {
    const reportData = {
      title: "Annual Performance Report",
      period: "Calendar Year 2024",
      reportType: "performance",
      metrics: {
        executiveSummary: "The Framingham Thermal Energy Network successfully completed its first full year of operation in 2024, delivering 1,847 MWh of thermal energy to 35 buildings while achieving 38% energy savings, 56% cost reduction, and 87% carbon emissions reduction compared to individual air-source heat pump systems.",
        thermalDelivered: "1,847 MWh",
        systemCOP: "4.2 avg COP",
        energySavings: "268 MWh (38%)",
        systemUptime: "99.1%",
        carbonAvoided: "187 tons CO₂",
        emissionsReduction: "87%",
        buildingsServed: "35",
        peakLoad: "337 kW",
        totalCostSavings: "$113,800",
        incentivesEarned: "$49,280"
      }
    };
    generateAdvancedPDF(reportData);
  };

  const generateAdvancedPDF = (data) => {
    const doc = new jsPDF();
    
    // Set up document properties
    const pageWidth = doc.internal.pageSize.width;
    const pageHeight = doc.internal.pageSize.height;
    const margin = 20;
    const contentWidth = pageWidth - 2 * margin;
    let yPosition = 30;
    let pageCount = 1;

    // Helper functions for advanced PDF generation
    const addNewPage = () => {
      doc.addPage();
      pageCount++;
      yPosition = 30;
    };

    const checkPageSpace = (requiredSpace = 40) => {
      if (yPosition + requiredSpace > pageHeight - 40) {
        addNewPage();
      }
    };

    const addText = (text, fontSize = 10, fontStyle = 'normal', align = 'left') => {
      checkPageSpace();
      doc.setFontSize(fontSize);
      doc.setFont('helvetica', fontStyle);
      
      if (fontSize > 12 && align === 'center') {
        const textWidth = doc.getStringUnitWidth(text) * fontSize / doc.internal.scaleFactor;
        const xPosition = (pageWidth - textWidth) / 2;
        doc.text(text, xPosition, yPosition);
        yPosition += fontSize * 0.5;
      } else {
        const lines = doc.splitTextToSize(text, contentWidth);
        doc.text(lines, margin, yPosition);
        yPosition += lines.length * fontSize * 0.4;
      }
      yPosition += 5;
    };

    const addSeparator = () => {
      checkPageSpace(15);
      doc.setDrawColor(200, 200, 200);
      doc.setLineWidth(0.5);
      doc.line(margin, yPosition, pageWidth - margin, yPosition);
      yPosition += 15;
    };

    const addTable = (headers, rows) => {
      checkPageSpace(60);
      const colWidth = contentWidth / headers.length;
      const rowHeight = 20;
      
      // Draw headers
      doc.setFillColor(240, 240, 240);
      doc.rect(margin, yPosition, contentWidth, rowHeight, 'F');
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      
      headers.forEach((header, i) => {
        doc.text(header, margin + (i * colWidth) + 5, yPosition + 12);
      });
      
      yPosition += rowHeight;
      
      // Draw rows
      doc.setFont('helvetica', 'normal');
      rows.forEach((row, rowIndex) => {
        if (rowIndex % 2 === 0) {
          doc.setFillColor(250, 250, 250);
          doc.rect(margin, yPosition, contentWidth, rowHeight, 'F');
        }
        
        row.forEach((cell, i) => {
          doc.text(String(cell), margin + (i * colWidth) + 5, yPosition + 12);
        });
        
        yPosition += rowHeight;
      });
      
      yPosition += 10;
    };

    const addMetricBox = (label, value, color = [59, 130, 246]) => {
      checkPageSpace(50);
      const boxWidth = contentWidth / 2 - 10;
      const boxHeight = 40;
      
      // Draw colored border
      doc.setDrawColor(...color);
      doc.setLineWidth(2);
      doc.rect(margin, yPosition, boxWidth, boxHeight);
      
      // Add label
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100, 100, 100);
      doc.text(label, margin + 5, yPosition + 15);
      
      // Add value
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(0, 0, 0);
      doc.text(value, margin + 5, yPosition + 30);
      
      // Reset color
      doc.setTextColor(0, 0, 0);
    };

    // Add enhanced header with logo area
    doc.setFillColor(41, 128, 185);
    doc.rect(0, 0, pageWidth, 25, 'F');
    
    doc.setTextColor(255, 255, 255);
    addText('FRAMINGHAM THERMAL NETWORK', 16, 'bold', 'center');
    
    doc.setTextColor(0, 0, 0);
    yPosition = 40;
    addText(data.title, 18, 'bold', 'center');
    addText(`Reporting Period: ${data.period}`, 14, 'normal', 'center');
    
    addSeparator();
    
    // Executive Summary
    addText('EXECUTIVE SUMMARY', 14, 'bold');
    
    const executiveSummary = data.metrics.executiveSummary || 'This report provides comprehensive measurement and verification analysis.';
    const summaryLines = doc.splitTextToSize(executiveSummary, contentWidth);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(summaryLines, margin, yPosition);
    yPosition += summaryLines.length * 4 + 10;
    
    addSeparator();

    // Report-specific content based on type
    if (data.reportType === 'emissions') {
      // Carbon Performance Summary
      addText('CARBON PERFORMANCE SUMMARY', 14, 'bold');
      
      const carbonTable = [
        ['Metric', 'TEN', 'ASHP Baseline', 'Reduction'],
        ['Total Emissions', data.metrics.totalEmissions, data.metrics.ashpBaseline, data.metrics.reduction],
        ['Carbon Intensity', data.metrics.carbonIntensity, '169 kg/MWh', '147 kg/MWh'],
        ['Grid Renewable', data.metrics.renewableContent, data.metrics.renewableContent, '-']
      ];
      
      addTable(carbonTable[0], carbonTable.slice(1));
      
      addText('CUMULATIVE IMPACT (2024 YTD)', 14, 'bold');
      addText(`Total Carbon Avoided: ${data.metrics.totalCO2Avoided}`);
      addText(`Equivalent To: ${data.metrics.equivalentTo}`);
      
    } else if (data.reportType === 'energy') {
      // Energy Consumption Comparison
      addText('ENERGY CONSUMPTION COMPARISON', 14, 'bold');
      
      const energyTable = [
        ['Metric', 'TEN', 'ASHP Baseline', 'Savings'],
        ['Electrical Input', data.metrics.electricalInput, data.metrics.ashpElectrical, data.metrics.energySavings],
        ['Thermal Output', data.metrics.thermalDelivered, data.metrics.thermalDelivered, '-'],
        ['Average COP', data.metrics.averageCOP, '2.6', '-'],
        ['Cost @ $0.15/kWh', '$5,187', '$8,354', '$3,167']
      ];
      
      addTable(energyTable[0], energyTable.slice(1));
      
      addText('SYSTEM PERFORMANCE METRICS', 14, 'bold');
      addText(`Peak COP: ${data.metrics.peakCOP}`);
      addText(`Minimum COP: ${data.metrics.minimumCOP}`);
      addText(`Peak Demand: ${data.metrics.peakDemand}`);
      addText(`Load Factor: ${data.metrics.loadFactor}`);
      addText(`System Uptime: ${data.metrics.systemUptime}`);
      
    } else if (data.reportType === 'economic') {
      // Cost Savings Summary
      addText('COST SAVINGS SUMMARY', 14, 'bold');
      
      const economicTable = [
        ['Cost Category', 'TEN Cost', 'ASHP Cost', 'Savings'],
        ['Energy Charges', '$16,248', '$26,134', data.metrics.energySavings],
        ['Demand Charges', '$3,264', '$5,232', data.metrics.demandSavings],
        ['Operations & Maint.', '$2,840', '$19,436', data.metrics.omSavings],
        ['Total Operating Cost', '$22,352', '$50,802', data.metrics.totalSavings]
      ];
      
      addTable(economicTable[0], economicTable.slice(1));
      
      addText('YEAR-TO-DATE FINANCIAL PERFORMANCE', 14, 'bold');
      addText(`Total Cost Avoidance: ${data.metrics.ytdSavings}`);
      addText(`Average Building Savings: ${data.metrics.avgBuildingSavings}`);
      addText(`Incentives Earned: ${data.metrics.incentiveEarned}`);
      
    } else if (data.reportType === 'performance') {
      // Annual Impact Summary
      addText('ANNUAL IMPACT SUMMARY', 14, 'bold');
      
      const performanceTable = [
        ['Category', 'Performance', 'Economic Performance'],
        ['Thermal Delivered', data.metrics.thermalDelivered, `Total Cost Savings: ${data.metrics.totalCostSavings}`],
        ['System Efficiency', data.metrics.systemCOP, `Incentives Earned: ${data.metrics.incentivesEarned}`],
        ['Energy Savings', data.metrics.energySavings, ''],
        ['System Uptime', data.metrics.systemUptime, '']
      ];
      
      addTable(performanceTable[0], performanceTable.slice(1));
      
      addText('ENVIRONMENTAL PERFORMANCE', 14, 'bold');
      addText(`Carbon Avoided: ${data.metrics.carbonAvoided}`);
      addText(`Emissions Reduction: ${data.metrics.emissionsReduction}`);
      
      addText('OPERATIONAL PERFORMANCE', 14, 'bold');
      addText(`Buildings Served: ${data.metrics.buildingsServed}`);
      addText(`Peak Load Served: ${data.metrics.peakLoad}`);
    }

    addSeparator();

    // Methodology & Measurement
    addText('METHODOLOGY & MEASUREMENT', 14, 'bold');
    addText('M&V Approach: IPMVP Option D (Calibrated Simulation)');
    
    addText('Measurement Infrastructure:', 12, 'bold');
    addText('• Physical Metering: 15 sensors (distribution, borefield, electrical)');
    addText('• Virtual Metering: 24 building-level thermal points');
    addText('• Measurement Coverage: 98.4%');
    
    addText('Model Calibration:', 12, 'bold');
    addText('• CVRMSE: 26% (Hourly data - meets ASHRAE Guideline 14)');
    addText('• NMBE: 9% (Hourly data - meets ASHRAE Guideline 14)');
    addText('• ✓ ASHRAE Guideline 14 Compliant');
    
    addText('Baseline Assumptions:', 12, 'bold');
    addText('• ASHP System: HSPF 9, SEER 15 (standard efficiency)');
    addText('• GSHP Model: WaterFurnace 5 Series 500A11');
    addText('• Weather-adjusted performance based on outdoor temperature');
    addText('• Grid emissions: ISO-NE hourly marginal emissions data');
    
    addSeparator();
    
    addText('SYSTEM OVERVIEW', 14, 'bold');
    addText('Network Configuration:');
    addText('• Total Heating Capacity: 440 kW');
    addText('• Buildings Served: 35');
    addText('• Distribution Efficiency: 96.1%');
    addText('• Borefield Configuration: 3 geothermal heat exchangers');
    
    addSeparator();
    
    addText('KEY INSIGHTS & CONCLUSIONS', 14, 'bold');
    addText('The Framingham Thermal Energy Network demonstrates superior performance across all metrics:');
    addText('• Energy efficiency gains through geothermal technology');
    addText('• Significant cost reductions via centralized O&M');
    addText('• Substantial carbon emissions reduction');
    addText('• High system reliability (>99% uptime)');
    addText('• Validated measurement and verification protocols');

    // Footer on each page
    const addFooter = (pageNum) => {
      const footerY = pageHeight - 25;
      doc.setFontSize(8);
      doc.setFont('helvetica', 'italic');
      doc.setTextColor(128, 128, 128);
      
      // Left side - generation info
      doc.text(`Report Generated: ${new Date().toLocaleDateString()}`, margin, footerY);
      doc.text('Generated by: Jouler | Thermal Network Intelligence Platform', margin, footerY + 8);
      
      // Right side - page number and certification
      doc.text(`Page ${pageNum}`, pageWidth - margin - 30, footerY);
      const certText = doc.splitTextToSize('Certification: IPMVP Option D Compliant | ASHRAE Guideline 14 Verified', contentWidth);
      doc.text(certText, margin, footerY + 16);
      
      doc.setTextColor(0, 0, 0);
    };
    
    // Add footer to all pages
    for (let i = 1; i <= pageCount; i++) {
      if (i > 1) doc.setPage(i);
      addFooter(i);
    }

    // Save the PDF
    const filename = `${data.title.replace(/\s+/g, '_')}_${data.period.replace(/\s+/g, '_')}.pdf`;
    doc.save(filename);

    // Show confirmation
    alert(`${data.title} generated successfully as PDF!`);
  };

  // Energy Consumption Line Chart Component
  const EnergyConsumptionChart = ({ data }) => {
    const svgRef = useRef();

    useEffect(() => {
      if (!data || data.length === 0) return;

      const svg = d3.select(svgRef.current);
      svg.selectAll('*').remove();

      const margin = { top: 30, right: 100, bottom: 60, left: 100 };
      const width = 1000 - margin.left - margin.right;
      const height = 400 - margin.top - margin.bottom;

      const g = svg.append('g')
        .attr('transform', `translate(${margin.left},${margin.top})`);

      // Process hourly consumption data for stacked area chart
      const processedData = data.map((d, i) => {
        const geoTotal = (d.geoTotal || 0) / 1000; // Convert to kW
        const airTotal = (d.airTotal || 0) / 1000;
        const excessAir = Math.max(0, airTotal - geoTotal); // Excess ASHP energy over TEN
        return {
          hour: i + 1,
          geoTotal,
          airTotal,
          excessAir,
          savings: airTotal - geoTotal
        };
      });

      // Scales
      const xScale = d3.scaleLinear()
        .domain([1, data.length])
        .range([0, width]);

      const yScale = d3.scaleLinear()
        .domain([0, d3.max(processedData, d => d.airTotal)])
        .range([height, 0]);

      // Area generators for stacked chart
      const tenArea = d3.area()
        .x(d => xScale(d.hour))
        .y0(height) // Bottom of chart
        .y1(d => yScale(d.geoTotal))
        .curve(d3.curveMonotoneX);

      const excessArea = d3.area()
        .x(d => xScale(d.hour))
        .y0(d => yScale(d.geoTotal)) // Top of TEN area
        .y1(d => yScale(d.airTotal)) // Top of total ASHP
        .curve(d3.curveMonotoneX);

      // Add axes
      g.append('g')
        .attr('transform', `translate(0,${height})`)
        .call(d3.axisBottom(xScale).tickFormat(d => d));

      g.append('g')
        .call(d3.axisLeft(yScale).tickFormat(d => `${d.toLocaleString()} kW`));

      // Add stacked areas
      // TEN area (bottom layer - green)
      g.append('path')
        .datum(processedData)
        .attr('fill', '#22c55e')
        .attr('fill-opacity', 0.8)
        .attr('stroke', '#16a34a')
        .attr('stroke-width', 1)
        .attr('d', tenArea);

      // Excess ASHP area (top layer - red)
      g.append('path')
        .datum(processedData)
        .attr('fill', '#ef4444')
        .attr('fill-opacity', 0.7)
        .attr('stroke', '#dc2626')
        .attr('stroke-width', 1)
        .attr('d', excessArea);

      // Add legend
      const legend = g.append('g')
        .attr('transform', `translate(${width - 120}, 20)`);

      legend.append('rect')
        .attr('x', 0).attr('y', 0)
        .attr('width', 15).attr('height', 15)
        .attr('fill', '#22c55e')
        .attr('fill-opacity', 0.8);
      
      legend.append('text')
        .attr('x', 20).attr('y', 12)
        .text('TEN Consumption')
        .style('font-size', '12px');

      legend.append('rect')
        .attr('x', 0).attr('y', 20)
        .attr('width', 15).attr('height', 15)
        .attr('fill', '#ef4444')
        .attr('fill-opacity', 0.7);
      
      legend.append('text')
        .attr('x', 20).attr('y', 32)
        .text('ASHP Excess')
        .style('font-size', '12px');

      // Add axis labels
      g.append('text')
        .attr('transform', 'rotate(-90)')
        .attr('y', 0 - margin.left)
        .attr('x', 0 - (height / 2))
        .attr('dy', '1em')
        .style('text-anchor', 'middle')
        .style('font-size', '12px')
        .text('Energy Consumption (kWh)');

      g.append('text')
        .attr('transform', `translate(${width / 2}, ${height + margin.bottom})`)
        .style('text-anchor', 'middle')
        .style('font-size', '12px')
        .text('Hour of Year');

    }, [data]);

    return <svg ref={svgRef} width={1000} height={460} className="mx-auto"></svg>;
  };

  // Monthly Demand Bar Chart Component
  const MonthlyDemandChart = ({ monthlyData }) => {
    const svgRef = useRef();

    useEffect(() => {
      if (!monthlyData || monthlyData.length === 0) return;

      const svg = d3.select(svgRef.current);
      svg.selectAll('*').remove();

      const margin = { top: 30, right: 100, bottom: 60, left: 100 };
      const width = 1000 - margin.left - margin.right;
      const height = 350 - margin.top - margin.bottom;

      const g = svg.append('g')
        .attr('transform', `translate(${margin.left},${margin.top})`);

      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

      // Scales
      const xScale = d3.scaleBand()
        .domain(monthlyData.map(d => monthNames[d.month - 1]))
        .range([0, width])
        .padding(0.2);

      const yScale = d3.scaleLinear()
        .domain([0, d3.max(monthlyData, d => Math.max(d.geoMax, d.airMax))])
        .range([height, 0]);

      // Add axes
      g.append('g')
        .attr('transform', `translate(0,${height})`)
        .call(d3.axisBottom(xScale));

      g.append('g')
        .call(d3.axisLeft(yScale).tickFormat(d => `${d.toFixed(0)} kW`));

      // Add bars
      const barWidth = xScale.bandwidth() / 2;

      // TEN bars
      g.selectAll('.geo-bar')
        .data(monthlyData)
        .enter().append('rect')
        .attr('class', 'geo-bar')
        .attr('x', d => xScale(monthNames[d.month - 1]))
        .attr('y', d => yScale(d.geoMax))
        .attr('width', barWidth)
        .attr('height', d => height - yScale(d.geoMax))
        .attr('fill', '#22c55e');

      // ASHP bars
      g.selectAll('.air-bar')
        .data(monthlyData)
        .enter().append('rect')
        .attr('class', 'air-bar')
        .attr('x', d => xScale(monthNames[d.month - 1]) + barWidth)
        .attr('y', d => yScale(d.airMax))
        .attr('width', barWidth)
        .attr('height', d => height - yScale(d.airMax))
        .attr('fill', '#ef4444');

      // Add legend
      const legend = g.append('g')
        .attr('transform', `translate(${width - 100}, 20)`);

      legend.append('rect')
        .attr('x', 0).attr('y', 0)
        .attr('width', 15).attr('height', 15)
        .attr('fill', '#22c55e');
      
      legend.append('text')
        .attr('x', 20).attr('y', 12)
        .text('TEN')
        .style('font-size', '12px');

      legend.append('rect')
        .attr('x', 0).attr('y', 20)
        .attr('width', 15).attr('height', 15)
        .attr('fill', '#ef4444');
      
      legend.append('text')
        .attr('x', 20).attr('y', 32)
        .text('ASHP')
        .style('font-size', '12px');

      // Add axis labels
      g.append('text')
        .attr('transform', 'rotate(-90)')
        .attr('y', 0 - margin.left)
        .attr('x', 0 - (height / 2))
        .attr('dy', '1em')
        .style('text-anchor', 'middle')
        .style('font-size', '12px')
        .text('Peak Monthly Demand (kW)');

      g.append('text')
        .attr('transform', `translate(${width / 2}, ${height + margin.bottom})`)
        .style('text-anchor', 'middle')
        .style('font-size', '12px')
        .text('Month');

    }, [monthlyData]);

    return <svg ref={svgRef} width={1000} height={410} className="mx-auto"></svg>;
  };

  if (currentPage === 'landing') {
    return <LandingPage onEnterDemo={handleEnterDemo} onShowAbout={handleShowAbout} />;
  }

  if (currentPage === 'about') {
    return <About onBackToLanding={handleBackToLanding} />;
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading thermal network data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-600 text-xl mb-4">⚠️ Error Loading Data</div>
          <p className="text-gray-600">{error}</p>
          <button 
            onClick={() => window.location.reload()} 
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const TabButton = ({ tabId, label, isActive, onClick }) => (
    <button
      onClick={() => onClick(tabId)}
      className={`px-6 py-3 font-medium text-sm rounded-lg transition-colors ${
        isActive 
          ? 'bg-blue-600 text-white shadow-md' 
          : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200'
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => setCurrentPage('landing')}
                className="text-green-600 hover:text-green-700 font-medium text-sm flex items-center space-x-1"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd"/>
                </svg>
                <span>Back to Home</span>
              </button>
              <div>
                <h1 className="text-3xl font-bold text-gray-900">
                  Jouler - The TEN Intelligence Platform
                </h1>
                <p className="text-gray-600 mt-1">
                  Real-Time M&V Platform for Thermal Networks
                </p>
              </div>
            </div>
            
            {/* Hour Control */}
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <label className="text-sm font-medium text-gray-700">Hour of Year:</label>
                <input
                  type="range"
                  min="1"
                  max="8760"
                  value={currentHour}
                  onChange={(e) => handleHourChange(e.target.value)}
                  className="w-32"
                />
                <span className="text-sm font-medium text-gray-900 w-12">
                  {currentHour}
                </span>
              </div>
              
              {currentData && (
                <div className="text-sm text-gray-600 bg-gray-50 px-3 py-1 rounded-md">
                  Outdoor: {currentData.outdoorTemp?.fahrenheit?.toFixed(1)}°F
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Navigation Tabs */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex space-x-4 py-4">
            <TabButton 
              tabId="overview" 
              label="Network Overview" 
              isActive={activeTab === 'overview'} 
              onClick={setActiveTab} 
            />
            <TabButton 
              tabId="efficiency" 
              label="Performance Validation" 
              isActive={activeTab === 'efficiency'} 
              onClick={setActiveTab} 
            />
            <TabButton 
              tabId="assets" 
              label="Reporting" 
              isActive={activeTab === 'assets'} 
              onClick={setActiveTab} 
            />
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'overview' && (
          <div className="space-y-8">
            {/* Key Metrics Summary */}
            {currentData && (
              <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
                <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
                  <div className="text-sm text-gray-600 uppercase tracking-wide">Total Heating Load</div>
                  <div className="text-2xl font-bold text-red-600 mt-2">
                    {((Math.abs(currentData.systemMetrics?.heatingLoad || 0)) / 1000).toFixed(0)} kW
                  </div>
                </div>
                <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
                  <div className="text-sm text-gray-600 uppercase tracking-wide">Total Cooling Load</div>
                  <div className="text-2xl font-bold text-blue-600 mt-2">
                    {((currentData.systemMetrics?.coolingLoad || 0) / 1000).toFixed(0)} kW
                  </div>
                </div>
                <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
                  <div className="text-sm text-gray-600 uppercase tracking-wide">TEN Average COP</div>
                  <div className="text-2xl font-bold text-green-600 mt-2">
                    {currentData.systemMetrics?.avgGeoCOP?.toFixed(2) || 'N/A'}
                  </div>
                </div>
                <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
                  <div className="text-sm text-gray-600 uppercase tracking-wide">ASHP COP</div>
                  <div className="text-2xl font-bold text-red-600 mt-2">
                    {currentData.systemMetrics?.avgAirCOP?.toFixed(2) || 'N/A'}
                  </div>
                </div>
                <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
                  <div className="text-sm text-gray-600 uppercase tracking-wide">Efficiency Gain</div>
                  <div className="text-2xl font-bold text-blue-600 mt-2">
                    {currentData.systemMetrics?.systemEfficiencyGain?.toFixed(1) || 'N/A'}%
                  </div>
                </div>
              </div>
            )}

            {/* Network Visualization */}
            <div>
              <NetworkVisualization
                data={currentData?.buildings}
                systemData={currentData?.systemData}
                onNodeSelect={handleNodeSelect}
                selectedNode={selectedNode}
                currentHour={currentHour}
              />
            </div>

            {/* Selected Node Details */}
            {selectedNode && (
              <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
                <h3 className="text-lg font-semibold mb-4">
                  Selected: {selectedNode.replace('_', ' ').toUpperCase()}
                </h3>
                
                {/* Building Details */}
                {currentData?.buildings?.[selectedNode] && (() => {
                  const building = currentData.buildings[selectedNode];
                  const buildingNum = selectedNode.split('_')[1];
                  const isHeating = building.load < 0;
                  const mode = isHeating ? 'Heating' : 'Cooling';
                  const geoEfficiency = building.geo.cop || 0;
                  const airEfficiency = building.air.cop || 0;
                  
                  // Determine building type and connected borefield
                  let buildingType = 'RESIDENTIAL';
                  let connectedBorefield = 'Borefield 3';
                  
                  if (selectedNode === 'b_1') { buildingType = 'FIRE DEPARTMENT'; connectedBorefield = 'Borefield 2'; }
                  else if (selectedNode === 'b_2') { buildingType = 'GULF STATION'; connectedBorefield = 'Borefield 2'; }
                  else if (selectedNode === 'b_3') { buildingType = 'CORNER CABINET'; connectedBorefield = 'Borefield 2'; }
                  else if (selectedNode === 'b_4') { buildingType = 'PUBLIC SCHOOL'; connectedBorefield = 'Borefield 3'; }
                  else if (selectedNode === 'b_5') { buildingType = 'HOUSING DEPARTMENT'; connectedBorefield = 'Borefield 3'; }
                  else if (parseInt(buildingNum) >= 16) { connectedBorefield = 'Borefield 1'; }
                  

                  return (
                    <div className="space-y-6">
                      <div className="text-center">
                        <h4 className="text-xl font-bold text-gray-900">
                          BUILDING {buildingNum.toUpperCase()} - {buildingType}
                        </h4>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        {/* Metering */}
                        <div>
                          <h5 className="text-lg font-semibold text-gray-800 mb-3">
                            Metering:
                          </h5>
                          <div className="space-y-2 ml-4">
                            <div className="flex items-start">
                              <span className="text-gray-600 mr-2">├─</span>
                              <span className="text-gray-700">
                                <strong>Inlet Temp:</strong> {building.inletTemp.fahrenheit?.toFixed(1) || 'N/A'}°F - {['b_1', 'b_3', 'b_4', 'b_15', 'b_16', 'b_36'].includes(selectedNode) ? '(physical)' : '(virtual)'}
                              </span>
                            </div>
                            <div className="flex items-start">
                              <span className="text-gray-600 mr-2">├─</span>
                              <span className="text-gray-700">
                                <strong>Indoor Setpoint:</strong> 68°F (customer choice)
                              </span>
                            </div>
                            <div className="flex items-start">
                              <span className="text-gray-600 mr-2">└─</span>
                              <span className="text-gray-700">
                                <strong>Status:</strong> {mode} mode
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Real Time Performance */}
                        <div>
                          <h5 className="text-lg font-semibold text-gray-800 mb-3">
                            Real Time Performance:
                          </h5>
                          <div className="space-y-2 ml-4">
                            <div className="flex items-start">
                              <span className="text-gray-600 mr-2">├─</span>
                              <span className="text-gray-700">
                                <strong>Load:</strong> {Math.abs(building.load / 1000).toFixed(1)} kW ({mode})
                              </span>
                            </div>
                            <div className="flex items-start">
                              <span className="text-gray-600 mr-2">├─</span>
                              <span className="text-gray-700">
                                <strong>Geo COP:</strong> {geoEfficiency.toFixed(2)}
                              </span>
                            </div>
                            <div className="flex items-start">
                              <span className="text-gray-600 mr-2">├─</span>
                              <span className="text-gray-700">
                                <strong>ASHP COP:</strong> {airEfficiency.toFixed(2)} (typical)
                              </span>
                            </div>
                            <div className="flex items-start">
                              <span className="text-gray-600 mr-2">└─</span>
                              <span className="text-gray-700">
                                <strong>Connected to:</strong> {connectedBorefield}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>

                    </div>
                  );
                })()}

                {/* Borefield Details */}
                {selectedNode.startsWith('borefield_') && (() => {
                  const metrics = calculateBorefieldMetrics(selectedNode);
                  if (!metrics) return null;
                  
                  // Get borefield heat from system data
                  let borefieldHeatKW = 0;
                  if (currentData?.systemData) {
                    if (selectedNode === 'borefield_1') borefieldHeatKW = (currentData.systemData.borefield1HeatW || 0) / 1000;
                    else if (selectedNode === 'borefield_2') borefieldHeatKW = (currentData.systemData.borefield2HeatW || 0) / 1000;
                    else if (selectedNode === 'borefield_3') borefieldHeatKW = (currentData.systemData.borefield3HeatW || 0) / 1000;
                  }
                  
                  const borefieldStatus = borefieldHeatKW > 0 ? 'Heating' : borefieldHeatKW < 0 ? 'Cooling' : 'Standby';
                  
                  const stats = [
                    { 
                      label: 'Current Load (kW)', 
                      value: Math.abs(borefieldHeatKW).toFixed(1)
                    },
                    { 
                      label: 'Ground Temp (°F)', 
                      value: '55.0'
                    },
                    { 
                      label: 'Buildings Served', 
                      value: metrics.buildingsCount.toString()
                    },
                    { 
                      label: 'Status', 
                      value: borefieldStatus
                    }
                  ];
                  
                  return (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      {stats.map((stat, index) => (
                        <div key={index} className="text-center">
                          <div className="text-sm text-gray-600 font-medium">
                            {stat.label}
                          </div>
                          <div className="text-lg font-semibold text-gray-900 mt-1">
                            {stat.value}
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })()}

                {/* Pump Details */}
                {selectedNode === 'pump' && currentData?.systemData && (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="text-center">
                      <div className="text-sm text-gray-600 font-medium">Mass Flow Rate</div>
                      <div className="text-lg font-semibold text-gray-900 mt-1">
                        {currentData.systemData.massFlowKgs?.toFixed(2) || 'N/A'} kg/s
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="text-sm text-gray-600 font-medium">Status</div>
                      <div className="text-lg font-semibold text-green-600 mt-1">Active</div>
                    </div>
                    <div className="text-center">
                      <div className="text-sm text-gray-600 font-medium">Type</div>
                      <div className="text-lg font-semibold text-gray-900 mt-1">Variable Speed</div>
                    </div>
                    <div className="text-center">
                      <div className="text-sm text-gray-600 font-medium">Control Mode</div>
                      <div className="text-lg font-semibold text-gray-900 mt-1">Flow Control</div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {activeTab === 'efficiency' && (
          <div className="space-y-8">
            <div className="text-center">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Performance Validation</h2>
              <p className="text-gray-600">Quantitative analysis of thermal network efficiency gains and economic benefits</p>
            </div>

            {(() => {
              const annualSavings = calculateAnnualSavings();
              const monthlyDemand = calculateMonthlyDemand();
              const capacityComparison = calculateCapacityComparison();
              const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

              return (
                <>
                  {/* Annual Energy Consumption Comparison */}
                  <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
                    <div className="flex items-center mb-6">
                      <span className="text-2xl mr-3">📊</span>
                      <h3 className="text-xl font-semibold text-gray-900">Annual Energy Consumption</h3>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                      <div className="text-center bg-green-50 rounded-lg p-4 border border-green-200">
                        <div className="text-sm text-green-600 font-medium uppercase tracking-wide">
                          Annual Energy Savings
                        </div>
                        <div className="text-3xl font-bold text-green-900 mt-2">
                          {annualSavings.savings.toLocaleString('en-US', {maximumFractionDigits: 0})} kWh
                        </div>
                        <div className="text-xs text-green-600 mt-1">
                          TEN vs ASHP systems
                        </div>
                      </div>
                      
                      <div className="text-center bg-blue-50 rounded-lg p-4 border border-blue-200">
                        <div className="text-sm text-blue-600 font-medium uppercase tracking-wide">
                          Economic Value
                        </div>
                        <div className="text-3xl font-bold text-blue-900 mt-2">
                          ${annualSavings.economicValue.toLocaleString('en-US', {maximumFractionDigits: 0})}
                        </div>
                        <div className="text-xs text-blue-600 mt-1">
                          Annual savings at $0.15/kWh
                        </div>
                      </div>
                      
                      <div className="text-center bg-purple-50 rounded-lg p-4 border border-purple-200">
                        <div className="text-sm text-purple-600 font-medium uppercase tracking-wide">
                          Efficiency Gain
                        </div>
                        <div className="text-3xl font-bold text-purple-900 mt-2">
                          {timeSeriesData.length > 0 ? ((annualSavings.savings / timeSeriesData.reduce((sum, h) => sum + (h.airTotal || 0), 0) * 1000) * 100).toFixed(1) : 0}%
                        </div>
                        <div className="text-xs text-purple-600 mt-1">
                          Energy reduction vs individual heat pumps
                        </div>
                      </div>
                    </div>
                    
                    <div className="bg-gray-50 rounded-lg p-4">
                      <EnergyConsumptionChart data={timeSeriesData} />
                    </div>
                  </div>

                  {/* Monthly Demand Comparison */}
                  <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
                    <div className="flex items-center mb-6">
                      <span className="text-2xl mr-3">📈</span>
                      <h3 className="text-xl font-semibold text-gray-900">Monthly Peak Demand</h3>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                      <div className="text-center bg-orange-50 rounded-lg p-4 border border-orange-200">
                        <div className="text-sm text-orange-600 font-medium uppercase tracking-wide">
                          Total Demand Reduction
                        </div>
                        <div className="text-3xl font-bold text-orange-900 mt-2">
                          {monthlyDemand.monthlyData.reduce((sum, m) => sum + m.difference, 0).toLocaleString('en-US', {maximumFractionDigits: 1})} kW
                        </div>
                        <div className="text-xs text-orange-600 mt-1">
                          Sum of monthly peak differences
                        </div>
                      </div>
                      
                      <div className="text-center bg-red-50 rounded-lg p-4 border border-red-200">
                        <div className="text-sm text-red-600 font-medium uppercase tracking-wide">
                          Economic Value
                        </div>
                        <div className="text-3xl font-bold text-red-900 mt-2">
                          ${monthlyDemand.economicValue.toLocaleString('en-US', {maximumFractionDigits: 0})}
                        </div>
                        <div className="text-xs text-red-600 mt-1">
                          Annual savings at $15/kW
                        </div>
                      </div>
                      
                      <div className="text-center bg-gray-50 rounded-lg p-4 border border-gray-200">
                        <div className="text-sm text-gray-600 font-medium uppercase tracking-wide">
                          Average Monthly Reduction
                        </div>
                        <div className="text-3xl font-bold text-gray-900 mt-2">
                          {(monthlyDemand.monthlyData.reduce((sum, m) => sum + m.difference, 0) / 12).toLocaleString('en-US', {maximumFractionDigits: 1})} kW
                        </div>
                        <div className="text-xs text-gray-600 mt-1">
                          Per month peak demand savings
                        </div>
                      </div>
                    </div>
                    
                    <div className="bg-gray-50 rounded-lg p-4">
                      <MonthlyDemandChart monthlyData={monthlyDemand.monthlyData} />
                    </div>
                  </div>

                  {/* Annual Capacity Comparison */}
                  <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
                    <div className="flex items-center mb-6">
                      <span className="text-2xl mr-3">⚡</span>
                      <h3 className="text-xl font-semibold text-gray-900">Peak Capacity Requirements</h3>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                      <div className="text-center bg-green-50 rounded-lg p-4 border border-green-200">
                        <div className="text-sm text-green-600 font-medium uppercase tracking-wide">
                          TEN Peak Load
                        </div>
                        <div className="text-3xl font-bold text-green-900 mt-2">
                          {capacityComparison.geoMax.toLocaleString('en-US', {maximumFractionDigits: 1})} kW
                        </div>
                        <div className="text-xs text-green-600 mt-1">
                          Hour {capacityComparison.geoHour.toLocaleString('en-US')} of year
                        </div>
                      </div>
                      
                      <div className="text-center bg-red-50 rounded-lg p-4 border border-red-200">
                        <div className="text-sm text-red-600 font-medium uppercase tracking-wide">
                          ASHP Peak Load
                        </div>
                        <div className="text-3xl font-bold text-red-900 mt-2">
                          {capacityComparison.airMax.toLocaleString('en-US', {maximumFractionDigits: 1})} kW
                        </div>
                        <div className="text-xs text-red-600 mt-1">
                          Hour {capacityComparison.airHour.toLocaleString('en-US')} of year
                        </div>
                      </div>
                      
                      <div className="text-center bg-blue-50 rounded-lg p-4 border border-blue-200">
                        <div className="text-sm text-blue-600 font-medium uppercase tracking-wide">
                          Capacity Reduction
                        </div>
                        <div className="text-3xl font-bold text-blue-900 mt-2">
                          {(capacityComparison.airMax - capacityComparison.geoMax).toLocaleString('en-US', {maximumFractionDigits: 1})} kW
                        </div>
                        <div className="text-xs text-blue-600 mt-1">
                          TEN advantage
                        </div>
                      </div>
                      
                      <div className="text-center bg-purple-50 rounded-lg p-4 border border-purple-200">
                        <div className="text-sm text-purple-600 font-medium uppercase tracking-wide">
                          Economic Value
                        </div>
                        <div className="text-3xl font-bold text-purple-900 mt-2">
                          ${capacityComparison.economicValue.toLocaleString('en-US', {maximumFractionDigits: 0})}
                        </div>
                        <div className="text-xs text-purple-600 mt-1">
                          Annual savings at $200/kW
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Borefield Cost Analysis */}
                  <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
                    <div className="flex items-center mb-6">
                      <span className="text-2xl mr-3">🏭</span>
                      <h3 className="text-xl font-semibold text-gray-900">Thermal Source Economic Analysis</h3>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      {(() => {
                        const borefields = [
                          {
                            id: 1,
                            name: 'Borefield 1',
                            capitalCost: 2000000,
                            annualHeatingKW: 1200000, // Example annual heating in kW
                            annualCoolingKW: 300000,  // Example annual cooling in kW
                            color: 'blue'
                          },
                          {
                            id: 2, 
                            name: 'Borefield 2',
                            capitalCost: 1500000,
                            annualHeatingKW: 800000,
                            annualCoolingKW: 200000,
                            color: 'green'
                          },
                          {
                            id: 3,
                            name: 'Borefield 3', 
                            capitalCost: 2500000,
                            annualHeatingKW: 1400000,
                            annualCoolingKW: 350000,
                            color: 'purple'
                          }
                        ];

                        return borefields.map(bf => {
                          const irr = 0.10; // 10% IRR
                          const lifespan = 50; // 50 year lifespan
                          const annualCost = (bf.capitalCost * (1 + irr)) / lifespan;
                          const thermalService = bf.annualHeatingKW + bf.annualCoolingKW;
                          const levelizedCost = annualCost / thermalService;
                          
                          const colorClasses = {
                            blue: 'from-blue-600 to-blue-700 border-blue-200',
                            green: 'from-green-600 to-green-700 border-green-200', 
                            purple: 'from-purple-600 to-purple-700 border-purple-200'
                          };

                          return (
                            <div key={bf.id} className={`bg-gradient-to-br ${colorClasses[bf.color]} rounded-lg p-6 text-white border-2`}>
                              <h4 className="text-lg font-semibold mb-4">{bf.name}</h4>
                              
                              <div className="space-y-3">
                                <div className="bg-white bg-opacity-20 rounded-lg p-3">
                                  <div className="text-sm opacity-90">Capital Cost</div>
                                  <div className="text-xl font-bold">${(bf.capitalCost / 1000000).toFixed(1)}M</div>
                                </div>
                                
                                <div className="bg-white bg-opacity-20 rounded-lg p-3">
                                  <div className="text-sm opacity-90">Annual Cost</div>
                                  <div className="text-lg font-semibold">${(annualCost / 1000).toFixed(0)}k</div>
                                  <div className="text-xs opacity-75">10% IRR, 50yr lifespan</div>
                                </div>
                                
                                <div className="grid grid-cols-2 gap-2">
                                  <div className="bg-white bg-opacity-20 rounded-lg p-2">
                                    <div className="text-xs opacity-90">Heating</div>
                                    <div className="text-sm font-semibold">{(bf.annualHeatingKW / 1000000).toFixed(1)} MW</div>
                                  </div>
                                  <div className="bg-white bg-opacity-20 rounded-lg p-2">
                                    <div className="text-xs opacity-90">Cooling</div>
                                    <div className="text-sm font-semibold">{(bf.annualCoolingKW / 1000000).toFixed(1)} MW</div>
                                  </div>
                                </div>
                                
                                <div className="bg-white bg-opacity-30 rounded-lg p-3 border border-white border-opacity-30">
                                  <div className="text-sm opacity-90">Thermal Service</div>
                                  <div className="text-lg font-bold">{(thermalService / 1000000).toFixed(1)} MW</div>
                                </div>
                                
                                <div className="bg-white bg-opacity-30 rounded-lg p-3 border border-white border-opacity-30">
                                  <div className="text-sm opacity-90">Levelized Cost of Thermal</div>
                                  <div className="text-lg font-bold">${levelizedCost.toFixed(3)}/kW</div>
                                  <div className="text-lg font-bold">${(levelizedCost / 0.2843451638).toFixed(2)}/ton</div>
                                </div>
                              </div>
                            </div>
                          );
                        });
                      })()}
                    </div>
                    
                    <div className="mt-6 bg-gray-50 rounded-lg p-4 border border-gray-200">
                      <div className="text-sm text-gray-600 text-center">
                        <strong>Economic Analysis:</strong> Levelized cost calculation based on 10% IRR and 50-year operational lifespan. 
                        Thermal service represents combined annual heating and cooling capacity delivered by each borefield.
                      </div>
                    </div>
                  </div>

                  {/* Individual Borefield Energy Savings */}
                  <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
                    <div className="flex items-center mb-6">
                      <span className="text-2xl mr-3">⚡</span>
                      <h3 className="text-xl font-semibold text-gray-900">Borefield-Specific Energy Savings</h3>
                    </div>
                    <p className="text-gray-600 mb-6 text-center">
                      Energy efficiency and economic benefits broken down by each borefield based on the buildings served
                    </p>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      {(() => {
                        const borefields = [
                          { id: 'borefield_1', name: 'Borefield 1', color: 'blue', buildings: 'Fire Dept, Gulf, Corner Cabinet (3 buildings)' },
                          { id: 'borefield_2', name: 'Borefield 2', color: 'green', buildings: 'Public School, Housing Dept, R1-R10 (12 buildings)' },
                          { id: 'borefield_3', name: 'Borefield 3', color: 'purple', buildings: 'R11-R31 (21 buildings)' }
                        ];

                        return borefields.map(bf => {
                          const savings = calculateBorefieldSavings(bf.id);
                          
                          const colorClasses = {
                            blue: { 
                              bg: 'bg-blue-50', 
                              border: 'border-blue-200', 
                              text: 'text-blue-900',
                              accent: 'text-blue-600'
                            },
                            green: { 
                              bg: 'bg-green-50', 
                              border: 'border-green-200', 
                              text: 'text-green-900',
                              accent: 'text-green-600'
                            },
                            purple: { 
                              bg: 'bg-purple-50', 
                              border: 'border-purple-200', 
                              text: 'text-purple-900',
                              accent: 'text-purple-600'
                            }
                          };

                          const colors = colorClasses[bf.color];

                          return (
                            <div key={bf.id} className={`${colors.bg} rounded-lg p-6 border-2 ${colors.border}`}>
                              <div className="text-center mb-4">
                                <h4 className={`text-lg font-semibold ${colors.text}`}>{bf.name}</h4>
                                <p className={`text-sm ${colors.accent} mt-1`}>{bf.buildings}</p>
                              </div>
                              
                              {/* Individual Metrics */}
                              <div className="space-y-3 mb-4">
                                <div className="grid grid-cols-3 gap-3">
                                  <div className="bg-white rounded-lg p-3 border border-gray-200 text-center">
                                    <div className={`text-xs ${colors.accent} font-medium uppercase tracking-wide`}>
                                      Energy Efficiency
                                    </div>
                                    <div className={`text-lg font-bold ${colors.text} mt-1`}>
                                      {savings.energySavings.toLocaleString('en-US', {maximumFractionDigits: 0})}
                                    </div>
                                    <div className={`text-xs ${colors.accent}`}>kWh</div>
                                  </div>
                                  
                                  <div className="bg-white rounded-lg p-3 border border-gray-200 text-center">
                                    <div className={`text-xs ${colors.accent} font-medium uppercase tracking-wide`}>
                                      Demand Savings
                                    </div>
                                    <div className={`text-lg font-bold ${colors.text} mt-1`}>
                                      {savings.demandSavings.toLocaleString('en-US', {maximumFractionDigits: 1})}
                                    </div>
                                    <div className={`text-xs ${colors.accent}`}>kW</div>
                                  </div>
                                  
                                  <div className="bg-white rounded-lg p-3 border border-gray-200 text-center">
                                    <div className={`text-xs ${colors.accent} font-medium uppercase tracking-wide`}>
                                      Capacity Savings
                                    </div>
                                    <div className={`text-lg font-bold ${colors.text} mt-1`}>
                                      {savings.capacitySavings.toLocaleString('en-US', {maximumFractionDigits: 1})}
                                    </div>
                                    <div className={`text-xs ${colors.accent}`}>kW</div>
                                  </div>
                                </div>
                              </div>
                              
                              {/* Prominent Total Economic Value */}
                              <div className={`bg-gradient-to-r ${bf.color === 'blue' ? 'from-blue-600 to-blue-700' : bf.color === 'green' ? 'from-green-600 to-green-700' : 'from-purple-600 to-purple-700'} rounded-lg p-4 text-white text-center shadow-lg`}>
                                <div className="text-sm font-medium uppercase tracking-wide opacity-90">
                                  Total Annual Economic Value
                                </div>
                                <div className="text-3xl font-bold mt-2">
                                  ${savings.totalEconomicValue.toLocaleString('en-US', {maximumFractionDigits: 0})}
                                </div>
                                <div className="text-xs opacity-80 mt-1">
                                  Energy + Demand + Capacity Savings
                                </div>
                              </div>
                              
                              {/* Building count */}
                              <div className="bg-white bg-opacity-80 rounded-lg p-2 border border-gray-200 mt-3">
                                <div className={`text-xs ${colors.accent} text-center`}>
                                  Buildings Served: <span className={`font-semibold ${colors.text}`}>{savings.buildingsServed}</span>
                                </div>
                              </div>
                            </div>
                          );
                        });
                      })()}
                    </div>
                    
                    <div className="mt-6 bg-gray-50 rounded-lg p-4 border border-gray-200">
                      <div className="text-sm text-gray-600 text-center">
                        <strong>Analysis Notes:</strong> Energy savings calculated based on buildings served by each borefield. 
                        Demand savings reflect peak load differences. Capacity value represents avoided infrastructure costs at $200/kW annually.
                      </div>
                    </div>
                  </div>
                </>
              );
            })()}
          </div>
        )}

        {activeTab === 'assets' && (
          <div className="space-y-8">
            <div className="text-center">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Reporting</h2>
              <p className="text-gray-600">Generate performance reports and system traceability documentation</p>
              
              {/* Demo Disclaimer */}
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mt-4 mx-auto max-w-4xl">
                <div className="flex items-center justify-center">
                  <div className="text-yellow-600 mr-2">⚠️</div>
                  <div className="text-sm text-yellow-800">
                    <strong>Demo Disclaimer:</strong> Generated reports are for demonstration purposes only and are not meant to reflect actual platform data. 
                    This showcases the potential reporting capabilities of the thermal network management platform.
                  </div>
                </div>
              </div>
            </div>

            {/* Report Generation Buttons */}
            <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
              <div className="flex items-center mb-6">
                <span className="text-2xl mr-3">📊</span>
                <h3 className="text-xl font-semibold text-gray-900">Report Generation</h3>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <button 
                  onClick={generateEmissionsReport}
                  className="flex items-center px-6 py-5 bg-gradient-to-r from-green-600 to-green-700 text-white rounded-lg hover:from-green-700 hover:to-green-800 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
                >
                  <span className="text-2xl mr-4">🌱</span>
                  <div className="text-left flex-1">
                    <div className="font-semibold text-lg">Monthly Carbon Impact Report</div>
                    <div className="text-sm text-green-100 mt-1">CO₂ reduction analysis with detailed emissions breakdown</div>
                  </div>
                </button>
                
                <button 
                  onClick={generateEnergyReport}
                  className="flex items-center px-6 py-5 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg hover:from-blue-700 hover:to-blue-800 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
                >
                  <span className="text-2xl mr-4">⚡</span>
                  <div className="text-left flex-1">
                    <div className="font-semibold text-lg">Monthly Energy Performance Report</div>
                    <div className="text-sm text-blue-100 mt-1">Consumption, efficiency metrics & system performance</div>
                  </div>
                </button>
                
                <button 
                  onClick={generateEconomicReport}
                  className="flex items-center px-6 py-5 bg-gradient-to-r from-purple-600 to-purple-700 text-white rounded-lg hover:from-purple-700 hover:to-purple-800 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
                >
                  <span className="text-2xl mr-4">💰</span>
                  <div className="text-left flex-1">
                    <div className="font-semibold text-lg">Quarterly Economic Performance Report</div>
                    <div className="text-sm text-purple-100 mt-1">Cost savings, ROI analysis & financial metrics</div>
                  </div>
                </button>
                
                <button 
                  onClick={generatePerformanceReport}
                  className="flex items-center px-6 py-5 bg-gradient-to-r from-orange-600 to-orange-700 text-white rounded-lg hover:from-orange-700 hover:to-orange-800 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
                >
                  <span className="text-2xl mr-4">📈</span>
                  <div className="text-left flex-1">
                    <div className="font-semibold text-lg">Annual Performance Report</div>
                    <div className="text-sm text-orange-100 mt-1">Comprehensive system analysis & performance validation</div>
                  </div>
                </button>
              </div>
            </div>

            {/* Enhanced Traceability Section */}
            <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
              <div className="flex items-center mb-6">
                <span className="text-2xl mr-3">🔍</span>
                <h3 className="text-xl font-semibold text-gray-900">Measurement & Verification Traceability</h3>
              </div>
              
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                <div className="flex items-center">
                  <span className="text-blue-600 mr-2">ℹ️</span>
                  <div className="text-sm text-blue-800">
                    <strong>M&V Framework:</strong> IPMVP Option D (Calibrated Simulation) with ASHRAE Guideline 14 compliance for hourly calibration standards.
                  </div>
                </div>
              </div>
              
              <div className="space-y-8">
                {/* Model Calibration Performance */}
                <div className="bg-green-50 rounded-lg p-6 border border-green-200">
                  <h4 className="font-semibold text-green-800 mb-4 flex items-center">
                    <span className="mr-2">✓</span>
                    Model Calibration Performance
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-green-700">26%</div>
                      <div className="text-sm text-green-600">CVRMSE (≤30% required)</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-green-700">9%</div>
                      <div className="text-sm text-green-600">NMBE (≤10% required)</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-green-700">98.4%</div>
                      <div className="text-sm text-green-600">Measurement Coverage</div>
                    </div>
                  </div>
                </div>

                {/* Equipment Models */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="bg-red-50 rounded-lg p-6 border border-red-200">
                    <h4 className="font-semibold text-red-800 mb-4 flex items-center">
                      <span className="mr-2">🏠</span>
                      Baseline ASHP Model
                    </h4>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-gray-600">HSPF Rating:</span>
                        <span className="font-medium bg-white px-2 py-1 rounded">9</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-gray-600">SEER Rating:</span>
                        <span className="font-medium bg-white px-2 py-1 rounded">15</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-gray-600">Cold Weather COP:</span>
                        <span className="font-medium bg-white px-2 py-1 rounded">1.6-2.5</span>
                      </div>
                      <div className="text-xs text-red-600 mt-2">
                        Standard efficiency with cold weather degradation factors
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-green-50 rounded-lg p-6 border border-green-200">
                    <h4 className="font-semibold text-green-800 mb-4 flex items-center">
                      <span className="mr-2">🌿</span>
                      TEN GSHP Model
                    </h4>
                    <div className="space-y-3">
                      <div className="text-gray-700">
                        <div className="font-medium text-lg">WaterFurnace 5 Series</div>
                        <div className="text-sm text-gray-600">Model: 500A11</div>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-gray-600">Average COP:</span>
                        <span className="font-medium bg-white px-2 py-1 rounded">4.2</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-gray-600">Peak COP:</span>
                        <span className="font-medium bg-white px-2 py-1 rounded">5.3</span>
                      </div>
                      <div className="text-xs text-green-600 mt-2">
                        Consistent efficiency across temperature range
                      </div>
                    </div>
                  </div>
                </div>

                {/* Building Load Modeling */}
                <div className="bg-blue-50 rounded-lg p-6 border border-blue-200">
                  <h4 className="font-semibold text-blue-800 mb-4 flex items-center">
                    <span className="mr-2">🏗️</span>
                    Building Load Modeling
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <div className="text-gray-700">
                        <div className="font-medium text-lg">UrbanOpt (EnergyPlus)</div>
                        <div className="text-sm text-blue-600 mt-1">Simulation Engine</div>
                      </div>
                      <div className="mt-3 space-y-2">
                        <div className="text-sm text-gray-600">• Physics-based building models</div>
                        <div className="text-sm text-gray-600">• Weather-normalized performance</div>
                        <div className="text-sm text-gray-600">• TMY3 data for Boston Logan</div>
                      </div>
                    </div>
                    <div className="bg-white rounded-lg p-4">
                      <div className="text-center">
                        <div className="text-lg font-bold text-blue-700">✓ Validated</div>
                        <div className="text-xs text-blue-600 mt-1">ASHRAE Guideline 14 Compliant</div>
                        <div className="text-xs text-gray-500 mt-2">Hourly calibration standards met</div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Measurement Infrastructure */}
                <div className="bg-gray-50 rounded-lg p-6 border border-gray-200">
                  <h4 className="font-semibold text-gray-800 mb-4 flex items-center">
                    <span className="mr-2">📊</span>
                    Measurement Infrastructure
                  </h4>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                    <div>
                      <h5 className="font-medium text-gray-700 mb-3">Physical Metering (15 sensors)</h5>
                      <div className="space-y-3">
                        <div className="flex items-center justify-between bg-white p-3 rounded-lg">
                          <span className="text-sm text-gray-600">BTU meters - Distribution loop</span>
                          <span className="font-bold text-blue-600">6</span>
                        </div>
                        <div className="flex items-center justify-between bg-white p-3 rounded-lg">
                          <span className="text-sm text-gray-600">Electrical meters - Equipment</span>
                          <span className="font-bold text-green-600">6</span>
                        </div>
                        <div className="flex items-center justify-between bg-white p-3 rounded-lg">
                          <span className="text-sm text-gray-600">Borefield sensors - Temp/Flow</span>
                          <span className="font-bold text-orange-600">3</span>
                        </div>
                      </div>
                    </div>
                    
                    <div>
                      <h5 className="font-medium text-gray-700 mb-3">Virtual Metering (24 points)</h5>
                      <div className="space-y-2">
                        <div className="text-sm text-gray-600">• Building-level thermal load disaggregation</div>
                        <div className="text-sm text-gray-600">• ASHP baseline performance calculations</div>
                        <div className="text-sm text-gray-600">• Component-level energy attribution</div>
                        <div className="text-sm text-gray-600">• Continuous validation vs physical sensors</div>
                        <div className="text-xs text-gray-500 mt-2 bg-white p-2 rounded">
                          Enabled by calibrated digital twin model
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="text-center bg-white p-4 rounded-lg border">
                      <div className="text-xl font-bold text-gray-800">35,040</div>
                      <div className="text-xs text-gray-600">Data points/year</div>
                      <div className="text-xs text-gray-500">(15-minute intervals)</div>
                    </div>
                    <div className="text-center bg-white p-4 rounded-lg border">
                      <div className="text-xl font-bold text-green-600">99.7%</div>
                      <div className="text-xs text-gray-600">Data quality</div>
                      <div className="text-xs text-gray-500">(0.3% flagged/interpolated)</div>
                    </div>
                    <div className="text-center bg-white p-4 rounded-lg border">
                      <div className="text-xl font-bold text-blue-600">15 min</div>
                      <div className="text-xs text-gray-600">Data intervals</div>
                      <div className="text-xs text-gray-500">(Real-time monitoring)</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="text-center text-gray-600 text-sm">
            Proving thermal network performance with digital twin M&V
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;
