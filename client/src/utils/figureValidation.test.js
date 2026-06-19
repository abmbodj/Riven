import { describe, expect, it } from 'vitest';
import { validateMermaid, parsePlotSpec, parseChartSpec } from './figureValidation';

describe('validateMermaid', () => {
  it('accepts valid flowchart', () => {
    const result = validateMermaid('flowchart LR\n  A-->B');
    expect(result.ok).toBe(true);
    expect(result.value).toContain('flowchart');
  });

  it('accepts sequenceDiagram', () => {
    expect(validateMermaid('sequenceDiagram\n  A->>B: hello').ok).toBe(true);
  });

  it('rejects empty input', () => {
    expect(validateMermaid('').ok).toBe(false);
  });

  it('rejects unknown diagram type', () => {
    expect(validateMermaid('not a diagram type').ok).toBe(false);
  });

  it('strips fenced code markers before validating', () => {
    const result = validateMermaid('```mermaid\nflowchart LR\n  A-->B\n```');
    expect(result.ok).toBe(true);
  });

  it('repairs smart quotes', () => {
    const result = validateMermaid('flowchart LR\n  A[“Label”]-->B');
    expect(result.ok).toBe(true);
    expect(result.value).toContain('"Label"');
  });
});

describe('parsePlotSpec', () => {
  it('parses valid JSON plot spec', () => {
    const result = parsePlotSpec('{"fn":"x^2","domain":[-5,5]}');
    expect(result.ok).toBe(true);
    expect(result.value.data[0].fn).toBe('x^2');
    expect(result.value.domain).toEqual([-5, 5]);
  });

  it('parses DSL format', () => {
    const result = parsePlotSpec('fn=x^2; domain=-5,5');
    expect(result.ok).toBe(true);
    expect(result.value.data[0].fn).toBe('x^2');
  });

  it('rejects spec with no fn and no points', () => {
    expect(parsePlotSpec('{"title":"empty"}').ok).toBe(false);
  });

  it('rejects empty input', () => {
    expect(parsePlotSpec('').ok).toBe(false);
  });

  it('clamps extreme domain values', () => {
    const result = parsePlotSpec('{"fn":"x","domain":[-9999999,9999999]}');
    expect(result.ok).toBe(true);
    expect(result.value.domain[0]).toBeGreaterThanOrEqual(-10000);
    expect(result.value.domain[1]).toBeLessThanOrEqual(10000);
  });
});

describe('parseChartSpec', () => {
  const validSpec = '{"type":"bar","data":[{"year":"2020","gdp":10},{"year":"2021","gdp":12}],"xKey":"year","series":["gdp"]}';

  it('parses valid chart spec', () => {
    const result = parseChartSpec(validSpec);
    expect(result.ok).toBe(true);
    expect(result.value.type).toBe('bar');
    expect(result.value.series).toEqual(['gdp']);
  });

  it('infers series from first data row when omitted', () => {
    const spec = '{"type":"line","data":[{"x":1,"y":2}],"xKey":"x"}';
    const result = parseChartSpec(spec);
    expect(result.ok).toBe(true);
    expect(result.value.series).toEqual(['y']);
  });

  it('rejects empty data', () => {
    expect(parseChartSpec('{"type":"bar","data":[],"xKey":"x","series":["y"]}').ok).toBe(false);
  });

  it('rejects missing xKey', () => {
    expect(parseChartSpec('{"type":"bar","data":[{"x":1}],"series":["x"]}').ok).toBe(false);
  });

  it('rejects invalid JSON', () => {
    expect(parseChartSpec('not json').ok).toBe(false);
  });
});
