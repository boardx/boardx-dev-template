export const log = {
  info: (m: string) => console.log(m),
  ok: (m: string) => console.log(`\u2713 ${m}`),
  warn: (m: string) => console.warn(`! ${m}`),
  err: (m: string) => console.error(`\u2717 ${m}`),
  step: (m: string) => console.log(`==> ${m}`),
};

export function die(message: string): never {
  console.error(`\u2717 ${message}`);
  process.exit(1);
}
