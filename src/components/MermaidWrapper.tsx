import React, { useEffect, useRef, useState } from 'react';
import mermaid from 'mermaid';

// 整体视觉缩放倍率（不改变字号配置，只改变渲染尺寸）
const SCALE = 0.65;

export const MermaidWrapper: React.FC<{ chart: string }> = ({ chart }) => {
  const [svg, setSvg] = useState<string>('');
  const id = useRef(`mermaid-${Math.random().toString(36).substring(7)}`);

  useEffect(() => {
    mermaid.initialize({
      startOnLoad: false,
      theme: 'default',
      securityLevel: 'loose',
      fontSize: 16,
      // useMaxWidth: false → mermaid 输出固定像素宽高，便于 zoom 生效
      flowchart: { useMaxWidth: false, htmlLabels: true },
      sequence: { useMaxWidth: false },
    });

    let isMounted = true;
    const renderChart = async () => {
      try {
        const { svg: renderedSvg } = await mermaid.render(id.current, chart);
        if (isMounted) setSvg(renderedSvg);
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
        // zoom 属性会对整个 SVG 做等比视觉放大，同时保留正确的布局空间
        <div
          dangerouslySetInnerHTML={{ __html: svg }}
          style={{ zoom: SCALE, display: 'flex', justifyContent: 'center' }}
        />
      ) : (
        <div className="text-slate-400 font-mono text-sm">Rendering Diagram...</div>
      )}
    </div>
  );
};
