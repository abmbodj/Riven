import React, { useEffect, useId, useRef, useState } from 'react';
import { useMobileVisualBudget } from '../../../hooks/useMobileVisualBudget.js';
import { validateMermaid } from '../../../utils/figureValidation.js';

let mermaidPromise = null;
const loadMermaid = async () => {
  if (!mermaidPromise) {
    mermaidPromise = import('mermaid').then(({ default: mermaid }) => {
      mermaid.initialize({
        startOnLoad: false,
        theme: 'dark',
        securityLevel: 'strict',
        flowchart: { useMaxWidth: true },
      });
      return mermaid;
    });
  }
  return mermaidPromise;
};

/**
 * Renders an AI-emitted Mermaid diagram to SVG. Heavy `mermaid` lib is loaded
 * lazily on first use. On a constrained visual budget the diagram is gated behind
 * a tap so it doesn't jank low-end devices.
 */
const MermaidBlock = ({ code }) => {
  const constrained = useMobileVisualBudget();
  const [svg, setSvg] = useState('');
  const [error, setError] = useState(false);
  const [show, setShow] = useState(!constrained);
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const mountedRef = useRef(true);

  const check = validateMermaid(code);

  useEffect(() => () => { mountedRef.current = false; }, []);

  useEffect(() => {
    if (!show || !check.ok) return;
    let cancelled = false;
    (async () => {
      try {
        const mermaid = await loadMermaid();
        await mermaid.parse(check.value);
        const { svg: rendered } = await mermaid.render(`mermaid-${uid}`, check.value);
        if (!cancelled && mountedRef.current) setSvg(rendered);
      } catch {
        if (!cancelled && mountedRef.current) setError(true);
      }
    })();
    return () => { cancelled = true; };
  }, [show, check.ok, check.value, uid]);

  if (!check.ok || error) {
    return (
      <div className="subject-figure-fallback" role="img" aria-label="Diagram unavailable">
        <span className="subject-figure-fallback__caption">Diagram unavailable</span>
        <pre className="subject-code-block"><code>{check.value || code}</code></pre>
      </div>
    );
  }

  if (!show) {
    return (
      <button type="button" className="subject-figure-placeholder" onClick={() => setShow(true)}>
        Show diagram
      </button>
    );
  }

  if (!svg) {
    return <div className="subject-figure-skeleton" aria-hidden="true" />;
  }

  return <div className="subject-mermaid" dangerouslySetInnerHTML={{ __html: svg }} />;
};

export default MermaidBlock;
