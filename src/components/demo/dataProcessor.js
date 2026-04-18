// Loads a pre-processed columnar JSON (built from the CSV at build time).
// JSON.parse is native C++ and handles the 14.6MB file in milliseconds,
// where d3.csv on the 39MB CSV took minutes (2.3M object property insertions).

export class ThermalNetworkDataProcessor {
  constructor() {
    this.data = null;
    this.buildings = [];
    this.currentHour = 1;
    this._cache = {};
  }

  async loadData() {
    const res = await fetch('/thermal-data.json');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    this.data = await res.json();
    this.buildings = this.data.buildingIds;
    return true;
  }

  _col(name, i) {
    const c = this.data.columns[name];
    return c ? c[i] : 0;
  }

  _processHour(hour) {
    const i = hour - 1;
    const cols = this.data.columns;

    const hourData = {
      hour,
      outdoorTemp: {
        celsius: cols.outdoor_air_temp_c[i],
        fahrenheit: cols.outdoor_air_temp_f[i]
      },
      systemData: {
        massFlowKgs: cols.mass_flow_kgs[i],
        borefield1HeatW: cols.borefield_1_heat_w[i],
        borefield2HeatW: cols.borefield_2_heat_w[i],
        borefield3HeatW: cols.borefield_3_heat_w[i],
        totalBorefieldHeatW: cols.total_borefield_heat_w[i]
      },
      buildings: {}
    };

    let totalGeoElectric = 0;
    let totalAirElectric = 0;
    let totalLoad = 0;

    for (const id of this.buildings) {
      const geoElec = cols[`${id}_geo_electric_w`][i];
      const airElec = cols[`${id}_air_electric_w`][i];
      const geoCOP = cols[`${id}_geo_cop`][i];
      const airCOP = cols[`${id}_air_cop`][i];
      const load = cols[`${id}_load_w`][i];

      totalGeoElectric += geoElec;
      totalAirElectric += airElec;
      totalLoad += Math.abs(load);

      hourData.buildings[id] = {
        id,
        inletTemp: {
          celsius: cols[`${id}_inlet_temp_c`][i],
          fahrenheit: cols[`${id}_inlet_temp_f`][i]
        },
        load,
        geo: { cop: geoCOP, electric: geoElec },
        air: { cop: airCOP, electric: airElec },
        efficiency: {
          geoEfficiency: geoCOP,
          airEfficiency: airCOP,
          efficiencyGain: airCOP > 0 ? ((geoCOP - airCOP) / airCOP) * 100 : 0,
          energySavings: airElec - geoElec
        }
      };
    }

    const avgGeoCOP = totalGeoElectric > 0 ? totalLoad / totalGeoElectric : 0;
    const avgAirCOP = totalAirElectric > 0 ? totalLoad / totalAirElectric : 0;

    hourData.systemMetrics = {
      totalGeoElectric,
      totalAirElectric,
      totalLoad,
      avgGeoCOP,
      avgAirCOP,
      systemEfficiencyGain: avgAirCOP > 0 ? ((avgGeoCOP - avgAirCOP) / avgAirCOP) * 100 : 0,
      totalEnergySavings: totalAirElectric - totalGeoElectric,
      peakDemandReduction: totalAirElectric - totalGeoElectric
    };

    return hourData;
  }

  getHourlyData(hour) {
    if (!this.data) return null;
    if (hour < 1 || hour > this.data.numHours) return null;
    if (this._cache[hour]) return this._cache[hour];
    const result = this._processHour(hour);
    this._cache[hour] = result;
    return result;
  }

  setCurrentHour(hour) {
    this.currentHour = hour;
  }

  getCurrentHourData() {
    return this.getHourlyData(this.currentHour);
  }

