import React, { useState, useEffect, useRef, useCallback } from 'react';
import { BookOpen, Target, GitMerge, FileCode, Menu, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import mdData from 'virtual:md-data';
import type { NavItem } from '../vite-plugin-md-data';
import { KnowledgeGraph } from './components/KnowledgeGraph';
import { MermaidWrapper } from './components/MermaidWrapper';

// 从虚拟模块解构数据（每次构建/HMR 时自动从 MD 文档重新解析）
const {
  prefaceData,
  introductionData,
  sec2_1Title,
  sec2_1Description,
  paperDeepDives,
  literatureEvolution,
  ch4Intro,
  algorithmReproduction,
  referencesData,
  glossaryData,
  navItems: mdNavItems,
} = mdData;

export function slugify(text: string) {
  if (!text) return '';
  return text.toLowerCase().replace(/\s+/g, '-').replace(/[^\w\u4e00-\u9fa5\-]/g, '');
}

// Custom Markdown Components for Consistent Styling
const MarkdownComponents: any = {
  h1: ({ children }: any) => {
    const text = String(children);
    if (text === '卷首语') {
      return (
        <div className="mb-8 pb-4 border-b border-slate-200">
          <h1 className="text-4xl md:text-5xl font-serif font-bold tracking-wider text-[#1a233a]">{children}</h1>
        </div>
      );
    }
    return (
      <div className="flex justify-center mt-16 mb-16">
        <div className="inline-flex flex-col items-center justify-center text-center">
          <h1 className="text-3xl md:text-4xl font-serif font-black tracking-widest text-[#1a233a]">{children}</h1>
          <div className="w-12 h-1 bg-[#1d4ed8] mt-6"></div>
        </div>
      </div>
    );
  },
  h2: ({ children }: any) => {
    const text = Array.isArray(children) ? children.join('') : String(children || '');
    const slug = slugify(text);
    return (
      <div id={slug} className="mt-16 mb-8 border-b border-slate-200 pb-3 scroll-mt-24">
        <h2 className="text-2xl md:text-3xl font-serif font-bold text-slate-900 border-l-4 border-blue-600 pl-4">{children}</h2>
      </div>
    );
  },
  h3: ({ children }: any) => (
    <h3 className="text-xl md:text-2xl font-bold text-[#1a233a] mt-10 mb-4 leading-snug break-words pl-3 border-l-2 border-blue-200">{children}</h3>
  ),
  h4: ({ children }: any) => (
    <h4 className="text-lg md:text-xl font-semibold text-slate-600 mt-8 mb-3 leading-snug break-words">{children}</h4>
  ),
  p: ({ children }: any) => {
    const isText = typeof children === 'string' || (Array.isArray(children) && children.length === 1 && typeof children[0] === 'string');
    const text = isText ? (Array.isArray(children) ? children[0] : children) : '';
    // 识别独立题注「图/表 X.Y <名词短语>」，与正文中的「表3.1给出了…」引用区分：
    //   1. 不以句号/叹号/问号结尾（排除作为句子主语的正文引用）
    //   2. 数字后不紧跟常见谓语动词（给/展/列/描/显/说/反/提/记/汇/所示）
    //   3. 长度合理（题注通常 ≤ 80 字）
    const isCaption =
      typeof text === 'string' &&
      /^(图|表)\s*\d+[.\-]\d+/.test(text) &&
      text.length < 80 &&
      !/[。！？]$/.test(text.trim()) &&
      !/\d+[.\-]\d+\s*(给|展|列|描|显|说|反|提|记|汇|所示|表示|表明)/.test(text);
    if (isCaption) {
      return <p className="text-center text-sm text-slate-500 mt-2 mb-8 font-serif italic">{children}</p>;
    }
    return <p className="text-slate-700 leading-relaxed mb-6 font-serif text-justify text-[1.05rem] break-words">{children}</p>
  },
  ul: ({ children, ...props }: any) => <ul {...props} className="list-disc list-outside ml-6 mb-6 space-y-2 text-slate-700 font-serif text-[1.05rem]">{children}</ul>,
  ol: ({ children, start, ...props }: any) => <ol start={start} {...props} className="list-decimal list-outside ml-6 mb-6 space-y-2 text-slate-700 font-serif text-[1.05rem]">{children}</ol>,
  li: ({ children, ...props }: any) => <li {...props} className="pl-1">{children}</li>,
  strong: ({ children }: any) => <strong className="font-bold text-slate-900 font-sans">{children}</strong>,
  a: ({ href, children }: any) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-blue-600 underline underline-offset-2 decoration-blue-300 hover:text-blue-800 hover:decoration-blue-600 transition-colors font-sans inline-flex items-baseline gap-0.5"
    >
      {children}
      <span className="text-[0.65em] ml-0.5 opacity-60 not-italic">↗</span>
    </a>
  ),
  blockquote: ({ children }: any) => <blockquote className="border-l-4 border-blue-500 bg-slate-50 pl-5 pr-4 py-3 text-slate-600 mb-6 font-serif rounded-r-sm shadow-sm [&>p:last-child]:mb-0">{children}</blockquote>,
  pre: ({ children }: any) => <div className="not-prose my-8">{children}</div>,
  code: ({ className, children, node, ...props }: any) => {
    const match = /language-(\w+)/.exec(className || '');
    const isInline = !match && node?.position?.start?.line === node?.position?.end?.line;

    if (match && match[1] === 'mermaid') {
      return <MermaidWrapper chart={String(children)} />;
    }

    if (!isInline && match) {
      return (
        <div className="rounded-md overflow-hidden border border-slate-200 shadow-sm block w-full">
          <div className="bg-[#1e293b] text-slate-300 text-[0.7rem] uppercase tracking-wider px-4 py-2.5 font-mono flex items-center justify-between">
            <span>{match[1] === 'math' ? 'MATH' : match[1]}</span>
          </div>
          <pre className="p-5 bg-slate-50 overflow-x-auto text-[0.85rem] text-slate-800 font-mono m-0 border-0 shadow-none leading-relaxed">
            <code className={className} {...props}>
              {children}
            </code>
          </pre>
        </div>
      );
    }

    return (
      <code className="bg-slate-100 text-[#0f172a] font-mono px-1.5 py-0.5 rounded text-[0.85em] border border-slate-200 shadow-sm" {...props}>
        {children}
      </code>
    );
  },
  img: ({ src, alt, title }: any) => (
    <figure className="my-10 flex flex-col items-center">
      <img src={src} alt={alt} className="max-w-full h-auto rounded-sm border border-slate-200 shadow-md" referrerPolicy="no-referrer" />
      {(alt && alt !== '') && <figcaption className="text-center text-sm text-slate-500 mt-4 font-serif italic max-w-2xl">{alt}</figcaption>}
    </figure>
  ),
  table: ({ children }: any) => (
    <div className="overflow-x-auto my-8 border rounded-lg border-slate-200 bg-white shadow-sm">
      <table className="w-full text-left border-collapse text-[0.95rem]">
        {children}
      </table>
    </div>
  ),
  thead: ({ children }: any) => <thead className="bg-[#f8fafc] border-b-2 border-slate-200">{children}</thead>,
  tbody: ({ children }: any) => <tbody className="divide-y divide-slate-100">{children}</tbody>,
  tr: ({ children }: any) => <tr className="hover:bg-blue-50/30 transition-colors">{children}</tr>,
  th: ({ children }: any) => <th className="px-6 py-4 font-bold text-[#1a233a] whitespace-nowrap">{children}</th>,
  td: ({ children }: any) => <td className="px-6 py-4 text-slate-700 leading-relaxed">{children}</td>,
  // 分割线（---）不渲染，避免章节间出现多余横线
  hr: () => null,
};

