import * as d3 from 'd3';

export class ThermalNetworkDataProcessor {
  constructor() {
    this.rawData = null;
    this.processedData = null;
    this.buildings = [];
    this.currentHour = 1;
  }

  async loadData() {
    try {
      this.rawData = await d3.csv('/heat_pump_comparison_results.csv', d3.autoType);
      this.processData();
      return this.processedData;
    } catch (error) {
      console.error('Error loading CSV data:', error);
      throw error;
    }
  }

  processData() {
    if (!this.rawData) return;

    this.buildings = this.extractBuildingList();
    this.processedData = this.rawData.map(row => this.processHourlyData(row));
  }

  extractBuildingList() {
    const buildingIds = new Set();
    
    Object.keys(this.rawData[0]).forEach(column => {
      const match = column.match(/^b_(\d+)_/);
      if (match) {
        buildingIds.add(`b_${match[1]}`);
      }
    });
    
    return Array.from(buildingIds).sort((a, b) => {
      const numA = parseInt(a.split('_')[1]);
      const numB = parseInt(b.split('_')[1]);
      return numA - numB;
    });
  }

  processHourlyData(row) {
    const hourData = {
      hour: row.hour,
      outdoorTemp: {
        celsius: row.outdoor_air_temp_c,
        fahrenheit: row.outdoor_air_temp_f
      },
      systemData: {
        massFlowKgs: row.mass_flow_kgs,
        borefield1HeatW: row.borefield_1_heat_w,
        borefield2HeatW: row.borefield_2_heat_w,
        borefield3HeatW: row.borefield_3_heat_w,
        totalBorefieldHeatW: row.total_borefield_heat_w
      },
      buildings: {}
    };

    this.buildings.forEach(buildingId => {
      const building = {
        id: buildingId,
        inletTemp: {
          celsius: row[`${buildingId}_inlet_temp_c`],
          fahrenheit: row[`${buildingId}_inlet_temp_f`]
        },
        load: row[`${buildingId}_load_w`],
        geo: {
          cop: row[`${buildingId}_geo_cop`],
          electric: row[`${buildingId}_geo_electric_w`]
        },
        air: {
          cop: row[`${buildingId}_air_cop`],
          electric: row[`${buildingId}_air_electric_w`]
        }
      };

      building.efficiency = this.calculateBuildingEfficiency(building);
      hourData.buildings[buildingId] = building;
    });

    hourData.systemMetrics = this.calculateSystemMetrics(hourData);
    return hourData;
  }

  calculateBuildingEfficiency(building) {
    const geoEfficiency = building.geo.cop || 0;
    const airEfficiency = building.air.cop || 0;
    const efficiencyGain = ((geoEfficiency - airEfficiency) / airEfficiency) * 100;
    
    return {
      geoEfficiency,
      airEfficiency,
      efficiencyGain,
      energySavings: building.air.electric - building.geo.electric
    };
  }

  calculateSystemMetrics(hourData) {
    const buildings = Object.values(hourData.buildings);
    
    // Debug: Check first building data for hour 1
    if (hourData.hour === 1 && buildings.length > 0) {
      console.log('First building data:', buildings[0]);
      console.log('Buildings count:', buildings.length);
      buildings.forEach((b, idx) => {
        if (idx < 5) { // Log first 5 buildings
          console.log(`Building ${idx}: load=${b.load}, id=${b.id}`);
        }
      });
    }
    
    const totalGeoElectric = buildings.reduce((sum, b) => sum + (b.geo.electric || 0), 0);
    const totalAirElectric = buildings.reduce((sum, b) => sum + (b.air.electric || 0), 0);
    const totalLoad = buildings.reduce((sum, b) => sum + Math.abs(b.load || 0), 0);
    
    // Calculate heating and cooling loads separately
    const heatingLoad = buildings.reduce((sum, b) => {
      const load = b.load || 0;
      return load < 0 ? sum + load : sum; // Sum negative loads (heating)
    }, 0);
    
    const coolingLoad = buildings.reduce((sum, b) => {
      const load = b.load || 0;
      return load > 0 ? sum + load : sum; // Sum positive loads (cooling)
    }, 0);
    
    const totalBuildingLoad = heatingLoad + coolingLoad;
    
    // Debug: Log the calculated values for hour 1
    if (hourData.hour === 1) {
      console.log(`Hour 1 - Heating: ${heatingLoad}W, Cooling: ${coolingLoad}W, Total: ${totalBuildingLoad}W`);
    }
    
    const avgGeoCOP = totalLoad / totalGeoElectric;
    const avgAirCOP = totalLoad / totalAirElectric;
    
    return {
      totalGeoElectric,
      totalAirElectric,
      totalLoad,
      totalBuildingLoad,
      heatingLoad,
      coolingLoad,
      avgGeoCOP,
      avgAirCOP,
      systemEfficiencyGain: ((avgGeoCOP - avgAirCOP) / avgAirCOP) * 100,
      totalEnergySavings: totalAirElectric - totalGeoElectric,
      peakDemandReduction: totalAirElectric - totalGeoElectric
    };
  }

