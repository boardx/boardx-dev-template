// 极简 YAML 解析器:支持块级 map/seq、缩进、行内 [..] / {..}、标量(引号/布尔/数字/null)。
// 刻意保持最小;若超出本仓库配置的复杂度,可替换为 npm 包 `yaml`。

type Y = unknown;

function stripComment(line: string): string {
  let inS = false, inD = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === "'" && !inD) inS = !inS;
    else if (c === '"' && !inS) inD = !inD;
    else if (c === "#" && !inS && !inD && (i === 0 || line[i - 1] === " ")) {
      return line.slice(0, i);
    }
  }
  return line;
}

function scalar(raw: string): Y {
  const s = raw.trim();
  if (s === "" || s === "~" || s === "null") return null;
  if (s === "true") return true;
  if (s === "false") return false;
  if (/^-?\d+$/.test(s)) return parseInt(s, 10);
  if (/^-?\d*\.\d+$/.test(s)) return parseFloat(s);
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    return s.slice(1, -1);
  }
  if (s.startsWith("[") && s.endsWith("]")) return flowSeq(s.slice(1, -1));
  if (s.startsWith("{") && s.endsWith("}")) return flowMap(s.slice(1, -1));
  return s;
}

function splitTop(body: string): string[] {
  const out: string[] = [];
  let depth = 0, inS = false, inD = false, cur = "";
  for (const c of body) {
    if (c === "'" && !inD) inS = !inS;
    else if (c === '"' && !inS) inD = !inD;
    if (!inS && !inD) {
      if (c === "[" || c === "{") depth++;
      else if (c === "]" || c === "}") depth--;
      else if (c === "," && depth === 0) { out.push(cur); cur = ""; continue; }
    }
    cur += c;
  }
  if (cur.trim() !== "") out.push(cur);
  return out;
}

function flowSeq(body: string): Y[] {
  if (body.trim() === "") return [];
  return splitTop(body).map((p) => scalar(p));
}

function flowMap(body: string): Record<string, Y> {
  const o: Record<string, Y> = {};
  if (body.trim() === "") return o;
  for (const p of splitTop(body)) {
    const i = p.indexOf(":");
    if (i === -1) continue;
    o[p.slice(0, i).trim()] = scalar(p.slice(i + 1));
  }
  return o;
}

interface Line { indent: number; text: string; }

function lex(text: string): Line[] {
  const out: Line[] = [];
  for (const raw of text.split("\n")) {
    const noc = stripComment(raw);
    if (noc.trim() === "") continue;
    out.push({ indent: noc.length - noc.trimStart().length, text: noc.trim() });
  }
  return out;
}

function parseBlock(lines: Line[], start: number, indent: number): [Y, number] {
  const first = lines[start];
  if (!first) return [null, start];
  if (first.text.startsWith("- ")) return parseSeq(lines, start, indent);
  return parseMap(lines, start, indent);
}

function parseSeq(lines: Line[], start: number, indent: number): [Y[], number] {
  const arr: Y[] = [];
  let i = start;
  while (i < lines.length) {
    const ln = lines[i];
    if (!ln || ln.indent < indent || !ln.text.startsWith("- ")) break;
    const rest = ln.text.slice(2);
    const colon = topColon(rest);
    if (colon !== -1) {
      // 列表项是个 map:把首个 "key: ..." 与后续同缩进行合并成一个子 map
      const synthetic: Line[] = [{ indent: indent + 2, text: rest }];
      let j = i + 1;
      while (j < lines.length && lines[j]!.indent > indent) { synthetic.push(lines[j]!); j++; }
      const [val] = parseMap(synthetic, 0, indent + 2);
      arr.push(val);
      i = j;
    } else {
      arr.push(scalar(rest));
      i++;
    }
  }
  return [arr, i];
}

function topColon(s: string): number {
  let inS = false, inD = false, depth = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === "'" && !inD) inS = !inS;
    else if (c === '"' && !inS) inD = !inD;
    else if (!inS && !inD) {
      if (c === "[" || c === "{") depth++;
      else if (c === "]" || c === "}") depth--;
      else if (c === ":" && depth === 0 && (i + 1 >= s.length || s[i + 1] === " ")) return i;
    }
  }
  return -1;
}

function parseMap(lines: Line[], start: number, indent: number): [Record<string, Y>, number] {
  const obj: Record<string, Y> = {};
  let i = start;
  while (i < lines.length) {
    const ln = lines[i];
    if (!ln || ln.indent < indent) break;
    if (ln.indent > indent) { i++; continue; }
    const ci = topColon(ln.text);
    if (ci === -1) break;
    const key = ln.text.slice(0, ci).trim();
    const inline = ln.text.slice(ci + 1).trim();
    if (inline !== "") {
      obj[key] = scalar(inline);
      i++;
    } else {
      const next = lines[i + 1];
      if (next && next.indent > indent) {
        const [val, ni] = parseBlock(lines, i + 1, next.indent);
        obj[key] = val;
        i = ni;
      } else if (next && next.indent === indent && next.text.startsWith("- ")) {
        const [val, ni] = parseSeq(lines, i + 1, indent);
        obj[key] = val;
        i = ni;
      } else {
        obj[key] = null;
        i++;
      }
    }
  }
  return [obj, i];
}

export function parseYaml(text: string): Y {
  const lines = lex(text);
  if (lines.length === 0) return null;
  const [val] = parseBlock(lines, 0, lines[0]!.indent);
  return val;
}
