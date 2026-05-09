import React, { useEffect, useRef, useState } from 'react';
import mermaid from 'mermaid';

// 等比放大 SVG 尺寸，不改变字号
const SCALE = 1.6;

function scaleSvgDimensions(svgString: string, factor: number): string {
  // 只处理数值型的 width / height（跳过 "100%" 等百分比）
  return svgString
    .replace(/(\swidth=")(\d+(?:\.\d+)?)(")/,  (_, a, w, b) => `${a}${parseFloat(w) * factor}${b}`)
    .replace(/(\sheight=")(\d+(?:\.\d+)?)(")/,  (_, a, h, b) => `${a}${parseFloat(h) * factor}${b}`);
}

export const MermaidWrapper: React.FC<{ chart: string }> = ({ chart }) => {
  const [svg, setSvg] = useState<string>('');
  const id = useRef(`mermaid-${Math.random().toString(36).substring(7)}`);

  useEffect(() => {
    mermaid.initialize({
      startOnLoad: false,
      theme: 'default',
      securityLevel: 'loose',
      fontSize: 16,
      flowchart: { useMaxWidth: true, htmlLabels: true },
      sequence:  { useMaxWidth: true },
    });

    let isMounted = true;
    const renderChart = async () => {
      try {
        const { svg: renderedSvg } = await mermaid.render(id.current, chart);
        if (isMounted) {
          setSvg(scaleSvgDimensions(renderedSvg, SCALE));
        }
      } catch (err) {
        console.error('Mermaid render error', err);
      }
    };
    renderChart();

    return () => { isMounted = false; };
  }, [chart]);

  return (
    <div className="flex justify-center my-6 overflow-x-auto bg-white p-4 border border-slate-200 rounded-sm shadow-sm">
      {svg ? (
        <div dangerouslySetInnerHTML={{ __html: svg }} />
      ) : (
        <div className="text-slate-400 font-mono text-sm">Rendering Diagram...</div>
      )}
    </div>
  );
};