  getHourlyData(hour) {
    if (!this.processedData) return null;
    return this.processedData.find(data => data.hour === hour);
  }

  getCurrentHourData() {
    return this.getHourlyData(this.currentHour);
  }

  setCurrentHour(hour) {
    this.currentHour = hour;
  }

  getTimeSeriesData() {
    if (!this.processedData) return [];
    
    return this.processedData.map(hourData => ({
      hour: hourData.hour,
      outdoorTemp: hourData.outdoorTemp.celsius,
      geoTotal: hourData.systemMetrics.totalGeoElectric,
      airTotal: hourData.systemMetrics.totalAirElectric,
      savings: hourData.systemMetrics.totalEnergySavings,
      geoCOP: hourData.systemMetrics.avgGeoCOP,
      airCOP: hourData.systemMetrics.avgAirCOP
    }));
  }

  getBuildingNetworkData() {
    if (!this.processedData) return [];
    
    const currentData = this.getCurrentHourData();
    if (!currentData) return [];

    return this.buildings.map((buildingId, index) => {
      const building = currentData.buildings[buildingId];
      
      return {
        id: buildingId,
        name: `Building ${buildingId.split('_')[1]}`,
        x: (index % 7) * 100 + 50,
        y: Math.floor(index / 7) * 80 + 50,
        type: building.load < 0 ? 'heat_sink' : 'heat_source',
        temperature: building.inletTemp.celsius,
        load: Math.abs(building.load),
        geoEfficiency: building.geo.cop,
        airEfficiency: building.air.cop,
        energySavings: building.efficiency.energySavings,
        efficiencyGain: building.efficiency.efficiencyGain
      };
    });
  }

  getAssetValuation() {
    // Return only borefield asset data
    const borefields = [
      {
        id: 'borefield_1',
        name: 'Borefield 1',
        type: 'Geothermal Heat Exchanger',
        capacity: 500000, // 500 kW
        utilization: 75, // 75% capacity utilization
        efficiency: 4.8, // Average COP
        annualSavings: 180000, // $180k annual savings
        networkValue: 216000, // With network effect multiplier
        paybackPeriod: 8.3, // Years
        installationCost: 1500000, // $1.5M
        maintenanceCost: 25000, // $25k annual
        groundTemp: 54 // °F
      },
      {
        id: 'borefield_2', 
        name: 'Borefield 2',
        type: 'Geothermal Heat Exchanger',
        capacity: 750000, // 750 kW
        utilization: 82, // 82% capacity utilization
        efficiency: 4.9, // Average COP
        annualSavings: 275000, // $275k annual savings
        networkValue: 330000, // With network effect multiplier
        paybackPeriod: 7.8, // Years
        installationCost: 2100000, // $2.1M
        maintenanceCost: 35000, // $35k annual
        groundTemp: 55 // °F
      },
      {
        id: 'borefield_3',
        name: 'Borefield 3', 
        type: 'Geothermal Heat Exchanger',
        capacity: 600000, // 600 kW
        utilization: 68, // 68% capacity utilization
        efficiency: 4.7, // Average COP
        annualSavings: 195000, // $195k annual savings
        networkValue: 234000, // With network effect multiplier
        paybackPeriod: 9.1, // Years
        installationCost: 1800000, // $1.8M
        maintenanceCost: 30000, // $30k annual
        groundTemp: 53 // °F
      }
    ];

    return borefields.sort((a, b) => b.networkValue - a.networkValue);
  }
}