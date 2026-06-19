import React from 'react';
import {
  ResponsiveContainer,
  LineChart, Line,
  BarChart, Bar,
  AreaChart, Area,
  ScatterChart, Scatter,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts';
import { useMobileVisualBudget } from '../../../hooks/useMobileVisualBudget.js';
import { parseChartSpec } from '../../../utils/figureValidation.js';

const SERIES_COLORS = ['#deb96a', '#79ad75', '#8ea9a0', '#d59678', '#c5b56d', '#8fb27c'];

/**
 * Renders an AI-emitted data chart (line/bar/area/scatter) via recharts. This
 * whole module is lazy-loaded so recharts stays out of the main bundle.
 */
const DataChartBlock = ({ spec }) => {
  const constrained = useMobileVisualBudget();
  const parsed = parseChartSpec(spec);

  if (!parsed.ok) {
    return (
      <div className="subject-figure-fallback" role="img" aria-label="Chart unavailable">
        <span className="subject-figure-fallback__caption">Chart unavailable</span>
        <pre className="subject-code-block"><code>{String(spec)}</code></pre>
      </div>
    );
  }

  const { type, data, xKey, series, title } = parsed.value;
  const common = {
    data,
    margin: { top: 8, right: 12, bottom: 8, left: 0 },
  };
  const animate = !constrained;
  const axisProps = { stroke: '#a89c86', tick: { fill: '#cdbfa6', fontSize: 11 } };

  const renderSeries = (Comp, extra = {}) => series.map((key, i) => (
    <Comp
      key={key}
      type="monotone"
      dataKey={key}
      name={key}
      stroke={SERIES_COLORS[i % SERIES_COLORS.length]}
      fill={SERIES_COLORS[i % SERIES_COLORS.length]}
      isAnimationActive={animate}
      {...extra}
    />
  ));

  let chart;
  if (type === 'bar') {
    chart = (
      <BarChart {...common}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
        <XAxis dataKey={xKey} {...axisProps} />
        <YAxis {...axisProps} />
        <Tooltip contentStyle={{ background: '#243f33', border: 'none', borderRadius: 8, color: '#e8dcc8' }} />
        {series.length > 1 ? <Legend /> : null}
        {renderSeries(Bar)}
      </BarChart>
    );
  } else if (type === 'area') {
    chart = (
      <AreaChart {...common}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
        <XAxis dataKey={xKey} {...axisProps} />
        <YAxis {...axisProps} />
        <Tooltip contentStyle={{ background: '#243f33', border: 'none', borderRadius: 8, color: '#e8dcc8' }} />
        {series.length > 1 ? <Legend /> : null}
        {renderSeries(Area, { fillOpacity: 0.25 })}
      </AreaChart>
    );
  } else if (type === 'scatter') {
    chart = (
      <ScatterChart {...common}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
        <XAxis dataKey={xKey} {...axisProps} />
        <YAxis {...axisProps} />
        <Tooltip contentStyle={{ background: '#243f33', border: 'none', borderRadius: 8, color: '#e8dcc8' }} />
        {series.length > 1 ? <Legend /> : null}
        {series.map((key, i) => (
          <Scatter key={key} dataKey={key} name={key} fill={SERIES_COLORS[i % SERIES_COLORS.length]} isAnimationActive={animate} />
        ))}
      </ScatterChart>
    );
  } else {
    chart = (
      <LineChart {...common}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
        <XAxis dataKey={xKey} {...axisProps} />
        <YAxis {...axisProps} />
        <Tooltip contentStyle={{ background: '#243f33', border: 'none', borderRadius: 8, color: '#e8dcc8' }} />
        {series.length > 1 ? <Legend /> : null}
        {renderSeries(Line, { dot: false, strokeWidth: 2 })}
      </LineChart>
    );
  }

  return (
    <div className="subject-chart">
      {title ? <div className="subject-figure-title">{title}</div> : null}
      <ResponsiveContainer width="100%" height={220}>
        {chart}
      </ResponsiveContainer>
    </div>
  );
};

export default DataChartBlock;