// ─── Shared helpers ────────────────────────────────────────────────────────────
const CARD_CLASS = "bg-white p-8 sm:p-12 lg:p-16 rounded-sm shadow-[0_20px_50px_rgba(0,0,0,0.1)] border border-slate-100";
const MOTION_PROPS = { initial: { opacity: 0, y: 20 }, whileInView: { opacity: 1, y: 0 }, viewport: { once: true as const } };

// 各篇论文的原文与双语翻译链接
// 如需在 MD 中管理这些链接，可在每个 ## 2.x 章节开头添加：
// <!-- paper-links: {"original":"url1","bilingual":"url2"} -->
// 当前保留此处作为后备（按论文顺序对应）
const PAPER_LINKS = [
  { original: 'http://tprd-outline.dameng.com/s/3848921f-db1a-4094-a568-cdf305b887a1/doc/6lwe5paz5rgh5oc7-BhyOkgCLK1#h-%E5%8F%8C%E8%AF%AD%E7%BF%BB%E8%AF%91', bilingual: 'http://tprd-outline.dameng.com/s/3848921f-db1a-4094-a568-cdf305b887a1/doc/6lwe5paz5rgh5oc7-BhyOkgCLK1#h-%E5%8F%8C%E8%AF%AD%E7%BF%BB%E8%AF%91' },
  { original: 'http://tprd-outline.dameng.com/s/3848921f-db1a-4094-a568-cdf305b887a1/doc/6lwe5paz5rgh5oc7-BhyOkgCLK1#h-%E8%AE%BA%E6%96%87%E5%8E%9F%E6%96%87-1', bilingual: 'http://tprd-outline.dameng.com/s/3848921f-db1a-4094-a568-cdf305b887a1/doc/6lwe5paz5rgh5oc7-BhyOkgCLK1#h-%E5%8F%8C%E8%AF%AD%E7%BF%BB%E8%AF%91-1' },
  { original: 'http://tprd-outline.dameng.com/s/3848921f-db1a-4094-a568-cdf305b887a1/doc/6lwe5paz5rgh5oc7-BhyOkgCLK1#h-%E8%AE%BA%E6%96%87%E5%8E%9F%E6%96%87-2', bilingual: 'http://tprd-outline.dameng.com/s/3848921f-db1a-4094-a568-cdf305b887a1/doc/6lwe5paz5rgh5oc7-BhyOkgCLK1#h-%E5%8F%8C%E8%AF%AD%E7%BF%BB%E8%AF%91-2' },
  { original: 'http://tprd-outline.dameng.com/s/3848921f-db1a-4094-a568-cdf305b887a1/doc/6lwe5paz5rgh5oc7-BhyOkgCLK1#h-%E8%AE%BA%E6%96%87%E5%8E%9F%E6%96%87-3', bilingual: 'http://tprd-outline.dameng.com/s/3848921f-db1a-4094-a568-cdf305b887a1/doc/6lwe5paz5rgh5oc7-BhyOkgCLK1#h-%E5%8F%8C%E8%AF%AD%E7%BF%BB%E8%AF%91-3' },
  { original: 'http://tprd-outline.dameng.com/s/3848921f-db1a-4094-a568-cdf305b887a1/doc/6lwe5paz5rgh5oc7-BhyOkgCLK1#h-%E8%AE%BA%E6%96%87%E5%8E%9F%E6%96%87-4', bilingual: 'http://tprd-outline.dameng.com/s/3848921f-db1a-4094-a568-cdf305b887a1/doc/6lwe5paz5rgh5oc7-BhyOkgCLK1#h-%E5%8F%8C%E8%AF%AD%E7%BF%BB%E8%AF%91-4' },
  { original: 'http://tprd-outline.dameng.com/s/3848921f-db1a-4094-a568-cdf305b887a1/doc/6lwe5paz5rgh5oc7-BhyOkgCLK1#h-%E8%AE%BA%E6%96%87%E5%8E%9F%E6%96%87-5', bilingual: 'http://tprd-outline.dameng.com/s/3848921f-db1a-4094-a568-cdf305b887a1/doc/6lwe5paz5rgh5oc7-BhyOkgCLK1#h-%E5%8F%8C%E8%AF%AD%E7%BF%BB%E8%AF%91-5' },
];

