import { createServer } from "node:http";

const port = Number(process.env.SURVEY_REPORT_AI_STUB_PORT ?? "5002");
const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFElEQVR42mNkYPj/n4GBgYGJAQoAHgQCAZ7x0VQAAAAASUVORK5CYII=",
  "base64"
);

function sendJson(response, status, payload) {
  response.writeHead(status, { "content-type": "application/json" });
  response.end(JSON.stringify(payload));
}

async function readJson(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
}

createServer(async (request, response) => {
  const url = new URL(request.url ?? "/", `http://127.0.0.1:${port}`);
  if (url.pathname === "/health") {
    return sendJson(response, 200, { ok: true });
  }
  if (url.pathname === "/fixture.png") {
    response.writeHead(200, {
      "content-type": "image/png",
      "content-length": String(png.length),
    });
    response.end(png);
    return;
  }
  if (url.pathname.endsWith("/services/aigc/multimodal-generation/generation")) {
    return sendJson(response, 200, {
      output: {
        choices: [{
          message: {
            content: [{
              type: "image",
              image: `http://127.0.0.1:${port}/fixture.png`,
            }],
          },
        }],
      },
    });
  }
  if (url.pathname.endsWith("/chat/completions")) {
    const body = await readJson(request);
    const messages = Array.isArray(body.messages) ? body.messages : [];
    const userMessage = [...messages].reverse().find(
      (message) => message?.role === "user"
    );
    const prompt = JSON.parse(userMessage?.content ?? "{}");
    if (body.stream) {
      const claim = prompt.evidence?.claims?.[0];
      const chapterResult = {
        conclusion: claim
          ? `${prompt.chapter?.title ?? "洞察"}：${claim.statement}`
          : "",
        evidenceRefs: claim ? [{
          evidenceId: claim.id,
          value: claim.value,
          denominator: claim.denominator,
        }] : [],
        limitations: prompt.evidence?.limitations ?? [],
        recommendation: claim
          ? "围绕最高关注项补充验证材料并持续扩大样本。"
          : "",
      };
      response.writeHead(200, { "content-type": "text/event-stream" });
      response.write(`data: ${JSON.stringify({
        choices: [{ delta: { content: JSON.stringify(chapterResult) } }],
      })}\n\n`);
      response.write("data: [DONE]\n\n");
      response.end();
      return;
    }
    let result;
    if (prompt.task === "generate_template_text_chapter") {
      const claim = prompt.evidence?.claims?.[0];
      result = {
        headline: "关键决策信号已形成，可进入证据化验证阶段",
        claims: claim ? [{
          statement: claim.statement,
          evidenceId: claim.id,
          value: claim.value,
          denominator: claim.denominator,
          implication: "当前反馈已形成可供管理层判断的方向性信号。",
          recommendation: "围绕最高关注项补充验证材料并持续扩大样本。",
        }] : [],
      };
    } else if (prompt.task === "select_template_chart_evidence") {
      result = {
        questionId: prompt.candidates?.[0]?.questionId,
        interpretation: "主要选项已形成清晰差异，应优先围绕领先项配置沟通与验证资源。",
      };
    } else {
      result = { claims: [] };
    }
    return sendJson(response, 200, {
      choices: [{ message: { content: JSON.stringify(result) } }],
    });
  }
  sendJson(response, 404, { error: "not_found" });
}).listen(port, "127.0.0.1", () => {
  process.stdout.write(`survey report AI stub listening on ${port}\n`);
});
