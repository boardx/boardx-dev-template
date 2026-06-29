import { readFileSync } from "node:fs";
import { join } from "node:path";
import { TEMPLATES_DIR } from "./paths";

export function render(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_m, k: string) =>
    Object.prototype.hasOwnProperty.call(vars, k) ? vars[k]! : `{{${k}}}`
  );
}

export function renderTemplateFile(name: string, vars: Record<string, string>): string {
  const tpl = readFileSync(join(TEMPLATES_DIR, name), "utf8");
  return render(tpl, vars);
}

export function nowISO(): string {
  return new Date().toISOString().slice(0, 19).replace("T", " ");
}
