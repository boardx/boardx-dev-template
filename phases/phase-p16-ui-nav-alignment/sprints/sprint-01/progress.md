# 进度日志 — Sprint p16/01

## 当前已验证状态(唯一真相)
- 仓库根目录: <repo 路径>
- 标准启动路径: `pnpm -w run dev`
- 标准验证路径: `pnpm -w run verify:base`
- 当前最高优先级未完成功能: F03 已实现并修复评审意见，待重新 review（PR #225，等 review 门禁）
- 当前 blocker: 无（F03 待人工 review 合并；发现的 Board 中英文案混用问题记录见下，归属 phase-p17，不在本 feature 范围内修复）

## 会话记录

### 2026-07-03（追加：修复 feature-evaluator review 意见，10/16 Revise → 待复审）
- 评审发现的核心问题：F03 的 verification 命令 `grep -qi 'ava|ai-store|surveys|admin' /tmp/lint-design-out.txt`
  之所以 exit 0，是因为匹配到了脚本第 11 行**我自己写的说明性 echo**（"含 ava/ai-store/surveys/admin/studio/presentations
  等模块"），不是 §7 规则真正扫描这些页面后产出的违规内容——**验证是自证式的，删掉 §7 全部检测逻辑只留那行 echo，
  命令照样通过**。评审同时指出：code review 报告里其实已经确认 `ava/page.tsx` 同一文件内既有中文 label（理解文件/
  起草邮件…）又有英文 label（Today/Yesterday/Last 7 days/Older），但 §7 原本的分组逻辑（按文件整体是否含中文字符
  二分为 zh_files/en_files）没有把"同文件内混用"作为独立类别显式报出来，只是碰巧让该文件同时出现在两个列表里。
- 修复：
  1. 重写 §7 检测逻辑，拆成两个独立子规则：(a) 同文件内混用（文件里既有含中文的 label 行、也有不含中文的 label 行）
     (b) 跨文件混用（一批文件整体纯中文 label、另一批整体纯英文 label，排除掉已经算进 (a) 的文件）。
  2. 所有真实命中的输出行统一加 `LABEL-LANG-MIX:` 前缀，且每行都带真实的 `文件路径:行号:源码内容`（用 `grep -F`
     锚定文件路径前缀，而不是原来会被 `(app)` 目录名里的括号打挂 `-E` 正则转义的写法——过程中还顺手修了一个
     bug：原来的 `${f//\//\\/}` 转义在 `grep -E` 里把 `(app)` 当成捕获组导致空匹配，在 `set -e` 下让整个脚本
     以 exit 1 收场，这个 bug 本身也是这次修复顺带发现并修掉的）。
  3. 把 feature_list.json F03 的 verification 命令改成锚定 `LABEL-LANG-MIX:` 前缀行，而不是脚本任意输出：
     `grep 'LABEL-LANG-MIX:' /tmp/lint-design-out.txt | grep -qiE 'ava|ai-store|surveys|admin'`。
     用一次"临时删掉 §7 整段逻辑"的反证跑法验证过：删掉规则后这条新命令确实会 exit 1（之前的旧命令不会），
     证明新验证不再是自证式的。
  4. 把 `evidence` 字段从空字符串补成 `phases/phase-p16-ui-nav-alignment/sprints/sprint-01/evidence/F03.verify.log`
     （完整 lint 输出 + 命令 + exit 结果）。
- 重新跑过的验证：
  - F03 新 verification 命令 → exit 0，且 `LABEL-LANG-MIX:` 输出里真实包含 `app/(app)/ava/page.tsx`、
    `app/(app)/admin/admin-home.tsx`、`app/(app)/admin/ai-store/review/page.tsx` 等新模块路径下的具体行。
  - `pnpm --filter web lint` → exit 0。
  - `pnpm -w run verify:base` → 仍是唯一失败任务 `@repo/auth#test`（同上一轮记录的 flaky timeout，与本次改动
    无关，单独跑 `pnpm --filter @repo/auth test` 稳定通过）。
- 未变的结论：§7 规则本身仍是警告级（不拦截 verify:base），原因不变——语言混用是项目级既有事实，修复归属
  phase-p17；这次只修了"验证命令测的是不是真东西"这个问题，没有改变"要不要现在拦截"的判断。
