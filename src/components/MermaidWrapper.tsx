import React, { useEffect, useRef, useState } from 'react';
import mermaid from 'mermaid';

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
          setSvg(renderedSvg);
        }
      } catch (err) {
        console.error('Mermaid render error', err);
        // Sometimes mermaid errors insert a fallback SVG into the DOM manually,
        // we can ignore or let it be.
      }
    };
    renderChart();
    
    return () => {
      isMounted = false;
    };
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
