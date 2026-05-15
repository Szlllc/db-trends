import React, { useEffect, useRef, useState } from 'react';
import mermaid from 'mermaid';

// 整体视觉缩放倍率（不改变字号配置，只改变渲染尺寸）
const SCALE = 0.65;

// mermaid 只需初始化一次（模块级，不在每次 render 时重复调用）
mermaid.initialize({
  startOnLoad: false,
  theme: 'default',
  securityLevel: 'loose',
  fontSize: 16,
  flowchart: { useMaxWidth: false, htmlLabels: true },
  sequence: { useMaxWidth: false },
});

// 稳定递增 ID，避免随机数在 HMR 时产生无意义的新 id
let _idCounter = 0;

export const MermaidWrapper: React.FC<{ chart: string }> = ({ chart }) => {
  const [svg, setSvg] = useState<string>('');
  const id = useRef(`mermaid-${++_idCounter}`);

  useEffect(() => {
    let active = true;
    mermaid.render(id.current, chart.trim())
      .then(({ svg: rendered }) => { if (active) setSvg(rendered); })
      .catch((err) => console.error('[MermaidWrapper] render error', err));
    return () => { active = false; };
  }, [chart]);

  return (
    <div className="flex justify-center my-6 overflow-x-auto bg-white p-4 border border-slate-200 rounded-sm shadow-sm">
      {svg ? (
        <div
          dangerouslySetInnerHTML={{ __html: svg }}
          style={{ zoom: SCALE, display: 'flex', justifyContent: 'center' }}
        />
      ) : (
        <div className="text-slate-400 font-mono text-sm py-4">Rendering diagram…</div>
      )}
    </div>
  );
};
