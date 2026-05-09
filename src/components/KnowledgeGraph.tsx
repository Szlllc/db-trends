import React, { useMemo, useRef, useCallback, useEffect } from 'react';
import ReactECharts from 'echarts-for-react';
import { knowledgeGraphData } from '../data';

const COLORS = {
  paper:       '#3b82f6',
  author:      '#10b981',
  corresponding: '#06d6a0',
  institution: '#f59e0b',
};
const INITIAL_ZOOM = 0.85;

export const KnowledgeGraph: React.FC = () => {
  const echartsRef  = useRef<ReactECharts>(null);
  const zoomRef     = useRef(INITIAL_ZOOM);
  const isDragging  = useRef(false);
  const lastPos     = useRef({ x: 0, y: 0 });

  // ── 图谱数据 ─────────────────────────────────────────────────────────────
  const { nodes, links, categories } = useMemo(() => {
    const nodes: any[] = [], links: any[] = [];
    const added = new Set<string>();
    const deg: Record<string, number> = {};
    const categories = ['论文', '作者', '机构'].map(n => ({ name: n }));

    knowledgeGraphData.forEach((p: any) => {
      p.authors.forEach((a: any) => {
        links.push({ source: a.name, target: p.paper_id });
        deg[a.name]    = (deg[a.name]    || 0) + 1;
        deg[p.paper_id] = (deg[p.paper_id] || 0) + 1;
        (a.institution?.split('、') ?? []).forEach((inst: string) => {
          const iid = `inst-${inst}`;
          links.push({ source: a.name, target: iid });
          deg[a.name] = (deg[a.name] || 0) + 1;
          deg[iid]    = (deg[iid]    || 0) + 1;
        });
      });
    });

    knowledgeGraphData.forEach((p: any) => {
      if (!added.has(p.paper_id)) {
        nodes.push({ id: p.paper_id, name: p.paper_id, category: 0,
          symbolSize: 34 + (deg[p.paper_id] || 0) * 7, value: p.title,
          itemStyle: { color: COLORS.paper, shadowBlur: 10, shadowColor: 'rgba(59,130,246,0.35)' },
          label: { show: true, position: 'inside', fontSize: 11, fontWeight: 'bold', color: '#fff' },
        });
        added.add(p.paper_id);
      }
      p.authors.forEach((a: any) => {
        if (!added.has(a.name)) {
          nodes.push({ id: a.name, name: a.name, category: 1,
            symbolSize: 18 + (deg[a.name] || 0) * 5, value: a.is_corresponding ? '通讯作者' : '作者',
            itemStyle: { color: a.is_corresponding ? COLORS.corresponding : COLORS.author,
              borderWidth: a.is_corresponding ? 2.5 : 0, borderColor: '#fff' },
            label: { show: true, position: 'right', fontSize: 11, color: '#334155' },
          });
          added.add(a.name);
        }
        (a.institution?.split('、') ?? []).forEach((inst: string) => {
          const iid = `inst-${inst}`;
          if (!added.has(iid)) {
            nodes.push({ id: iid, name: inst, category: 2, symbol: 'roundRect',
              symbolSize: 22 + (deg[iid] || 0) * 6,
              itemStyle: { color: COLORS.institution, borderRadius: 6 },
              label: { show: true, position: 'bottom', fontSize: 11, color: '#92400e' },
            });
            added.add(iid);
          }
        });
      });
    });
    return { nodes, links, categories };
  }, []);

  const option = useMemo(() => ({
    backgroundColor: 'transparent',
    tooltip: {
      backgroundColor: 'rgba(15,23,42,0.9)',
      borderColor: '#334155', borderWidth: 1,
      textStyle: { color: '#f1f5f9', fontSize: 13 },
      formatter: (params: any) => {
        if (params.dataType !== 'node') return '';
        const cat = ['论文', '作者', '机构'][params.data.category];
        const sub = params.data.value ? `<br/><span style="color:#94a3b8">${params.data.value}</span>` : '';
        return `<b>${params.data.name}</b>${sub}<br/><span style="color:#64748b;font-size:11px">${cat}</span>`;
      },
    },
    animationDuration: 1800,
    animationEasingUpdate: 'quinticInOut',
    series: [{
      name: 'kg', type: 'graph', layout: 'force',
      data: nodes, links, categories,
      roam: true, zoom: INITIAL_ZOOM,
      label: { show: true, position: 'right', formatter: '{b}', fontSize: 11, color: '#334155' },
      edgeSymbol: ['none', 'arrow'], edgeSymbolSize: [0, 7],
      lineStyle: { color: '#94a3b8', width: 1.2, curveness: 0.2, opacity: 0.55 },
      emphasis: { focus: 'adjacency', lineStyle: { width: 2.5, opacity: 1 }, label: { fontWeight: 'bold' } },
      force: { repulsion: 1400, edgeLength: [80, 240], gravity: 0.08, friction: 0.6, layoutAnimation: true },
    }],
  }), [nodes, links, categories]);

  // ── 缩放按钮：用 setOption 跟踪 zoom，稳定可靠 ──────────────────────────
  const applyZoom = useCallback((factor: number) => {
    const inst = echartsRef.current?.getEchartsInstance();
    if (!inst) return;
    zoomRef.current = Math.max(0.1, Math.min(8, zoomRef.current * factor));
    inst.setOption({ series: [{ zoom: zoomRef.current }] });
  }, []);

  const handleReset = useCallback(() => {
    const inst = echartsRef.current?.getEchartsInstance();
    if (!inst) return;
    zoomRef.current = INITIAL_ZOOM;
    inst.setOption({ series: [{ zoom: INITIAL_ZOOM }] });
  }, []);

  // ── 全区域拖拽：监听 canvas 原生事件，转为 ECharts graphRoam ────────────
  useEffect(() => {
    // 等 chart 初始化完成后获取 canvas DOM
    const timer = setTimeout(() => {
      const inst = echartsRef.current?.getEchartsInstance();
      if (!inst) return;
      // @ts-ignore – getZr() 是 ECharts 内部 API，稳定可用
      const zr = inst.getZr();
      const dom = (zr as any).painter?.getViewportRoot?.() as HTMLElement | undefined;
      const canvas = dom ?? (inst.getDom()?.querySelector('canvas') as HTMLElement | undefined);
      if (!canvas) return;

      const onDown = (e: MouseEvent) => {
        isDragging.current = true;
        lastPos.current = { x: e.clientX, y: e.clientY };
        canvas.style.cursor = 'grabbing';
        e.preventDefault();
      };
      const onMove = (e: MouseEvent) => {
        if (!isDragging.current) return;
        const dx = e.clientX - lastPos.current.x;
        const dy = e.clientY - lastPos.current.y;
        lastPos.current = { x: e.clientX, y: e.clientY };
        inst.dispatchAction({ type: 'graphRoam', seriesIndex: 0, dx, dy });
        e.preventDefault();
      };
      const onUp = () => {
        isDragging.current = false;
        canvas.style.cursor = 'grab';
      };

      canvas.addEventListener('mousedown', onDown);
      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup',   onUp);
      canvas.style.cursor = 'grab';

      return () => {
        canvas.removeEventListener('mousedown', onDown);
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseup',   onUp);
      };
    }, 800); // force layout 稳定后再绑定

    return () => clearTimeout(timer);
  }, []);

  // ── 渲染 ─────────────────────────────────────────────────────────────────
  return (
    <div className="w-full rounded-sm border border-slate-200 bg-white shadow-sm overflow-hidden">
      {/* 工具栏 */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-100 bg-slate-50">
        <span className="text-xs text-slate-500 font-sans select-none">
          拖拽平移 · 滚轮缩放 · 点击节点高亮邻居
        </span>
        <div className="flex items-center gap-1.5">
          {([['＋','放大',() => applyZoom(1.3)],['－','缩小',() => applyZoom(1/1.3)],['⊙','恢复默认',handleReset]] as const).map(([label, title, onClick]) => (
            <button key={title} title={title} onClick={onClick}
              className="w-7 h-7 rounded border border-slate-200 bg-white text-slate-600 hover:bg-blue-50 hover:border-blue-300 hover:text-blue-600 text-base leading-none flex items-center justify-center transition-colors font-sans shadow-sm select-none">
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* 图谱 */}
      <div className="h-[640px]">
        <ReactECharts ref={echartsRef} option={option}
          style={{ height: '100%', width: '100%' }}
          opts={{ renderer: 'canvas' }} />
      </div>

      {/* 图例 */}
      <div className="px-4 py-2 border-t border-slate-100 bg-slate-50 flex items-center gap-4 flex-wrap">
        {([
          [COLORS.paper,        '论文节点'],
          [COLORS.author,       '作者节点'],
          [COLORS.corresponding,'通讯作者'],
          [COLORS.institution,  '机构节点'],
        ] as const).map(([color, label]) => (
          <span key={label} className="flex items-center gap-1.5 text-xs text-slate-500 font-sans">
            <span className="inline-block w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: color }} />
            {label}
          </span>
        ))}
        <span className="ml-auto text-xs text-slate-400 font-sans">节点大小 = 连接数（度中心性）</span>
      </div>
    </div>
  );
};
