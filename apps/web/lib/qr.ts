// apps/web/lib/qr.ts — 极简二维码占位渲染（CAP-PAYMENT / F05）
// 范围说明：F05 的验收点是「生成并展示可扫码支付的二维码区域 + 订单号 + 轮询」，
// 不要求接入真实支付网关的二维码协议。这里用确定性哈希把 `qr_payload` 映射成一个
// 21x21 的黑白网格 SVG（类似 QR 的视觉形态），同一 payload 每次生成的图案一致，
// 可离线渲染、无第三方依赖、便于 e2e 断言其存在。真实支付网关接入时按 provider
// 文档替换本文件的实现即可，调用方（订单创建 API）不受影响。

const GRID = 21;

/** FNV-1a 简单哈希，纯函数、确定性，仅用于生成网格图案，不作安全用途。 */
function hashSeed(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** 基于 payload 生成确定性伪随机 0/1 网格（不是真实 QR 编码，仅作扫码区视觉占位）。 */
function buildGrid(payload: string): boolean[][] {
  let seed = hashSeed(payload) || 1;
  const next = () => {
    // xorshift32，确定性、无依赖
    seed ^= seed << 13;
    seed ^= seed >>> 17;
    seed ^= seed << 5;
    seed >>>= 0;
    return seed;
  };
  const grid: boolean[][] = [];
  for (let y = 0; y < GRID; y++) {
    const row: boolean[] = [];
    for (let x = 0; x < GRID; x++) {
      row.push(next() % 2 === 0);
    }
    grid.push(row);
  }
  // 三个定位角标记（左上/右上/左下），贴近 QR 视觉特征
  const markPosition = (grid_: boolean[][], ox: number, oy: number) => {
    for (let y = 0; y < 7; y++) {
      for (let x = 0; x < 7; x++) {
        const border = x === 0 || x === 6 || y === 0 || y === 6;
        const core = x >= 2 && x <= 4 && y >= 2 && y <= 4;
        grid_[oy + y]![ox + x] = border || core;
      }
    }
  };
  markPosition(grid, 0, 0);
  markPosition(grid, GRID - 7, 0);
  markPosition(grid, 0, GRID - 7);
  return grid;
}

/** 生成 SVG 字符串（可直接内嵌 <img src="data:image/svg+xml..."> 或 dangerouslySetInnerHTML）。 */
export function renderQrSvg(payload: string, size = 168): string {
  const grid = buildGrid(payload);
  const cell = size / GRID;
  let rects = "";
  for (let y = 0; y < GRID; y++) {
    for (let x = 0; x < GRID; x++) {
      if (grid[y]![x]) {
        rects += `<rect x="${x * cell}" y="${y * cell}" width="${cell}" height="${cell}" fill="#000"/>`;
      }
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" role="img" aria-label="支付二维码">` +
    `<rect x="0" y="0" width="${size}" height="${size}" fill="#fff"/>${rects}</svg>`;
}

/** data: URI，便于前端直接当图片 src 使用。 */
export function renderQrDataUri(payload: string, size = 168): string {
  const svg = renderQrSvg(payload, size);
  const base64 = Buffer.from(svg, "utf8").toString("base64");
  return `data:image/svg+xml;base64,${base64}`;
}
