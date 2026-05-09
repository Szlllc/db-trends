import fs from 'fs';

const rawContent = fs.readFileSync('yannakakis.md', 'utf-8');
const mdContent = rawContent.replace(/attachments\//g, 'figures/').replace(/\\\s*(?=\n|$)/g, '');

// Helper to extract section between two indices
function extract(startStr: string, endStr: string | null): string {
    const startIndex = mdContent.indexOf(startStr);
    if (startIndex === -1) return '';
    const endIndex = endStr ? mdContent.indexOf(endStr, startIndex) : mdContent.length;
    if (endIndex === -1) return mdContent.substring(startIndex);
    return mdContent.substring(startIndex, endIndex).trim();
}

const ch1Start = '# 一、导语';
const ch2Start = '# 二、论文精读：从 1981 奠基理论到现代演进';
const jsonStart = '```json';
const jsonEnd = '```';

// Extract Knowledge Graph JSON
const kgSection = extract('## 2.1 各篇作者与团队关系图谱', '## Yannakakis 奠基理论');
const jsonStartIndex = kgSection.indexOf(jsonStart) + jsonStart.length;
const jsonEndIndex = kgSection.indexOf(jsonEnd, jsonStartIndex);
const kgJsonStr = kgSection.substring(jsonStartIndex, jsonEndIndex).trim();

// Section 2 Sections
const sec2_2 = extract('## Yannakakis 奠基理论', '## Yannakakis+');
const sec2_3 = extract('## Yannakakis+', '## PT');
const sec2_4 = extract('## PT', '## RPT(');
const sec2_5 = extract('## RPT(', '## RPT+');
const sec2_6 = extract('## RPT+', '## I Can\'t Believe');
const sec2_7 = extract('## I Can\'t Believe', '# 三、');

// Chapter 3
const ch3 = extract('# 三、文献关系的主线', '# 四、实验复现');

// Chapter 4
const ch4_1 = extract('# 四、实验复现', '## 4.2 Quorion(Y+) 复现方法');
const ch4_2 = extract('## 4.2 Quorion(Y+) 复现方法', '## 4.3 RPT核心算法执行流程');
const ch4_3 = extract('## 4.3 RPT核心算法执行流程', '## 4.4 Y+核心算法执行流程');
const ch4_4 = extract('## 4.4 Y+核心算法执行流程', '## 4.5 问题记录');
const ch4_5 = extract('## 4.5 问题记录', '# 五、');

const repro_results = extract('## 4.6 复现实验结果', '## 4.7 专刊复现结论：RPT 复现对比');
const repro_conclusions = extract('## 4.7 专刊复现结论：RPT 复现对比', null);

const algorithmReproduction = {
  sec4_1: ch4_1,
  sec4_2: ch4_2,
  sec4_3: ch4_3,
  sec4_4: ch4_4,
  sec4_5: ch4_5,
  repro_results: repro_results,
  repro_conclusions: repro_conclusions
};


const preface = extract('# 一、卷首语 & 导语', '# 一、导语');
const ch1 = extract('# 一、导语', '# 二、');

const ch5 = extract('# 五、参考文献', '# 六、术语索引');
const ch6 = extract('# 六、术语索引', '# 复现实验结果');

const dataTsContent = `
export const prefaceData = ${JSON.stringify(preface)};
export const introductionData = ${JSON.stringify(ch1)};
export const knowledgeGraphData = ${kgJsonStr};

export const paperDeepDives = [
  { id: 'sec-2-2', title: 'Yannakakis 奠基理论（1981）', content: ${JSON.stringify(sec2_2)} },
  { id: 'sec-2-3', title: 'Yannakakis+ (SIGMOD 2025)', content: ${JSON.stringify(sec2_3)} },
  { id: 'sec-2-4', title: 'PT (CIDR 2024)', content: ${JSON.stringify(sec2_4)} },
  { id: 'sec-2-5', title: 'RPT (SIGMOD 2025)', content: ${JSON.stringify(sec2_5)} },
  { id: 'sec-2-6', title: 'RPT+ (VLDB 2025)', content: ${JSON.stringify(sec2_6)} },
  { id: 'sec-2-7', title: 'ICB (CIDR 2026)', content: ${JSON.stringify(sec2_7)} }
];

export const literatureEvolution = ${JSON.stringify(ch3)};

export const algorithmReproduction = ${JSON.stringify(algorithmReproduction, null, 2)};

export const referencesData = ${JSON.stringify(ch5)};
export const glossaryData = ${JSON.stringify(ch6)};
`;

fs.writeFileSync('src/data.ts', dataTsContent);
console.log('Successfully generated src/data.ts');
