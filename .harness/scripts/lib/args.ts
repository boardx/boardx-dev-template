export interface Args {
  _: string[];
  flags: Record<string, boolean>;
  opts: Record<string, string>;
}

export function parseArgs(argv: string[]): Args {
  const out: Args = { _: [], flags: {}, opts: {} };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (a.startsWith("--")) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next === undefined || next.startsWith("--")) {
        out.flags[key] = true;
      } else {
        out.opts[key] = next;
        i++;
      }
    } else {
      out._.push(a);
    }
  }
  return out;
}

export function req(args: Args, key: string): string {
  const v = args.opts[key];
  if (v === undefined) throw new Error(`缺少必填参数 --${key}`);
  return v;
}