  getAnnualSummary() {
    if (this._annual) return this._annual;
    const cols = this.data.columns;
    const n = this.data.numHours;
    const hourlyGeo = new Float32Array(n);
    const hourlyAir = new Float32Array(n);
    const hourlyAbsLoad = new Float32Array(n);
    const hourlyHeatLoad = new Float32Array(n);
    const hourlyCoolLoad = new Float32Array(n);

    for (const id of this.buildings) {
      const geoArr = cols[`${id}_geo_electric_w`];
      const airArr = cols[`${id}_air_electric_w`];
      const loadArr = cols[`${id}_load_w`];
      for (let i = 0; i < n; i++) {
        hourlyGeo[i] += geoArr[i];
        hourlyAir[i] += airArr[i];
        const load = loadArr[i];
        hourlyAbsLoad[i] += Math.abs(load);
        if (load < 0) hourlyHeatLoad[i] += -load;
        else hourlyCoolLoad[i] += load;
      }
    }

    // Month boundaries (end hour, inclusive, 1-indexed)
    const MONTH_END = [744, 1416, 2160, 2880, 3624, 4344, 5088, 5832, 6552, 7296, 8016, 8760];
    const monthlyPeakGeo = new Array(12).fill(0);
    const monthlyPeakAir = new Array(12).fill(0);
    const monthlyLoad = new Array(12).fill(0);
    const monthlyGeoElec = new Array(12).fill(0);
    const monthlyAirElec = new Array(12).fill(0);

    let totalGeo = 0, totalAir = 0, totalLoad = 0;
    let annualPeakGeo = 0, annualPeakAir = 0;
    let peakHeatIdx = 0, peakCoolIdx = 0;
    let mIdx = 0;

    for (let i = 0; i < n; i++) {
      while (i + 1 > MONTH_END[mIdx]) mIdx++;
      const g = hourlyGeo[i];
      const a = hourlyAir[i];
      totalGeo += g;
      totalAir += a;
      totalLoad += hourlyAbsLoad[i];
      if (g > annualPeakGeo) annualPeakGeo = g;
      if (a > annualPeakAir) annualPeakAir = a;
      if (g > monthlyPeakGeo[mIdx]) monthlyPeakGeo[mIdx] = g;
      if (a > monthlyPeakAir[mIdx]) monthlyPeakAir[mIdx] = a;
      monthlyLoad[mIdx] += hourlyAbsLoad[i];
      monthlyGeoElec[mIdx] += g;
      monthlyAirElec[mIdx] += a;
      if (hourlyHeatLoad[i] > hourlyHeatLoad[peakHeatIdx]) peakHeatIdx = i;
      if (hourlyCoolLoad[i] > hourlyCoolLoad[peakCoolIdx]) peakCoolIdx = i;
    }

    const avgGeoCOP = totalGeo > 0 ? totalLoad / totalGeo : 0;
    const avgAirCOP = totalAir > 0 ? totalLoad / totalAir : 0;

    // Seasonal COPs (winter = Dec+Jan+Feb = months 11,0,1; summer = Jun+Jul+Aug = 5,6,7)
    const seasonalCOP = (months) => {
      let load = 0, geo = 0, air = 0;
      for (const m of months) {
        load += monthlyLoad[m]; geo += monthlyGeoElec[m]; air += monthlyAirElec[m];
      }
      return {
        geoCOP: geo > 0 ? load / geo : 0,
        airCOP: air > 0 ? load / air : 0
      };
    };
    const winter = seasonalCOP([11, 0, 1]);
    const summer = seasonalCOP([5, 6, 7]);

    // Monthly peak demand reduction (kW per month, summed to kW-months)
    const monthlyPeakReductionKw = monthlyPeakAir.map((a, i) => (a - monthlyPeakGeo[i]) / 1000);
    const monthlyDemandSavingsKwMonth = monthlyPeakReductionKw.reduce((s, v) => s + v, 0);
    const annualPeakReductionKw = (annualPeakAir - annualPeakGeo) / 1000;

    this._annual = {
      avgGeoCOP,
      avgAirCOP,
      systemEfficiencyGain: avgAirCOP > 0 ? ((avgGeoCOP - avgAirCOP) / avgAirCOP) * 100 : 0,
      annualSavingsKwh: (totalAir - totalGeo) / 1000,
      annualGeoKwh: totalGeo / 1000,
      annualAirKwh: totalAir / 1000,
      peakDemandReductionKw: annualPeakReductionKw,
      peakHeatingHour: peakHeatIdx + 1,
      peakCoolingHour: peakCoolIdx + 1,
      winterCOP: winter,
      summerCOP: summer,
      monthlyPeakGeoKw: monthlyPeakGeo.map(w => w / 1000),
      monthlyPeakAirKw: monthlyPeakAir.map(w => w / 1000),
      monthlyPeakReductionKw,
      monthlyDemandSavingsKwMonth,
      annualPeakReductionKw,
      _hourlyGeo: hourlyGeo,
      _hourlyAir: hourlyAir,
      _hourlyAbsLoad: hourlyAbsLoad
    };
    return this._annual;
  }

