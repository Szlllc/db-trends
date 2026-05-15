/// <reference types="vite/client" />

// 虚拟模块 virtual:md-data 的类型声明
// 这使 TypeScript 能正确识别 import data from 'virtual:md-data' 的类型

declare module 'virtual:md-data' {
  import type { MdData } from '../vite-plugin-md-data';
  const data: MdData;
  export default data;
}
