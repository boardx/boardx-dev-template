const baseURL = process.env.AI_STORE_BASE_URL ?? "http://localhost:3050";
const password = process.env.AI_STORE_DEMO_PASSWORD ?? "secret123";

const parsedBaseURL = new URL(baseURL);
if (!["localhost", "127.0.0.1"].includes(parsedBaseURL.hostname)) {
  throw new Error("AI Store demo seed only runs against localhost.");
}

const runId = new Date().toISOString().replace(/\D/g, "").slice(0, 14);

class ApiSession {
  constructor(label) {
    this.label = label;
    this.cookies = new Map();
  }

  async request(path, { method = "GET", data, headers = {} } = {}) {
    const response = await fetch(new URL(path, baseURL), {
      method,
      headers: {
        ...(data === undefined ? {} : { "content-type": "application/json" }),
        ...(this.cookies.size > 0
          ? {
              cookie: [...this.cookies.entries()]
                .map(([name, value]) => `${name}=${value}`)
                .join("; "),
            }
          : {}),
        ...headers,
      },
      body: data === undefined ? undefined : JSON.stringify(data),
      redirect: "manual",
    });

    const setCookies =
      typeof response.headers.getSetCookie === "function"
        ? response.headers.getSetCookie()
        : [response.headers.get("set-cookie")].filter(Boolean);
    if (setCookies.length > 0) {
      for (const setCookie of setCookies) {
        const [pair] = setCookie.split(";");
        const separator = pair.indexOf("=");
        if (separator > 0) {
          this.cookies.set(pair.slice(0, separator), pair.slice(separator + 1));
        }
      }
    }

    const text = await response.text();
    let body = {};
    if (text) {
      try {
        body = JSON.parse(text);
      } catch {
        body = { text };
      }
    }
    return { status: response.status, body };
  }

  async expect(path, options, expectedStatus) {
    const result = await this.request(path, options);
    const accepted = Array.isArray(expectedStatus) ? expectedStatus : [expectedStatus];
    if (!accepted.includes(result.status)) {
      throw new Error(
        `${this.label}: ${options?.method ?? "GET"} ${path} returned ${result.status}: ${JSON.stringify(result.body)}`,
      );
    }
    return result.body;
  }
}

function demoEmail(role) {
  return `p27.demo.${runId}.${role}@example.com`;
}

async function register(session, role) {
  const email = demoEmail(role);
  await session.expect(
    "/api/auth/register",
    {
      method: "POST",
      data: {
        firstName: "P27",
        lastName: role,
        email,
        password,
        agreeTerms: true,
      },
    },
    201,
  );
  return email;
}

async function createTeam(session, name) {
  const body = await session.expect(
    "/api/teams",
    { method: "POST", data: { name: `${name} ${runId}` } },
    201,
  );
  return Number(body.team.id);
}

async function createResource(session, input) {
  const body = await session.expect(
    "/api/ai-store/items",
    {
      method: "POST",
      data: {
        type: input.type,
        skillKind: input.skillKind,
        scope: input.scope,
        action: input.action,
        name: input.name,
        description: input.description,
        config: input.instructions,
        tags: input.tags,
        examples: input.examples ?? [],
        allowCopy: input.allowCopy ?? false,
      },
    },
    201,
  );
  return body.item;
}

async function approvePlatformResource(admin, item) {
  const body = await admin.expect(
    `/api/admin/ai-store/${item.id}/review`,
    { method: "POST", data: { action: "approve" } },
    200,
  );
  return body.item;
}

const creator = new ApiSession("creator");
const boardxAdmin = new ApiSession("boardx-admin");
const consumerOwner = new ApiSession("consumer-owner");
const consumerMember = new ApiSession("consumer-member");

const creatorEmail = await register(creator, "creator");
const teamAId = await createTeam(creator, "P27 Creator Studio");

