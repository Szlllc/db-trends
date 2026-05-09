import React, { useMemo } from 'react';
import ReactECharts from 'echarts-for-react';
import { knowledgeGraphData } from '../data';

export const KnowledgeGraph: React.FC = () => {
  const option = useMemo(() => {
    const nodes: any[] = [];
    const links: any[] = [];
    const categories = [
      { name: '论文' },
      { name: '作者' },
      { name: '机构' }
    ];

    const addedNodes = new Set();
    const degrees: Record<string, number> = {};
    
    // First pass to calculate degrees and add links
    knowledgeGraphData.forEach((paper: any) => {
      paper.authors.forEach((author: any) => {
        links.push({
          source: author.name,
          target: paper.paper_id,
        });
        degrees[author.name] = (degrees[author.name] || 0) + 1;
        degrees[paper.paper_id] = (degrees[paper.paper_id] || 0) + 1;

        if (author.institution) {
          const instNames = author.institution.split('、');
          instNames.forEach((instName: string) => {
            const instId = `inst-${instName}`;
            links.push({
              source: author.name,
              target: instId,
            });
            degrees[author.name] = (degrees[author.name] || 0) + 1;
            degrees[instId] = (degrees[instId] || 0) + 1;
          });
        }
      });
    });

    // Add nodes with dynamic sizing based on degree centrality
    knowledgeGraphData.forEach((paper: any) => {
      if (!addedNodes.has(paper.paper_id)) {
        nodes.push({
          id: paper.paper_id,
          name: paper.paper_id,
          category: 0,
          symbolSize: 30 + (degrees[paper.paper_id] || 0) * 8, // scale by degree
          value: paper.title,
          label: { show: true, position: 'inside' }
        });
        addedNodes.add(paper.paper_id);
      }

      paper.authors.forEach((author: any) => {
        if (!addedNodes.has(author.name)) {
          nodes.push({
            id: author.name,
            name: author.name,
            category: 1,
            symbolSize: 15 + (degrees[author.name] || 0) * 6, // scale by degree
            label: { show: true, position: 'right' },
            value: author.is_corresponding ? '通讯作者' : '作者'
          });
          addedNodes.add(author.name);
        }

        if (author.institution) {
          const instNames = author.institution.split('、');
          instNames.forEach((instName: string) => {
            const instId = `inst-${instName}`;
            if (!addedNodes.has(instId)) {
              nodes.push({
                id: instId,
                name: instName,
                category: 2,
                symbolSize: 20 + (degrees[instId] || 0) * 7, // scale by degree
                label: { show: true, position: 'bottom' }
              });
              addedNodes.add(instId);
            }
          });
        }
      });
    });

    return {
      tooltip: {
        formatter: (params: any) => {
          if (params.dataType === 'node') {
            if (params.data.category === 0) return `论文标题: ${params.data.value}`;
            return `${categories[params.data.category].name}: ${params.data.name}<br/>${params.data.value || ''}`;
          }
          return '';
        }
      },
      legend: [{
        data: categories.map(a => a.name)
      }],
      animationDuration: 1500,
      animationEasingUpdate: 'quinticInOut',
      series: [
        {
          name: 'Knowledge Graph',
          type: 'graph',
          layout: 'force',
          data: nodes,
          links: links,
          categories: categories,
          roam: true,
          label: {
            show: true,
            position: 'right',
            formatter: '{b}'
          },
          lineStyle: {
            color: 'source',
            curveness: 0.3
          },
          force: {
            repulsion: 1000,
            edgeLength: [50, 200],
            gravity: 0.1
          }
        }
      ]
    };
  }, []);

  return (
    <div className="w-full h-[600px] border border-slate-200 rounded-sm bg-white shadow-sm p-4">
      <ReactECharts option={option} style={{ height: '100%', width: '100%' }} />
    </div>
  );
};
