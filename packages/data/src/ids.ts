// packages/data/src/ids.ts — 全局唯一 id 生成统一入口（issue #471 阶段 1）。
//
// 背景：自增整数主键直接暴露在 URL 里（/boards/1）可枚举，能遍历探测他人资源 id，
// 也不利于跨环境迁移/未来分布式写入。generateId(prefix) 是全仓统一入口——任何需要对外
// （路由/链接/API 响应）暴露的资源标识，都应该用这个函数生成的 public_id，不能再依赖
// serial 主键对外可见。
//
// 阶段 1 范围（本次改动）：只提供生成函数 + boards/rooms 表的 public_id 列/回填迁移。
// 路由与内部链接切到 public_id 是阶段 2，另开 issue——那部分涉及 41 个 API route 文件
// 和 200+ 处链接拼接，一次性做完风险太大，见 #471 讨论。
import { customAlphabet } from "nanoid";

// 排除易混淆字符（0/O、1/I/l），人工核对/客服口述场景更安全；同时避免 URL 里出现连字符/
// 下划线以外的符号。57 字符字母表在 12 位长度下碰撞概率可忽略（阶段 1 只有 boards/rooms
// 两张表回填，量级远达不到需要担心生日悖论的程度）。
const ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz";
const ID_LENGTH = 12;
const nanoidGen = customAlphabet(ALPHABET, ID_LENGTH);

// prefix 必须是仅小写字母的短标识（如 "brd"、"rm"），生成结果形如 "brd_x7Kf9q2mP3aZ"。
const PREFIX_RE = /^[a-z]{2,8}$/;

/**
 * 生成一个全局唯一的对外资源 id：`<prefix>_<12位随机字符>`。
 * 这是仓库里生成 public_id 的唯一入口——任何表新增行需要对外暴露标识时，都调用这个
 * 函数，不要在别处自行拼 nanoid 或用别的生成方式（否则格式不一致，`` 这样的
 * 判别/校验逻辑就会碎片化）。
 */
export function generateId(prefix: string): string {
  if (!PREFIX_RE.test(prefix)) {
    throw new Error(`generateId: prefix 必须是 2~8 位小写字母，收到 "${prefix}"`);
  }
  return `${prefix}_${nanoidGen()}`;
}

/** 校验一个字符串是否符合 `<prefix>_<12位>` 的 public_id 格式（不校验是否真实存在）。 */
export function isValidPublicId(value: string, prefix?: string): boolean {
  const re = prefix ? new RegExp(`^${prefix}_[${ALPHABET}]{${ID_LENGTH}}$`) : new RegExp(`^[a-z]{2,8}_[${ALPHABET}]{${ID_LENGTH}}$`);
  return re.test(value);
}
