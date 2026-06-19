import React, { useEffect, useRef, useState } from 'react';
import { useMobileVisualBudget } from '../../../hooks/useMobileVisualBudget.js';
import { parsePlotSpec } from '../../../utils/figureValidation.js';

/**
 * Renders an AI-emitted function graph via `function-plot` (lazy-loaded). Spec is
 * JSON (`{"fn":"x^2","domain":[-5,5]}`) or a small DSL; see parsePlotSpec.
 */
const FunctionPlotBlock = ({ spec }) => {
  const constrained = useMobileVisualBudget();
  const ref = useRef(null);
  const [error, setError] = useState(false);
  const parsed = parsePlotSpec(spec);

  useEffect(() => {
    if (!parsed.ok || !ref.current) return undefined;
    let cancelled = false;
    const el = ref.current;
    (async () => {
      try {
        const { default: functionPlot } = await import('function-plot');
        if (cancelled || !el) return;
        el.innerHTML = '';
        const width = el.clientWidth || 320;
        functionPlot({
          target: el,
          width,
          height: Math.round(width * 0.62),
          grid: true,
          disableZoom: constrained,
          xAxis: parsed.value.domain ? { domain: parsed.value.domain } : {},
          data: parsed.value.data,
        });
      } catch {
        if (!cancelled) setError(true);
      }
    })();
    return () => { cancelled = true; if (el) el.innerHTML = ''; };
  // parsed.value is derived from spec; listing spec is sufficient
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parsed.ok, spec, constrained]);

  if (!parsed.ok || error) {
    return (
      <div className="subject-figure-fallback" role="img" aria-label="Graph unavailable">
        <span className="subject-figure-fallback__caption">Graph unavailable</span>
        <pre className="subject-code-block"><code>{String(spec)}</code></pre>
      </div>
    );
  }

  return (
    <div className="subject-plot">
      {parsed.value.title ? <div className="subject-figure-title">{parsed.value.title}</div> : null}
      <div ref={ref} className="subject-plot__canvas" />
    </div>
  );
};

export default FunctionPlotBlock;
