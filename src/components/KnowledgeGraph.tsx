import React, { useMemo, useRef, useCallback } from 'react';
import ReactECharts from 'echarts-for-react';
import { knowledgeGraphData } from '../data';

// ── 调色板 ──────────────────────────────────────────────────────────────────
const COLORS = {
  paper:       '#3b82f6', // blue-500
  author:      '#10b981', // emerald-500
  institution: '#f59e0b', // amber-500
  edge:        '#94a3b8', // slate-400
};

const CATEGORY_NAMES = ['论文', '作者', '机构'];

export const KnowledgeGraph: React.FC = () => {
  const chartRef = useRef<any>(null);

  // ── 数据构建 ─────────────────────────────────────────────────────────────
  const { nodes, links, categories } = useMemo(() => {
    const nodes: any[] = [];
    const links: any[] = [];
    const addedNodes = new Set<string>();
    const degrees: Record<string, number> = {};

    const categories = CATEGORY_NAMES.map(name => ({ name }));

    // 第一遍：计算度数 & 收集边
    knowledgeGraphData.forEach((paper: any) => {
      paper.authors.forEach((author: any) => {
        const pid = paper.paper_id;
        links.push({ source: author.name, target: pid });
        degrees[author.name] = (degrees[author.name] || 0) + 1;
        degrees[pid]         = (degrees[pid]         || 0) + 1;

        (author.institution?.split('、') ?? []).forEach((inst: string) => {
          const iid = `inst-${inst}`;
          links.push({ source: author.name, target: iid });
          degrees[author.name] = (degrees[author.name] || 0) + 1;
          degrees[iid]         = (degrees[iid]         || 0) + 1;
        });
      });
    });

    // 第二遍：添加节点
    knowledgeGraphData.forEach((paper: any) => {
      if (!addedNodes.has(paper.paper_id)) {
        const sz = 34 + (degrees[paper.paper_id] || 0) * 7;
        nodes.push({
          id: paper.paper_id,
          name: paper.paper_id,
          category: 0,
          symbolSize: sz,
          value: paper.title,
          itemStyle: { color: COLORS.paper, shadowBlur: 12, shadowColor: 'rgba(59,130,246,0.4)' },
          label: { show: true, position: 'inside', fontSize: 11, fontWeight: 'bold', color: '#fff' },
        });
        addedNodes.add(paper.paper_id);
      }

      paper.authors.forEach((author: any) => {
        if (!addedNodes.has(author.name)) {
          const sz = 18 + (degrees[author.name] || 0) * 5;
          nodes.push({
            id: author.name,
            name: author.name,
            category: 1,
            symbolSize: sz,
            value: author.is_corresponding ? '通讯作者' : '作者',
            itemStyle: {
              color: author.is_corresponding ? '#06d6a0' : COLORS.author,
              borderWidth: author.is_corresponding ? 2.5 : 0,
              borderColor: '#fff',
            },
            label: { show: true, position: 'right', fontSize: 11, color: '#334155' },
          });
          addedNodes.add(author.name);
        }

        (author.institution?.split('、') ?? []).forEach((inst: string) => {
          const iid = `inst-${inst}`;
          if (!addedNodes.has(iid)) {
            const sz = 22 + (degrees[iid] || 0) * 6;
            nodes.push({
              id: iid,
              name: inst,
              category: 2,
              symbolSize: sz,
              value: '',
              symbol: 'roundRect',
              itemStyle: { color: COLORS.institution, borderRadius: 6 },
              label: { show: true, position: 'bottom', fontSize: 11, color: '#92400e' },
            });
            addedNodes.add(iid);
          }
        });
      });
    });

    return { nodes, links, categories };
  }, []);

  // ── ECharts option ────────────────────────────────────────────────────────
  const option = useMemo(() => ({
    backgroundColor: 'transparent',
    tooltip: {
      backgroundColor: 'rgba(15,23,42,0.88)',
      borderColor: '#334155',
      borderWidth: 1,
      textStyle: { color: '#f1f5f9', fontSize: 13, fontFamily: 'sans-serif' },
      formatter: (params: any) => {
        if (params.dataType !== 'node') return '';
        const cat = CATEGORY_NAMES[params.data.category];
        const sub = params.data.value ? `<br/><span style="color:#94a3b8">${params.data.value}</span>` : '';
        return `<b>${params.data.name}</b>${sub}<br/><span style="color:#64748b;font-size:11px">${cat}</span>`;
      },
    },
    legend: [{
      data: CATEGORY_NAMES,
      bottom: 12,
      itemWidth: 12,
      itemHeight: 12,
      textStyle: { color: '#475569', fontSize: 12, fontFamily: 'sans-serif' },
      icon: 'circle',
    }],
    animationDuration: 1800,
    animationEasingUpdate: 'quinticInOut',
    series: [{
      name: 'Knowledge Graph',
      type: 'graph',
      layout: 'force',
      data: nodes,
      links: links,
      categories,
      // roam: true 允许滚轮缩放 + 拖拽平移
      roam: true,
      // 初始缩放：让所有节点都可见
      zoom: 0.85,
      center: ['50%', '50%'],
      label: {
        show: true,
        position: 'right',
        formatter: '{b}',
        fontSize: 11,
        fontFamily: 'sans-serif',
        color: '#334155',
      },
      edgeSymbol: ['none', 'arrow'],
      edgeSymbolSize: [0, 7],
      lineStyle: {
        color: COLORS.edge,
        width: 1.2,
        curveness: 0.2,
        opacity: 0.6,
      },
      emphasis: {
        focus: 'adjacency',        // hover 节点时高亮邻居
        lineStyle: { width: 2.5, opacity: 1 },
        label: { fontWeight: 'bold' },
      },
      force: {
        repulsion: 1400,          // 增大斥力，避免节点重叠
        edgeLength: [80, 240],    // 边长范围
        gravity: 0.08,            // 较小重力，让节点分散
        friction: 0.6,
        layoutAnimation: true,
      },
    }],
  }), [nodes, links, categories]);

  // ── 控制按钮回调 ──────────────────────────────────────────────────────────
  const getChart = useCallback(() => chartRef.current?.getEchartsInstance(), []);

  const handleZoomIn = useCallback(() => {
    const chart = getChart();
    if (!chart) return;
    chart.dispatchAction({ type: 'graphRoam', zoom: 1.25 });
  }, [getChart]);

  const handleZoomOut = useCallback(() => {
    const chart = getChart();
    if (!chart) return;
    chart.dispatchAction({ type: 'graphRoam', zoom: 0.8 });
  }, [getChart]);

  const handleReset = useCallback(() => {
    const chart = getChart();
    if (!chart) return;
    // 重置到初始视野
    chart.dispatchAction({ type: 'graphRoam', zoom: 0.85 });
    chart.dispatchAction({ type: 'restore' });
  }, [getChart]);

  // ── 渲染 ─────────────────────────────────────────────────────────────────
  return (
    <div className="w-full rounded-sm border border-slate-200 bg-white shadow-sm overflow-hidden">
      {/* 工具栏 */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-100 bg-slate-50">
        <span className="text-xs text-slate-500 font-sans select-none">
          滚轮缩放 · 拖拽平移 · 点击节点高亮邻居
        </span>
        <div className="flex items-center gap-1.5">
          {[
            { label: '＋', title: '放大', onClick: handleZoomIn },
            { label: '－', title: '缩小', onClick: handleZoomOut },
            { label: '⊙', title: '恢复默认', onClick: handleReset },
          ].map(({ label, title, onClick }) => (
            <button
              key={title}
              title={title}
              onClick={onClick}
              className="w-7 h-7 rounded border border-slate-200 bg-white text-slate-600 hover:bg-blue-50 hover:border-blue-300 hover:text-blue-600 text-base leading-none flex items-center justify-center transition-colors font-sans shadow-sm"
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* 图谱主体 */}
      <div className="h-[640px] p-2">
        <ReactECharts
          ref={chartRef}
          option={option}
          style={{ height: '100%', width: '100%' }}
          opts={{ renderer: 'svg' }}  // SVG renderer 文字更清晰
        />
      </div>

      {/* 底部说明 */}
      <div className="px-4 py-2 border-t border-slate-100 bg-slate-50 flex items-center gap-4 flex-wrap">
        {[
          { color: COLORS.paper,       label: '论文节点' },
          { color: COLORS.author,      label: '作者节点' },
          { color: '#06d6a0',          label: '通讯作者' },
          { color: COLORS.institution, label: '机构节点' },
        ].map(({ color, label }) => (
          <span key={label} className="flex items-center gap-1.5 text-xs text-slate-500 font-sans">
            <span className="inline-block w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: color }} />
            {label}
          </span>
        ))}
        <span className="ml-auto text-xs text-slate-400 font-sans">
          节点大小 = 连接数（度中心性）
        </span>
      </div>
    </div>
  );
};
