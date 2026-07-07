import { describe, expect, it } from "vitest";
import { boardPointToScreen, publishViewport, screenToBoardPoint } from "./collab-bus";

// p8:F03 坐标转换回归：这条 bug 曾经真实发生过——光标广播用发送方的原始
// clientX/clientY（屏幕像素），接收端用 position:fixed 原样渲染，双方窗口尺寸
// 或画布 pan/zoom 不同时位置就会跟真实指向对不上。这里直接测转换函数本身
// （不依赖真实 DOM/jsdom），比 e2e 更快更确定。
describe("collab-bus 光标坐标转换", () => {
  const rect = { left: 100, top: 50 };

  it("scale=1、无平移时，screenToBoardPoint 与 boardPointToScreen 互为逆运算", () => {
    publishViewport({ tx: 0, ty: 0, scale: 1 });
    const board = screenToBoardPoint(300, 200, rect);
    expect(board).toEqual({ x: 200, y: 150 });
    const screen = boardPointToScreen(board.x, board.y, rect);
    expect(screen).toEqual({ x: 300, y: 200 });
  });

  it("接收端的 scale 变化会改变同一画布坐标对应的屏幕位置（这是 bug 修复的核心）", () => {
    const boardPoint = { x: 500, y: 300 };
    publishViewport({ tx: 0, ty: 0, scale: 1 });
    const before = boardPointToScreen(boardPoint.x, boardPoint.y, rect);

    publishViewport({ tx: 0, ty: 0, scale: 2 });
    const after = boardPointToScreen(boardPoint.x, boardPoint.y, rect);

    // 旧实现（直接用发送方 clientX/clientY 当屏幕坐标）在这里 before === after，
    // 因为它压根不看接收端自己的 scale——这条断言在那种实现下会失败。
    expect(after).not.toEqual(before);
    expect(after).toEqual({ x: rect.left + boardPoint.x * 2, y: rect.top + boardPoint.y * 2 });
  });

  it("发送端和接收端 pan/zoom 不同时，画布坐标转换仍能保证双方看到同一个逻辑点", () => {
    // A 发送时：A 的视口是 tx=50 ty=20 scale=1.5。
    publishViewport({ tx: 50, ty: 20, scale: 1.5 });
    const aRect = { left: 0, top: 0 };
    const aClientPos = { x: 400, y: 300 }; // A 屏幕上的鼠标位置
    const boardPoint = screenToBoardPoint(aClientPos.x, aClientPos.y, aRect);

    // B 接收时：B 的视口/窗口完全不同（tx=-30 ty=10 scale=0.8，容器也不在同一位置）。
    publishViewport({ tx: -30, ty: 10, scale: 0.8 });
    const bRect = { left: 200, top: 80 };
    const bScreenPos = boardPointToScreen(boardPoint.x, boardPoint.y, bRect);

    // 用 B 自己的视口把这个屏幕坐标换算回画布坐标，应该复原成同一个逻辑点
    // （证明双方对"这是画布上的哪个点"达成一致，而不是原样搬运像素值）。
    const roundTrip = screenToBoardPoint(bScreenPos.x, bScreenPos.y, bRect);
    expect(roundTrip.x).toBeCloseTo(boardPoint.x, 5);
    expect(roundTrip.y).toBeCloseTo(boardPoint.y, 5);
  });

  it("容器矩形拿不到时（尚未挂载）退化为原样透传，不抛异常", () => {
    publishViewport({ tx: 10, ty: 10, scale: 2 });
    expect(screenToBoardPoint(10, 20, null)).toEqual({ x: 10, y: 20 });
    expect(boardPointToScreen(10, 20, null)).toEqual({ x: 10, y: 20 });
  });
});
