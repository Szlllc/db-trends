/**
 * vite-plugin-md-data.ts
 *
 * 图片说明：MD 中图片路径为 attachments/UUID.png
 * 插件在 dev 时拦截 /attachments/ 请求，直接从项目根目录的 attachments/ 提供文件。
 * 构建时自动将 attachments/ 目录复制到 dist/attachments/。
 * 无需修改 MD 文件中的图片路径，也无需建立 figures/ 目录。
 *
 * Vite 虚拟模块插件：将 Markdown 文档实时解析为网页所需的结构化数据。
 *
 * ─────────────────────────────────────────────────────────
 *  如何修改 MD 文件名/路径？
 *  在 vite.config.ts 中修改 MD_SOURCE_FILE 常量即可，例如：
 *    export const MD_SOURCE_FILE = 'my-new-document.md';
 * ─────────────────────────────────────────────────────────
 *
 * 解析规则：
 *  - 图片路径：统一将 attachments/ → figures/（无需修改 MD 文件）
 *  - H1 边界：仅识别正文行（不在代码块内）中以 `# ` 开头的行作为章节边界
 *  - H2 边界：同上，以 `## ` 开头的行
 *  - 章节识别：通过关键词匹配，对结构变化有一定容错性
 */

import { readFileSync, readdirSync, copyFileSync, mkdirSync, existsSync } from 'fs';
import path from 'path';
import { Plugin } from 'vite';

// ────────────────────────────────────────────────────────────
//  类型定义
// ────────────────────────────────────────────────────────────
export interface NavItem {
  id: string;
  label: string;
  icon?: string;   // 图标名称，由 App.tsx 映射为实际组件
  isSub?: boolean;
}

export interface PaperDeepDive {
  id: string;
  title: string;
  content: string;
}

export interface MdData {
  prefaceData: string;
  introductionData: string;
  knowledgeGraphData: unknown[];
  sec2_1Title: string;
  sec2_1Description: string;
  paperDeepDives: PaperDeepDive[];
  literatureEvolution: string;
  algorithmReproduction: Record<string, string>;
  referencesData: string;
  glossaryData: string;
  navItems: NavItem[];
}

// ────────────────────────────────────────────────────────────
//  工具函数
// ────────────────────────────────────────────────────────────

/** 将标题文本转换为 URL 友好的 slug ID（与 App.tsx 中原有逻辑一致） */
export function slugify(text: string): string {
  if (!text) return '';
  return text.toLowerCase().replace(/\s+/g, '-').replace(/[^\w\u4e00-\u9fa5\-]/g, '');
}

/**
 * 预处理 Markdown 文本：
 * 1. 不替换 attachments/ 路径（直接 serve attachments/ 目录）
 * 2. 将字面量 \n 转义序列（2个字符 \ + n）替换为真实换行
 * 3. 为 CJK 字符与 ** 之间插入零宽空格，修复 CommonMark 加粗解析
 */
function preprocessMd(raw: string): string {
  return raw
    // 字面量 \n（两字符）→ 真实换行
    .replace(/\\n/g, '\n')
    // CJK 紧邻 ** 时插入零宽空格，让 remark 能识别强调边界
    .replace(/([\u4e00-\u9fa5\u3000-\u303f\uff00-\uffef])\*\*/g, '$1\u200B**')
    .replace(/\*\*([\u4e00-\u9fa5\u3000-\u303f\uff00-\uffef])/g, '**\u200B$1');
}

/**
 * 代码块感知的行分类器。
 * 返回每一行的 { line, isInCodeBlock } 信息。
 * 凡是位于 ``` 代码块内的行，isInCodeBlock = true。
 */
function annotateCodeBlocks(lines: string[]): Array<{ line: string; isInCodeBlock: boolean }> {
  let inCodeBlock = false;
  return lines.map((line) => {
    const trimmed = line.trimStart();
    if (trimmed.startsWith('```')) {
      inCodeBlock = !inCodeBlock;
      return { line, isInCodeBlock: false }; // 围栏本身不算"在代码块内"
    }
    return { line, isInCodeBlock: inCodeBlock };
  });
}