// 图标映射：将插件导出的图标名称字符串映射为 Lucide 组件
const ICON_MAP: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  BookOpen, Target, GitMerge, FileCode,
};

function MD({ children }: { children: string }) {
  return (
    <div className="markdown-body">
      <Markdown components={MarkdownComponents} remarkPlugins={[remarkGfm, remarkBreaks, remarkMath]} rehypePlugins={[rehypeKatex]}>
        {children}
      </Markdown>
    </div>
  );
}

export default function App() {
  const [activeSection, setActiveSection] = useState('preface');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(288);
  const [isResizing, setIsResizing] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const navScrollRef = useRef<HTMLDivElement>(null);

  // navItems 直接来自 MD 解析结果，无需硬编码
  const navItems: NavItem[] = mdNavItems;

  // ── 导航高亮：用 IntersectionObserver 追踪哪个 section 最靠近视口顶部 ──
  useEffect(() => {
    // 记录每个被观测元素当前的交叉信息
    const ratioMap = new Map<string, number>();

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          ratioMap.set(entry.target.id, entry.intersectionRatio);
        });

        // 在所有可见元素中，选取 boundingClientRect.top 最接近 0（视口顶部）且已进入视口的那个
        let bestId = '';
        let bestTop = Infinity;

        ratioMap.forEach((ratio, id) => {
          const el = document.getElementById(id);
          if (!el) return;
          const top = el.getBoundingClientRect().top;
          // 只考虑顶部还在视口内（top < 视口高度）且未完全滚过（top > -el.offsetHeight）的元素
          if (top <= window.innerHeight && top > -el.offsetHeight) {
            // 优先选 top 最接近 0 但仍 <= viewport 1/2 高度的元素
            const score = Math.abs(top - window.innerHeight * 0.15);
            if (score < bestTop) {
              bestTop = score;
              bestId = id;
            }
          }
        });

        if (bestId) setActiveSection(bestId);
      },
      {
        // 从视口顶部 -20% 到底部 -20% 的区间内触发，确保滚动时快速更新
        rootMargin: '-5% 0px -75% 0px',
        threshold: [0, 0.1, 0.5, 1.0],
      }
    );

    // 观测所有 navItems 对应的 DOM 元素
    navItems.forEach(({ id }) => {
      const el = document.getElementById(id);
      if (el) {
        ratioMap.set(id, 0);
        observer.observe(el);
      }
    });

    return () => observer.disconnect();
  }, [navItems]);


  const startResizing = () => setIsResizing(true);
  const stopResizing = () => setIsResizing(false);
  const resize = useCallback((e: MouseEvent) => {
    if (isResizing && e.clientX >= 240 && e.clientX <= 480) {
      setSidebarWidth(e.clientX);
    }
  }, [isResizing]);

  useEffect(() => {
    window.addEventListener("mousemove", resize);
    window.addEventListener("mouseup", stopResizing);
    return () => { window.removeEventListener("mousemove", resize); window.removeEventListener("mouseup", stopResizing); };
  }, [resize, stopResizing]);

  // ── activeSection 变化时，自动将对应导航条目滚动到侧边栏可见区域 ──────────
  useEffect(() => {
    if (!navScrollRef.current) return;
    const btn = navScrollRef.current.querySelector<HTMLElement>(
      `[data-nav-id="${activeSection}"]`
    );
    if (!btn) return;
    const container = navScrollRef.current;
    const btnTop = btn.offsetTop;
    const btnBot = btnTop + btn.offsetHeight;
    const cTop = container.scrollTop;
    const cBot = cTop + container.clientHeight;
    if (btnTop < cTop + 56) {
      container.scrollTo({ top: Math.max(0, btnTop - 56), behavior: 'smooth' });
    } else if (btnBot > cBot - 56) {
      container.scrollTo({ top: btnBot - container.clientHeight + 56, behavior: 'smooth' });
    }
  }, [activeSection]);

  const scrollTo = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      const y = element.getBoundingClientRect().top + window.scrollY - 80;
      window.scrollTo({ top: y, behavior: 'smooth' });
    }
    setIsMobileMenuOpen(false);
  };

  return (
    <div className="min-h-screen bg-[#F0F2F5] font-sans text-slate-900 selection:bg-blue-200">
      <div className="lg:hidden fixed top-0 left-0 right-0 h-16 bg-[#0B1120] border-b border-slate-800 z-50 flex items-center justify-between px-4">
        <span className="font-serif font-bold text-lg text-white tracking-widest">Yannakakis 专刊</span>
        <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="p-2 text-slate-300">
          {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      <AnimatePresence>
        {(isMobileMenuOpen || window.innerWidth >= 1024) && (
          <motion.nav
            ref={sidebarRef}
            initial={{ x: -300, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -300, opacity: 0 }}
            transition={{ type: 'spring', bounce: 0, duration: 0.4 }}
            style={{ width: window.innerWidth >= 1024 ? sidebarWidth : '100%' }}
            className={`fixed top-16 lg:top-0 left-0 bottom-0 bg-white border-r border-slate-200 z-40 shadow-xl lg:shadow-none flex flex-col ${isMobileMenuOpen ? 'w-72' : ''}`}
          >
            <div className="p-8 hidden lg:block border-b border-slate-100 flex-shrink-0">
              <h1 className="text-2xl font-serif font-black tracking-widest text-slate-900 leading-tight">
                Yannakakis<br />
                <span className="text-blue-700 text-lg tracking-normal font-sans font-bold">技术专刊</span>
              </h1>
            </div>

            <div ref={navScrollRef} className="px-4 py-6 overflow-y-auto overflow-x-hidden custom-scrollbar flex-1">
              <ul className="space-y-1">
                {navItems.map((item) => {
                  const isActive = activeSection === item.id;
                  const isSub = item.isSub;
                  return (
                    <li key={item.id}>
                      <button
                        data-nav-id={item.id}
                        onClick={() => scrollTo(item.id)}
                        className={`w-full text-left px-3 py-2.5 rounded-md text-sm transition-all duration-200 flex items-center gap-3
                          ${isSub ? 'ml-6 pl-4 border-l-2 text-xs' : 'font-bold tracking-wide'}
                          ${isActive
                            ? (isSub ? 'border-blue-600 text-blue-700 bg-blue-50/50 font-semibold' : 'bg-slate-900 text-white')
                            : (isSub ? 'border-slate-200 text-slate-500 hover:border-slate-400 hover:text-slate-800' : 'text-slate-700 hover:bg-slate-100')
                          }
                        `}
                      >
                        {!isSub && item.icon && (() => {
                          const IconComp = ICON_MAP[item.icon!];
                          return IconComp
                            ? <IconComp size={16} className={isActive ? 'text-blue-400' : 'text-slate-400'} />
                            : null;
                        })()}
                        <span className="truncate">{item.label}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>

            <div
              className="hidden lg:flex absolute top-0 right-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-400 transition-colors items-center justify-center group z-50"
              onMouseDown={startResizing}
            >
              <div className="h-8 w-1 bg-slate-300 rounded-full group-hover:bg-blue-500 transition-colors"></div>
            </div>
          </motion.nav>
        )}
      </AnimatePresence>

      <main
        className="pt-16 lg:pt-0 transition-[margin] duration-75 ease-out"
        style={{ marginLeft: window.innerWidth >= 1024 ? sidebarWidth : 0 }}
      >
        <div className="bg-[#0B1120] pt-20 pb-48 px-4 sm:px-8 lg:px-12 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-full overflow-hidden opacity-20 pointer-events-none">
            <div className="absolute -top-[20%] -right-[10%] w-[50%] h-[100%] rounded-full bg-blue-500 blur-[120px]"></div>
            <div className="absolute top-[40%] -left-[10%] w-[40%] h-[60%] rounded-full bg-indigo-500 blur-[100px]"></div>
          </div>

          <div className="max-w-5xl mx-auto relative z-10 text-center space-y-6">
            <div className="inline-block border-b border-slate-600 pb-2 mb-4">
              <p className="text-slate-400 tracking-[0.2em] text-sm uppercase font-medium font-sans">
                Ji Shu Zhuan Kan | 2026
              </p>
            </div>
            <h1 className="text-5xl sm:text-7xl font-serif font-black text-white tracking-wider">
              Yannakakis 技术专刊
            </h1>
            <div className="w-24 h-1 bg-blue-500 mx-auto mt-6 mb-8"></div>
            <p className="text-3xl text-slate-300 font-light tracking-wide font-sans">
              神级算法与现代数据库的再相遇
            </p>
          </div>
        </div>

        <div className="max-w-4xl mx-auto px-4 sm:px-8 lg:px-12 pb-24 -mt-32 relative z-20 space-y-16">

          <section id="preface" className="scroll-mt-24">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className={CARD_CLASS}
            >
              <div className="preface-content">
                <MD>{prefaceData}</MD>
              </div>
              <div id="introduction" className="my-10 w-full h-px bg-slate-200 scroll-mt-24" />
              <MD>{introductionData}</MD>
            </motion.div>
          </section>

          <section id="part2" className="scroll-mt-24">
            <div className="space-y-16">
              <section id="part2_1" className="scroll-mt-24">
                <div className={CARD_CLASS}>
                  <div className="flex justify-center mb-12">
                    <div className="inline-flex flex-col items-center justify-center text-center">
                      <h1 className="text-3xl md:text-4xl font-serif font-black tracking-widest text-[#1a233a]">二、论文精读</h1>
                      <div className="w-12 h-1 bg-[#1d4ed8] mt-6" />
                    </div>
                  </div>
                  <div className="mb-8 border-b border-slate-200 pb-3">
                    <h2 className="text-2xl md:text-3xl font-serif font-bold text-slate-900 border-l-4 border-blue-600 pl-4">2.1 {sec2_1Title}</h2>
                  </div>
                  {sec2_1Description && (
                    <p className="text-slate-700 leading-relaxed mb-8 font-serif text-[1.05rem]">
                      {sec2_1Description}
                    </p>
                  )}
                  <KnowledgeGraph />
                </div>
              </section>

              {paperDeepDives.map((paper, index) => (
                <motion.div
                  {...MOTION_PROPS}
                  key={paper.id}
                  id={paper.id}
                  className={`${CARD_CLASS} scroll-mt-24`}
                >
                  <div className="mb-8 border-b border-slate-200 pb-3">
                    <h2 className="text-2xl md:text-3xl font-serif font-bold text-slate-900 border-l-4 border-blue-600 pl-4">
                      2.{index + 2} {paper.title}
                    </h2>
                    {PAPER_LINKS[index] && (
                      <div className="mt-4 pl-4 flex items-center gap-5">
                        <a href={PAPER_LINKS[index].original} target="_blank" rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-800 hover:underline underline-offset-2 transition-colors font-sans">
                          <span className="text-base leading-none">🔗</span> 原论文文档
                        </a>
                        <span className="text-slate-200 select-none">|</span>
                        <a href={PAPER_LINKS[index].bilingual} target="_blank" rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-800 hover:underline underline-offset-2 transition-colors font-sans">
                          <span className="text-base leading-none">🔗</span> 双语翻译文档
                        </a>
                      </div>
                    )}
                  </div>
                  <MD>{paper.content}</MD>
                </motion.div>
              ))}
            </div>
          </section>

          <section id="part3" className="scroll-mt-24">
            <motion.div {...MOTION_PROPS} className={CARD_CLASS}>
              <MD>{literatureEvolution}</MD>
            </motion.div>
          </section>

          <section id="part4" className="scroll-mt-24">
            <motion.div {...MOTION_PROPS} className={`${CARD_CLASS} space-y-0`}>
              {ch4Intro && (
                <>
                  <MD>{ch4Intro}</MD>
                  <div className="my-10 w-full h-px bg-gradient-to-r from-transparent via-slate-200 to-transparent" />
                </>
              )}
              {Object.entries(algorithmReproduction)
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([key, section], i, arr) => (
                  <React.Fragment key={key}>
                    <MD>{String(section ?? '')}</MD>
                    {i < arr.length - 1 && (
                      <div className="my-10 w-full h-px bg-gradient-to-r from-transparent via-slate-200 to-transparent" />
                    )}
                  </React.Fragment>
                ))}
            </motion.div>
          </section>

          <section id="part5" className="scroll-mt-24">
            <motion.div {...MOTION_PROPS} className={CARD_CLASS}>
              <MD>{referencesData}</MD>
            </motion.div>
          </section>

          <section id="part6" className="scroll-mt-24">
            <motion.div {...MOTION_PROPS} className={CARD_CLASS}>
              <MD>{glossaryData}</MD>
            </motion.div>
          </section>

        </div>

        <footer className="bg-white border-t border-slate-200 py-8 text-center text-slate-500 text-sm font-sans">
          <p>Yannakakis 技术专刊 · 2026</p>
        </footer>
      </main>
    </div>
  );
}