const adminEmail = await register(boardxAdmin, "boardx-admin");
await createTeam(boardxAdmin, "P27 BoardX Admin");
await boardxAdmin.expect(
  "/api/dev/grant-sysadmin",
  { method: "POST", data: { email: adminEmail } },
  200,
);

const consumerOwnerEmail = await register(consumerOwner, "consumer-owner");
const teamBId = await createTeam(consumerOwner, "P27 Consumer Team");

const consumerMemberEmail = await register(consumerMember, "consumer-member");
await consumerOwner.expect(
  "/api/teams/invite",
  { method: "POST", data: { teamId: teamBId, email: consumerMemberEmail } },
  200,
);
await consumerMember.expect(
  "/api/teams/current",
  { method: "POST", data: { teamId: teamBId } },
  200,
);

const platformDefinitions = [
  {
    type: "agent",
    scope: "platform",
    action: "submit_review",
    name: `Research Synthesis Agent ${runId}`,
    description: "Synthesizes source material into findings, risks, and cited recommendations.",
    instructions: "Analyze the supplied sources, preserve citations, and separate facts from inferences.",
    tags: ["Research", "Productivity", "Featured"],
    examples: ["Compare customer interviews", "Summarize a market report"],
    allowCopy: true,
  },
  {
    type: "skill",
    skillKind: "text",
    scope: "platform",
    action: "submit_review",
    name: `Meeting Notes Skill ${runId}`,
    description: "Turns raw meeting notes into decisions, owners, action items, and unresolved risks.",
    instructions: "Return decisions, action items with owners, due dates, and unresolved questions.",
    tags: ["Meetings", "Writing", "Productivity"],
    allowCopy: true,
  },
  {
    type: "skill",
    skillKind: "image",
    scope: "platform",
    action: "submit_review",
    name: `Brand Image Skill ${runId}`,
    description: "Generates review-ready campaign images while preserving brand constraints.",
    instructions: "Use the provided brand palette, typography guidance, aspect ratio, and safe margins.",
    tags: ["Design", "Featured"],
    allowCopy: true,
  },
  {
    type: "template",
    scope: "platform",
    action: "submit_review",
    name: `Product Discovery Template ${runId}`,
    description: "A structured workspace for assumptions, interviews, evidence, and opportunity scoring.",
    instructions: "Create sections for assumptions, evidence, interviews, opportunities, and next decisions.",
    tags: ["Research", "Productivity"],
    allowCopy: true,
  },
];

const approvedResources = [];
for (const definition of platformDefinitions) {
  const pending = await createResource(creator, definition);
  approvedResources.push(await approvePlatformResource(boardxAdmin, pending));
}

await boardxAdmin.expect(
  `/api/admin/ai-store/${approvedResources[0].id}/featured`,
  { method: "POST", data: { featured: true } },
  200,
);
await boardxAdmin.expect(
  `/api/admin/ai-store/${approvedResources[2].id}/featured`,
  { method: "POST", data: { featured: true } },
  200,
);

const teamReviewItem = await createResource(creator, {
  type: "agent",
  scope: "team",
  action: "submit_review",
  name: `Team Roadmap Agent ${runId}`,
  description: "Maintains roadmap summaries for Team A and highlights delivery risks.",
  instructions: "Summarize roadmap changes, dependencies, owners, and schedule risks.",
  tags: ["Productivity", "Team"],
  allowCopy: true,
});
await creator.expect(
  `/api/teams/${teamAId}/ai-store-review/${teamReviewItem.id}`,
  { method: "POST", data: { action: "approve" } },
  200,
);
await creator.expect(
  `/api/teams/${teamAId}/ai-store-featured/${teamReviewItem.id}`,
  { method: "POST", data: { featured: true } },
  200,
);

const pendingResource = await createResource(creator, {
  type: "template",
  scope: "platform",
  action: "submit_review",
  name: `Pending Launch Review Template ${runId}`,
  description: "A deliberately pending resource for exercising the BoardX review queue.",
  instructions: "Collect launch checks, owners, evidence, risks, and the final go or no-go decision.",
  tags: ["Review", "Productivity"],
  allowCopy: false,
});

