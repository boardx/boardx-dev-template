// 单调 ULID（与 coord-repohub 同款）：event_id 单 DO 内严格递增可排序；
// 实体主键不可变（D6：改名不断链，链接一律锚 ULID）。DO 单线程，last 状态无并发问题。
const ENC = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

let lastTime = 0;
let lastRand: number[] = [];

function encodeTime(t: number): string {
  let s = "";
  for (let i = 9; i >= 0; i--) {
    s = ENC[(t >>> 0) % 32] + s; // 低位
    t = Math.floor(t / 32);
  }
  return s;
}

export function ulid(now: number = Date.now()): string {
  if (now === lastTime) {
    // 同毫秒内：随机部分 +1 保证单调
    for (let i = lastRand.length - 1; i >= 0; i--) {
      lastRand[i] = (lastRand[i]! + 1) % 32;
      if (lastRand[i] !== 0) break;
    }
  } else {
    lastTime = now;
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    lastRand = Array.from(bytes, (b) => b % 32);
  }
  return encodeTime(now) + lastRand.map((v) => ENC[v]).join("");
}