  getPeakWeek(kind) {
    const annual = this.getAnnualSummary();
    const cols = this.data.columns;
    const n = this.data.numHours;
    const peakHour = kind === 'winter' ? annual.peakHeatingHour : annual.peakCoolingHour;
    let start = Math.max(1, peakHour - 72);
    if (start + 167 > n) start = n - 167;

    const data = new Array(168);
    for (let k = 0; k < 168; k++) {
      const h = start + k;
      const i = h - 1;
      const geoW = annual._hourlyGeo[i];
      const airW = annual._hourlyAir[i];
      const loadW = annual._hourlyAbsLoad[i];
      data[k] = {
        hour: h,
        outdoorF: cols.outdoor_air_temp_f[i],
        geoTotal: geoW / 1000,
        airTotal: airW / 1000,
        geoCOP: geoW > 0 ? loadW / geoW : 0,
        airCOP: airW > 0 ? loadW / airW : 0
      };
    }
    return { peakHour, startHour: start, endHour: start + 167, data };
  }

  getBorefieldBreakdown() {
    if (this._borefieldBreakdown) return this._borefieldBreakdown;
    const cols = this.data.columns;
    const n = this.data.numHours;

    // Building → borefield assignments (matches the original network topology)
    const groups = [
      {
        id: 'borefield_1', name: 'Borefield 1',
        buildings: ['b_1', 'b_2', 'b_3'],
        capital: 2_000_000
      },
      {
        id: 'borefield_2', name: 'Borefield 2',
        buildings: Array.from({ length: 12 }, (_, i) => `b_${i + 4}`), // b_4..b_15
        capital: 1_500_000
      },
      {
        id: 'borefield_3', name: 'Borefield 3',
        buildings: Array.from({ length: 21 }, (_, i) => `b_${i + 16}`), // b_16..b_36
        capital: 2_500_000
      }
    ];

    const MONTH_END = [744, 1416, 2160, 2880, 3624, 4344, 5088, 5832, 6552, 7296, 8016, 8760];

    this._borefieldBreakdown = groups.map(g => {
      const hourlyGeo = new Float32Array(n);
      const hourlyAir = new Float32Array(n);
      const hourlyLoad = new Float32Array(n);
      let heatingWh = 0;
      let coolingWh = 0;

      for (const id of g.buildings) {
        const geoArr = cols[`${id}_geo_electric_w`];
        const airArr = cols[`${id}_air_electric_w`];
        const loadArr = cols[`${id}_load_w`];
        if (!geoArr || !airArr || !loadArr) continue;
        for (let i = 0; i < n; i++) {
          hourlyGeo[i] += geoArr[i];
          hourlyAir[i] += airArr[i];
          const load = loadArr[i];
          hourlyLoad[i] += Math.abs(load);
          if (load < 0) heatingWh += -load;
          else coolingWh += load;
        }
      }

      const monthlyPeakGeo = new Array(12).fill(0);
      const monthlyPeakAir = new Array(12).fill(0);
      let totalGeo = 0, totalAir = 0, totalLoad = 0;
      let annualPeakGeo = 0, annualPeakAir = 0;
      let mIdx = 0;

      for (let i = 0; i < n; i++) {
        while (i + 1 > MONTH_END[mIdx]) mIdx++;
        const geo = hourlyGeo[i];
        const air = hourlyAir[i];
        totalGeo += geo;
        totalAir += air;
        totalLoad += hourlyLoad[i];
        if (geo > annualPeakGeo) annualPeakGeo = geo;
        if (air > annualPeakAir) annualPeakAir = air;
        if (geo > monthlyPeakGeo[mIdx]) monthlyPeakGeo[mIdx] = geo;
        if (air > monthlyPeakAir[mIdx]) monthlyPeakAir[mIdx] = air;
      }

      const annualSavingsKwh = (totalAir - totalGeo) / 1000;
      const monthlyDemandSavingsKwMonth = monthlyPeakAir.reduce(
        (s, a, i) => s + (a - monthlyPeakGeo[i]) / 1000,
        0
      );
      const annualPeakReductionKw = (annualPeakAir - annualPeakGeo) / 1000;

      // Levelized Cost of Thermal — 10% financing factor over a 50-year asset life
      const thermalServiceKwh = totalLoad / 1000;
      const annualCapitalCost = (g.capital * 1.10) / 50;
      const lcotPerKwh = thermalServiceKwh > 0 ? annualCapitalCost / thermalServiceKwh : 0;
      const lcotPerMwh = lcotPerKwh * 1000;

      const cop = totalGeo > 0 ? totalLoad / totalGeo : 0;

      return {
        id: g.id,
        name: g.name,
        buildingCount: g.buildings.length,
        capital: g.capital,
        thermalServiceMwh: thermalServiceKwh / 1000,
        heatingMwh: heatingWh / 1_000_000,
        coolingMwh: coolingWh / 1_000_000,
        cop,
        annualSavingsKwh,
        monthlyDemandSavingsKwMonth,
        annualPeakReductionKw,
        lcotPerKwh,
        lcotPerMwh,
        annualCapitalCost
      };
    });

    return this._borefieldBreakdown;
  }
}