const draftResource = await createResource(creator, {
  type: "skill",
  skillKind: "text",
  scope: "personal",
  action: "draft",
  name: `Draft Customer Brief Skill ${runId}`,
  description: "An unfinished creator-owned draft used to test private resource management.",
  instructions: "Draft a customer brief from account notes and recent interactions.",
  tags: ["Draft", "Writing"],
  allowCopy: false,
});

for (const resource of approvedResources.slice(0, 3)) {
  await consumerOwner.expect(
    `/api/ai-store/items/${resource.id}/subscribe`,
    { method: "POST", data: { scope: "team" } },
    [200, 201],
  );
}
await consumerMember.expect(
  `/api/ai-store/items/${approvedResources[3].id}/subscribe`,
  { method: "POST", data: { scope: "personal" } },
  [200, 201],
);

await consumerMember.expect(
  `/api/ai-store/items/${approvedResources[0].id}/favorite`,
  { method: "POST" },
  200,
);
await consumerMember.expect(
  `/api/ai-store/items/${approvedResources[2].id}/favorite`,
  { method: "POST" },
  200,
);

const shareBody = await creator.expect(
  `/api/ai-store/items/${approvedResources[0].id}/share`,
  { method: "POST" },
  201,
);
await consumerMember.expect(
  `/api/ai-store/items/${approvedResources[0].id}/share/redeem?shareToken=${encodeURIComponent(shareBody.share.share_token)}`,
  { method: "POST" },
  200,
);
const copyBody = await consumerMember.expect(
  `/api/ai-store/items/${approvedResources[0].id}/copy`,
  {
    method: "POST",
    headers: { "Idempotency-Key": `p27-demo-copy-${runId}` },
  },
  201,
);

const updatedAgentBody = await creator.expect(
  `/api/ai-store/items/${approvedResources[0].id}`,
  {
    method: "PATCH",
    data: {
      type: "agent",
      scope: "platform",
      action: "draft",
      expectedVersion: Number(approvedResources[0].version),
      name: approvedResources[0].name,
      description:
        "Version 2 is live immediately for existing subscribers, with improved risk and citation handling.",
      config: "Analyze sources, preserve citations, identify risks, and separate facts from inferences.",
      tags: ["Research", "Productivity", "Featured"],
      allowCopy: true,
    },
  },
  200,
);

const memberExplore = await consumerMember.expect(
  `/api/ai-store/items?q=${encodeURIComponent(runId)}`,
  undefined,
  200,
);
const memberSubscriptions = await consumerMember.expect(
  "/api/ai-store/items?subscribed=me",
  undefined,
  200,
);

const summary = {
  baseURL,
  runId,
  password,
  accounts: {
    creator: { email: creatorEmail, teamId: teamAId },
    boardxAdmin: { email: adminEmail },
    consumerOwner: { email: consumerOwnerEmail, teamId: teamBId },
    consumerMember: { email: consumerMemberEmail, teamId: teamBId },
  },
  resources: {
    approved: approvedResources.map((item) => ({
      id: Number(item.id),
      type: item.type,
      name: item.name,
    })),
    teamFeatured: { id: Number(teamReviewItem.id), name: teamReviewItem.name },
    pending: { id: Number(pendingResource.id), name: pendingResource.name },
    draft: { id: Number(draftResource.id), name: draftResource.name },
    copiedDraft: { id: Number(copyBody.item.id), name: copyBody.item.name },
    liveUpdatedAgent: {
      id: Number(updatedAgentBody.item.id),
      version: Number(updatedAgentBody.item.version),
      status: updatedAgentBody.item.status,
    },
  },
  verification: {
    memberExploreCount: memberExplore.items.length,
    memberSubscriptionCount: memberSubscriptions.items.length,
  },
};

console.log(JSON.stringify(summary, null, 2));
