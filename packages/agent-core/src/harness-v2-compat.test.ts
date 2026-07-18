import { describe, expect, it } from "vitest";
import * as agentCore from "./index";

describe("Harness V2 compatibility facade", () => {
  it("re-exports the versioned core protocol without removing the V1 session API", () => {
    expect(agentCore.HARNESS_PROTOCOL).toBe("harness/2.0");
    expect(typeof agentCore.validateTaskSpec).toBe("function");
    expect(typeof agentCore.createSession).toBe("function");
    expect(typeof agentCore.appendStep).toBe("function");
  });
});
