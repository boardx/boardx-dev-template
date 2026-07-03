// apps/web/lib/collab-bus.ts — uc-collab-001 协作感知 + 视角跟随的进程内（浏览器内）事件总线。
//
// 目的：让 Header 里的 BoardPresence（发心跳/管跟随）与画布 CanvasViewport（拥有本地视口）、
// BoardCanvas（知道自己此刻是否在操作）在同一页面内互通，而无需把三者耦合成一棵大组件树。
// 这是纯客户端、单页面单例的轻量总线——presence 的真实跨客户端传播仍走 /presence 心跳通道。
//
// 语义：
// - 本地视口（tx/ty/scale）：CanvasViewport 每次平移/缩放后 publishViewport；BoardPresence 读它塞进心跳。
// - 本地操作态（operating）：BoardCanvas 拖拽/编辑时 setOperating(true)，结束 setOperating(false)；
//   BoardPresence 读它塞进心跳，其他协作者据此看到「谁在操作」。
// - 跟随目标：BoardPresence 点「跟随 X」后 publishFollow({viewport})，CanvasViewport 订阅并把本地视口
//   贴到被跟随者的视口（业务规则 2：跟随只改视角，不改内容）。停止跟随 publishFollow(null)。

export interface ViewportSnapshot {
  tx: number;
  ty: number;
  scale: number;
}

export interface CursorSnapshot {
  x: number;
  y: number;
  visible: boolean;
}

interface FollowSnapshot {
  viewport: ViewportSnapshot;
}

type Listener<T> = (value: T) => void;

// 本地视口最新快照（供心跳读取）。
let localViewport: ViewportSnapshot = { tx: 0, ty: 0, scale: 1 };
// 本地是否正在操作（拖拽/编辑）。
let localOperating = false;
// 本地鼠标光标最新位置（供 presence 心跳广播给他人）。
let localCursor: CursorSnapshot | null = null;

const followListeners = new Set<Listener<FollowSnapshot | null>>();

/** CanvasViewport：每次视口变化后上报本地视口（供心跳广播给他人）。 */
export function publishViewport(vp: ViewportSnapshot): void {
  localViewport = vp;
}

/** BoardPresence：读取本地视口，塞进心跳 payload。 */
export function readLocalViewport(): ViewportSnapshot {
  return localViewport;
}

/** BoardCanvas：标记本地是否正在操作（拖拽/编辑）。 */
export function setOperating(on: boolean): void {
  localOperating = on;
}

/** BoardPresence：读取本地操作态，塞进心跳 payload。 */
export function readLocalOperating(): boolean {
  return localOperating;
}

/** BoardCanvas：发布本地光标位置；null 表示空闲/离开画布。 */
export function publishCursor(cursor: CursorSnapshot | null): void {
  localCursor = cursor;
}

/** BoardPresence：读取本地光标，塞进心跳 payload。 */
export function readLocalCursor(): CursorSnapshot | null {
  return localCursor;
}

/** BoardPresence：设置/清除跟随目标的视口快照（null = 停止跟随）。 */
export function publishFollow(target: FollowSnapshot | null): void {
  for (const fn of followListeners) fn(target);
}

/** CanvasViewport：订阅跟随目标视口变化，据此贴合本地视口。 */
export function subscribeFollow(fn: Listener<FollowSnapshot | null>): () => void {
  followListeners.add(fn);
  return () => followListeners.delete(fn);
}