/**
 * 将 Markdown 按指定级别的标题切分为若干块。
 * 返回 Array<{ heading: string; content: string }>。
 * heading 是标题行本身（含 # 前缀），content 是该标题到下一个同级或更高级标题之间的内容。
 *
 * @param text      原始 Markdown 文本
 * @param level     标题级别，1 = H1（# ），2 = H2（## ）
 * @param stopLevel 遇到哪个级别的标题会停止当前块（默认 = level）
 */
function splitByHeading(
  text: string,
  level: number,
  stopLevel?: number
): Array<{ heading: string; content: string }> {
  const stop = stopLevel ?? level;
  const prefix = '#'.repeat(level) + ' ';
  const stopPrefix = '#'.repeat(stop) + ' ';

  const allLines = text.split('\n');
  const annotated = annotateCodeBlocks(allLines);

  const sections: Array<{ heading: string; content: string }> = [];
  let currentHeading = '';
  let currentLines: string[] = [];
  let started = false;

  for (const { line, isInCodeBlock } of annotated) {
    if (!isInCodeBlock && line.startsWith(prefix)) {
      if (started) {
        sections.push({ heading: currentHeading, content: currentLines.join('\n').trim() });
      }
      currentHeading = line;
      currentLines = [];
      started = true;
    } else if (
      !isInCodeBlock &&
      stop !== level &&
      line.startsWith(stopPrefix) &&
      !line.startsWith(prefix) &&
      started
    ) {
      // 遇到更高级的停止标题，结束当前块
      sections.push({ heading: currentHeading, content: currentLines.join('\n').trim() });
      currentHeading = '';
      currentLines = [];
      started = false;
    } else if (started) {
      currentLines.push(line);
    }
  }

  if (started && currentHeading) {
    sections.push({ heading: currentHeading, content: currentLines.join('\n').trim() });
  }

  return sections;
}

/**
 * 从 Markdown 文本中提取第一个 ```json ... ``` 代码块内的 JSON 并解析。
 */
function extractJsonBlock(text: string): unknown[] {
  const match = text.match(/```json\s*([\s\S]*?)```/);
  if (!match) return [];
  try {
    const parsed = JSON.parse(match[1].trim());
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    console.warn('[md-data] JSON 解析失败，返回空数组');
    return [];
  }
}

// ────────────────────────────────────────────────────────────
//  核心解析器
// ────────────────────────────────────────────────────────────

/**
 * 章节关键词识别规则。
 * 通过匹配 H1 标题文本，将其映射到数据字段。
 * 对标题改写有一定容错（只需包含关键词）。
 */
const H1_MAPPINGS: Array<{ key: string; match: RegExp }> = [
  { key: 'preface',              match: /卷首语/         },
  { key: 'introduction',        match: /^一、|^一、|导语/  },
  { key: 'chapter2',            match: /^二、/             },
  { key: 'literatureEvolution', match: /^三、/             },
  { key: 'algorithmRepro',      match: /^四、/             },
  { key: 'references',          match: /^五、/             },
  { key: 'glossary',            match: /^六、/             },
];

