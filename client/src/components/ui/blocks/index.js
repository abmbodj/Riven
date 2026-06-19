import { lazy } from 'react';

/**
 * Lazy, code-split figure blocks. Importing these keeps mermaid / function-plot /
 * recharts out of the main bundle — they load only when a tutor card actually
 * contains a figure of that type.
 */
export const LazyMermaid = lazy(() => import('./MermaidBlock.jsx'));
export const LazyFunctionPlot = lazy(() => import('./FunctionPlotBlock.jsx'));
export const LazyDataChart = lazy(() => import('./DataChartBlock.jsx'));

export { default as BlockErrorBoundary } from './BlockErrorBoundary.jsx';