### 2026-07-03 00:46:39
- 本轮目标: worker wrk-lint-1 实现 p16:F03「Design lint 覆盖扩大到新增页面」（issue #222）
- 已完成:
  - 读完 `apps/web/scripts/lint-design.sh`：它是**全量 grep**（`grep -rn ... app components`），
    不是路径白名单/glob 限定，因此本来就"扫得到" Ava/AI Store/Surveys/Admin/Studio/Presentations
    这些新模块的文件；缺的是"有没有规则真的命中/输出提到这些路径"。
  - 新增规则 §7：跨模块 UI 标签（`label="..."` / `label: "..."`）中英文案一致性检测。
    只看明确的 UI 展示文案 prop，排除 `aria-label`/`components/ui/`，避免误伤 email 等自然
    中英混排字段。按文件分组判断该 prop 整体是纯中文还是纯英文，若项目里同时存在这两类文件，
    输出两侧文件清单。
  - 跑了扩大后的 lint：**规则确实抓到了真实问题**——`components/board/board-canvas.tsx`
    工具条用中文 label（选择/平移/连接线/便利贴/手绘/文本/形状/资源/嵌入/模板），
    与 `components/app-shell/sidebar.tsx`（Home/Rooms）、`app/(app)/account/page.tsx`、
    `app/(app)/credits/page.tsx` 等英文 label 模块不一致；此外还发现这个混用其实是
    **项目级**的（P0-P4 reskin 页面多为英文 label，harness pipeline 之后新建的
    Ava/Admin/Rooms/Studio 等模块多为中文 label），不只是 Board vs Sidebar 这一处。
  - 这条规则做成**警告级**（`echo "⚠ ..."`，不调用 `err()`/不置 `viol=1`），刻意不拦截
    `verify:base`。原因：如果做成硬门禁，首次上线就会让所有人的 `pnpm -w run verify:base`
    直接变红——这属于"发现了一个大范围既有问题"，修复是文案/reskin 层面的工作，
    归属 phase-p17，不是"扩大 lint 覆盖"这个 feature 的范围。规则本身的检测能力已经证明有效。
  - 按 F03 的 `verification` 命令要求，脚本输出现在会提到 `admin`/`ava`/`ai-store` 等
    新模块路径（例如 `app/(app)/admin/admin-home.tsx`、`app/(app)/ava/page.tsx`），
    满足验证命令里 `grep -qi 'ava|ai-store|surveys|admin'` 的语义。
- 运行过的验证:
  - `cd apps/web && bash scripts/lint-design.sh 2>&1 | tee /tmp/lint-design-out.txt; grep -qi 'ava\|ai-store\|surveys\|admin' /tmp/lint-design-out.txt` → exit 0（F03 verification 命令本身）
  - `pnpm --filter web lint` → exit 0
  - `pnpm -w run verify:base` → 整体 exit 1，但唯一失败任务是 `@repo/auth#test`
    （`password > hash 不等于明文，verify 正确匹配`，5000ms timeout），与本次改动无关；
    单独跑 `pnpm --filter @repo/auth test`（stash 掉本次改动 / 不 stash 都试过）均通过，
    确认是并发跑 turbo 全量任务时的 CPU 争抢导致的 flaky timeout，不是本 feature 引入的回归。
  - `@repo/web:lint` 在 `verify:base` 全量跑里本身正常完成（不在失败任务列表里）。
- 已记录证据: 本文件 + PR 描述里贴了 lint 完整输出。
- 提交记录: 见分支 `worker/wrk-lint-1-p16-f03-lint-coverage` 的 PR（Closes #222）。
- 已知风险或未解决问题:
  - Board 工具条中文 label vs 其余模块英文 label 混用问题**未修复**（有意为之，范围外）。
    修复归属 phase-p17 reskin round2。等那边把文案语言统一之后，可以把
    `lint-design.sh` §7 的 `echo "⚠ ..."` 改回 `err()`，让这条规则转正为硬门禁防止再劣化。
  - `@repo/auth#test` 存在 flaky timeout（与本 feature 无关，未处理，未记录到本 feature 的 issue，
    如果后续频繁复现建议单独开 issue 跟踪）。
- 下一步最佳动作: 等 F03 PR review 通过合并；下一轮可以评估是否要为 phase-p17 开一个
  「统一 UI 文案语言」的 feature，到时候把 §7 规则从 warn 转 err。