function identifyH1(heading: string): string | null {
  // heading 格式：'# 卷首语：...'，去掉 '# ' 前缀
  const text = heading.replace(/^#+\s+/, '');
  for (const { key, match } of H1_MAPPINGS) {
    if (match.test(text)) return key;
  }
  return null;
}

export function parseMd(rawContent: string): MdData {
  // 1. 预处理（不做路径替换，直接 serve attachments/）
  const md = preprocessMd(rawContent);

  // 2. 按 H1 切分
  const h1Sections = splitByHeading(md, 1);

  // 收集每个 H1 的内容
  const sectionMap: Record<string, string> = {};
  for (const { heading, content } of h1Sections) {
    const key = identifyH1(heading);
    if (key) {
      sectionMap[key] = heading + '\n' + content;
    }
  }

  // 3. 解析卷首语
  const prefaceData = sectionMap['preface'] ?? '';

  // 4. 解析导语（第一章）
  const introductionData = sectionMap['introduction'] ?? '';

  // 5. 解析第二章：知识图谱 + paperDeepDives
  const ch2Content = sectionMap['chapter2'] ?? '';
  const ch2H2Sections = splitByHeading(ch2Content, 2, 1);

  let knowledgeGraphData: unknown[] = [];
  let sec2_1Title = '研究团队的关联图谱';
  let sec2_1Description = '';
  const paperDeepDives: PaperDeepDive[] = [];

  for (const { heading, content } of ch2H2Sections) {
    const headingText = heading.replace(/^##\s+/, '');
    // ## 2.1 → 知识图谱
    if (/^2\.1/.test(headingText)) {
      sec2_1Title = headingText.replace(/^2\.1\s*/, '').trim() || sec2_1Title;
      knowledgeGraphData = extractJsonBlock(content);
      // 提取 2.1 的描述文字（去掉 JSON 代码块）
      sec2_1Description = content.replace(/```json[\s\S]*?```/g, '').trim();
    }
    // ## 2.2 ~ 2.9 → paperDeepDives（content 不含 heading，避免双标题）
    else if (/^2\.[2-9]/.test(headingText)) {
      const title = headingText.replace(/^2\.\d+\s+/, '').trim();
      paperDeepDives.push({
        id: `sec-${headingText.match(/^2\.(\d+)/)?.[0].replace('.', '-') ?? slugify(title)}`,
        title,
        content,   // ← 不含 heading，避免页面出现双标题
      });
    }
  }

  // 6. 解析第三章：文献演进
  const literatureEvolution = sectionMap['literatureEvolution'] ?? '';

  // 7. 解析第四章：实验复现（按 ## 4.x 子节分割）
  const ch4Content = sectionMap['algorithmRepro'] ?? '';
  const ch4H2Sections = splitByHeading(ch4Content, 2, 1);

  const algorithmReproduction: Record<string, string> = {};
  for (const { heading, content } of ch4H2Sections) {
    const headingText = heading.replace(/^##\s+/, '');
    const matchNum = headingText.match(/^4\.(\d+)/);
    if (matchNum) {
      const key = `sec4_${matchNum[1]}`;
      algorithmReproduction[key] = heading + '\n' + content;
    }
  }

  // 8. 参考文献 & 术语索引
  const referencesData = sectionMap['references'] ?? '';
  const glossaryData = sectionMap['glossary'] ?? '';

  // 9. 动态生成 navItems
  const navItems = buildNavItems(
    introductionData,
    paperDeepDives,
    literatureEvolution,
    algorithmReproduction,
    ch4Content
  );

  return {
    prefaceData,
    introductionData,
    knowledgeGraphData,
    sec2_1Title,
    sec2_1Description,
    paperDeepDives,
    literatureEvolution,
    algorithmReproduction,
    referencesData,
    glossaryData,
    navItems,
  };
}

// ────────────────────────────────────────────────────────────
//  navItems 动态构建
// ────────────────────────────────────────────────────────────

function buildNavItems(
  introContent: string,
  paperDeepDives: PaperDeepDive[],
  _literatureContent: string,
  algorithmReproduction: Record<string, string>,
  ch4Content: string,
): NavItem[] {
  const items: NavItem[] = [];

  // ── 卷首语 ──
  items.push({ id: 'preface', label: '卷首语', icon: 'BookOpen' });

  // ── 导语：从 introContent 提取 ## 1.x 子节 ──
  items.push({ id: 'introduction', label: '一、导语', icon: 'BookOpen' });
  const introH2 = splitByHeading(introContent, 2, 1);
  for (const { heading } of introH2) {
    const text = heading.replace(/^##\s+/, '');
    if (/^\d+\.\d+/.test(text)) {
      items.push({ id: slugify(text), label: text, isSub: true });
    }
  }

  // ── 论文精读 ──
  items.push({ id: 'part2', label: '二、论文精读', icon: 'Target' });
  items.push({ id: 'part2_1', label: '2.1 研究团队与关联图谱', isSub: true });
  for (let i = 0; i < paperDeepDives.length; i++) {
    const p = paperDeepDives[i];
    items.push({
      id: p.id,          // 使用稳定的数字 ID（sec-2-5/sec-2-6），避免 slugify 冲突
      label: `2.${i + 2} ${p.title}`,
      isSub: true,
    });
  }

  // ── 文献关系 ──
  items.push({ id: 'part3', label: '三、Yannakakis 关键技术', icon: 'GitMerge' });
  // 从第三章内容提取 ## 3.x 子节
  const ch3H2 = splitByHeading(_literatureContent, 2, 1);
  for (const { heading } of ch3H2) {
    const text = heading.replace(/^##\s+/, '');
    if (/^3\.\d+/.test(text)) {
      items.push({ id: slugify(text), label: text, isSub: true });
    }
  }

  // ── 实验复现 ──
  items.push({ id: 'part4', label: '四、实验复现', icon: 'FileCode' });
  const ch4H2 = splitByHeading(ch4Content, 2, 1);
  for (const { heading } of ch4H2) {
    const text = heading.replace(/^##\s+/, '');
    if (/^4\.\d+/.test(text)) {
      items.push({ id: slugify(text), label: text, isSub: true });
    }
  }

  // ── 参考文献 & 术语索引 ──
  items.push({ id: 'part5', label: '五、参考文献', icon: 'BookOpen' });
  items.push({ id: 'part6', label: '六、术语索引', icon: 'BookOpen' });

  return items;
}

// ────────────────────────────────────────────────────────────
//  Vite 插件导出
// ────────────────────────────────────────────────────────────

const VIRTUAL_MODULE_ID = 'virtual:md-data';
const RESOLVED_ID = '\0' + VIRTUAL_MODULE_ID;

/** 递归复制目录 */
function copyDir(src: string, dst: string) {
  if (!existsSync(src)) return;
  mkdirSync(dst, { recursive: true });
  for (const entry of readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dst, entry.name);
    if (entry.isDirectory()) copyDir(s, d);
    else copyFileSync(s, d);
  }
}

const MIME: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
};

export function mdDataPlugin(mdFilePath: string): Plugin {
  const absolutePath = path.resolve(mdFilePath);
  const attachmentsDir = path.resolve('attachments');

  return {
    name: 'vite-plugin-md-data',

    resolveId(id: string) {
      if (id === VIRTUAL_MODULE_ID) return RESOLVED_ID;
    },

    load(id: string) {
      if (id !== RESOLVED_ID) return;
      let raw: string;
      try {
        raw = readFileSync(absolutePath, 'utf-8');
      } catch (e) {
        console.error(`[md-data] 无法读取 MD 文件：${absolutePath}`);
        throw e;
      }
      const data = parseMd(raw);
      return `export default ${JSON.stringify(data)};`;
    },

    // ── dev 时拦截 /attachments/ 请求，直接从磁盘返回图片 ──
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = req.url ?? '';
        const m = url.match(/\/attachments\/([^?#]+)/);
        if (!m) return next();
        const filepath = path.join(attachmentsDir, decodeURIComponent(m[1]));
        try {
          const data = readFileSync(filepath);
          const ext = path.extname(filepath).toLowerCase();
          res.setHeader('Content-Type', MIME[ext] ?? 'application/octet-stream');
          res.setHeader('Cache-Control', 'public,max-age=3600');
          res.end(data);
        } catch {
          next();
        }
      });
    },

    // ── build 时将 attachments/ 复制到 dist/ ──
    closeBundle() {
      const outDir = process.env.VITE_OUTPUT_DIR ?? 'dist';
      copyDir(attachmentsDir, path.join(outDir, 'attachments'));
      console.log('[md-data] attachments/ 已复制到 dist/attachments/');
    },

    handleHotUpdate({ file, server }) {
      if (file === absolutePath || file.includes('/attachments/')) {
        console.log('[md-data] 文档/图片变更，刷新页面...');
        server.hot.send({ type: 'full-reload' });
        const mod = server.moduleGraph.getModuleById(RESOLVED_ID);
        if (mod) server.moduleGraph.invalidateModule(mod);
      }
    },
  };
}
