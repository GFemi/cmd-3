(() => {
  const LEVELS = [
    { key: 'zhejiang', name: '浙江省', file: './data/zhejiang.json', nextRegion: '杭州市', hint: '点击杭州市下钻' },
    { key: 'hangzhou', name: '杭州市', file: './data/hangzhou.json', nextRegion: '余杭区', hint: '点击余杭区下钻' },
    { key: 'yuhang', name: '余杭区', file: './data/yuhang.json', nextRegion: null, hint: '已下钻至街道 / 镇' }
  ];

  const metricMeta = {
    records: { label: '专档人数', unit: ' 万', min: 8, max: 78 },
    detection: { label: '检测率', unit: '%', min: 45, max: 96 },
    risk: { label: '风险人数占比', unit: '%', min: 6, max: 34 },
    improvement: { label: '改善率', unit: '%', min: 12, max: 88 }
  };

  const palette = ['#1f9a76', '#66d5a3', '#d7e79b', '#ffb45d', '#ff7b50', '#ed4f4f'];
  const chart = echarts.init(document.getElementById('map'), null, { renderer: 'canvas' });
  const title = document.getElementById('map-title');
  const backButton = document.getElementById('back-button');
  const hint = document.getElementById('drill-hint');
  const tabs = [...document.querySelectorAll('.tab')];
  const cache = new Map();
  let levelIndex = 0;
  let activeMetric = 'risk';

  const hash = (text) => [...text].reduce((total, char) => ((total * 31) + char.charCodeAt(0)) >>> 0, 17);

  function buildDatum(name, index) {
    const seed = hash(name) + index * 97;
    const risk = 6 + (seed % 29);
    const high = +(1.2 + ((seed * 7) % 66) / 10).toFixed(1);
    const medium = +(3.8 + ((seed * 11) % 112) / 10).toFixed(1);
    const low = +(8.1 + ((seed * 13) % 175) / 10).toFixed(1);
    const values = {
      records: +(8 + (seed % 701) / 10).toFixed(1),
      detection: 45 + (seed % 52),
      risk,
      improvement: 12 + (seed % 77)
    };
    return { name, value: values[activeMetric], values, riskDetail: { high, medium, low } };
  }

  async function getGeo(level) {
    if (cache.has(level.key)) return cache.get(level.key);
    const response = await fetch(level.file);
    if (!response.ok) throw new Error(`地图文件加载失败：${level.file}`);
    const geo = await response.json();
    geo.features.forEach((feature) => {
      const p = feature.properties || (feature.properties = {});
      p.name = p.name || p.NAME || p.fullname;
    });
    cache.set(level.key, geo);
    return geo;
  }

  function dot(color) {
    return `<span style="display:inline-block;width:9px;height:9px;margin-right:9px;border-radius:50%;background:${color};box-shadow:0 0 6px ${color};vertical-align:1px"></span>`;
  }

  function tooltipFormatter(params) {
    const datum = params.data;
    if (!datum) return params.name;
    if (activeMetric !== 'risk') {
      const meta = metricMeta[activeMetric];
      return `<div class="tip-title">${params.name}</div><div>${meta.label}：<b>${datum.value}${meta.unit}</b></div>`;
    }
    const d = datum.riskDetail;
    return [
      `<div class="tip-title">${params.name}</div>`,
      `<div class="tip-total">风险人数（占比）：<b>${datum.value}%</b></div>`,
      `<div>${dot('#f24f55')}高风险人数：<b>${d.high} 万</b></div>`,
      `<div>${dot('#ffd166')}中风险人数：<b>${d.medium} 万</b></div>`,
      `<div>${dot('#39df9c')}低风险人数：<b>${d.low} 万</b></div>`
    ].join('');
  }

  async function renderMap() {
    const level = LEVELS[levelIndex];
    try {
      chart.showLoading('default', { text: '地图加载中…', color: '#2d8cff', textColor: '#cbd8ea', maskColor: '#0d0928' });
      const geo = await getGeo(level);
      echarts.registerMap(level.key, geo);
      const data = geo.features.map((feature, index) => buildDatum(feature.properties.name, index));
      const meta = metricMeta[activeMetric];

      title.textContent = `${level.name}热力分布`;
      backButton.hidden = levelIndex === 0;
      hint.textContent = level.hint;

      chart.setOption({
        animationDurationUpdate: 420,
        backgroundColor: '#0d0928',
        tooltip: {
          trigger: 'item',
          enterable: false,
          padding: [17, 20],
          borderWidth: 1,
          borderColor: '#145193',
          backgroundColor: 'rgba(15, 19, 31, .92)',
          textStyle: { color: '#e7edf8', fontSize: 17, lineHeight: 29 },
          extraCssText: 'border-radius:9px;box-shadow:0 12px 34px rgba(0,0,0,.32);min-width:250px;',
          formatter: tooltipFormatter
        },
        visualMap: {
          type: 'continuous',
          min: meta.min,
          max: meta.max,
          left: 30,
          bottom: 25,
          itemWidth: 13,
          itemHeight: 165,
          text: ['高', '低'],
          textGap: 10,
          calculable: true,
          precision: 0,
          textStyle: { color: '#8c8ca2', fontSize: 16 },
          inRange: { color: palette },
          handleStyle: { borderColor: '#fff', borderWidth: 2 },
          formatter: (value) => Math.round(value)
        },
        series: [{
          id: 'drill-map',
          type: 'map',
          map: level.key,
          roam: false,
          selectedMode: false,
          top: '9%',
          bottom: '9%',
          left: '14%',
          right: '14%',
          scaleLimit: { min: 1, max: 4 },
          label: {
            show: true,
            color: '#f7fbff',
            fontWeight: 700,
            fontSize: levelIndex === 2 ? 13 : 17,
            textBorderColor: 'rgba(9,22,46,.3)',
            textBorderWidth: 2
          },
          emphasis: {
            label: { show: true, color: '#fff', fontSize: levelIndex === 2 ? 14 : 19 },
            itemStyle: { areaColor: '#2a5ca8', borderColor: '#79baff', borderWidth: 1.3, shadowBlur: 14, shadowColor: 'rgba(29,117,235,.65)' }
          },
          itemStyle: { borderColor: 'rgba(224,238,255,.55)', borderWidth: .65 },
          data
        }]
      }, true);
    } catch (error) {
      console.error(error);
      chart.clear();
      chart.setOption({ title: { text: error.message, left: 'center', top: 'middle', textStyle: { color: '#ff7a7a' } } });
    } finally {
      chart.hideLoading();
    }
  }

  chart.on('click', (params) => {
    const next = LEVELS[levelIndex].nextRegion;
    if (next && params.name === next) {
      levelIndex += 1;
      renderMap();
    }
  });

  backButton.addEventListener('click', () => {
    if (levelIndex > 0) {
      levelIndex -= 1;
      renderMap();
    }
  });

  tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      activeMetric = tab.dataset.metric;
      tabs.forEach((item) => item.classList.toggle('active', item === tab));
      renderMap();
    });
  });

  window.addEventListener('resize', () => chart.resize());
  renderMap();
})();
