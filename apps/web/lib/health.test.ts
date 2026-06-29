import { describe, it, expect } from "vitest";
import { healthPayload } from "./health";

describe("healthPayload", () => {
  it("返回 ok=true 与 service 名", () => {
    expect(healthPayload()).toEqual({ ok: true, service: "web" });
  });
});
