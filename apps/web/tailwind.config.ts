import type { Config } from "tailwindcss";
import animate from "tailwindcss-animate";

// 颜色全部映射到 globals.css 的 HSL 语义变量（继承自 oldcode 黑白灰主题）。
// 组件只用语义类（bg-background/bg-primary/text-muted-foreground…），不硬编码颜色。
const config: Config = {
  darkMode: "class",
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: { DEFAULT: "hsl(var(--primary))", foreground: "hsl(var(--primary-foreground))" },
        secondary: { DEFAULT: "hsl(var(--secondary))", foreground: "hsl(var(--secondary-foreground))" },
        destructive: { DEFAULT: "hsl(var(--destructive))", foreground: "hsl(var(--destructive-foreground))" },
        success: { DEFAULT: "hsl(var(--success))", foreground: "hsl(var(--success-foreground))" },
        muted: { DEFAULT: "hsl(var(--muted))", foreground: "hsl(var(--muted-foreground))" },
        disabled: { DEFAULT: "hsl(var(--disabled))", foreground: "hsl(var(--disabled-foreground))" },
        accent: { DEFAULT: "hsl(var(--accent))", foreground: "hsl(var(--accent-foreground))" },
        popover: { DEFAULT: "hsl(var(--popover))", foreground: "hsl(var(--popover-foreground))" },
        card: { DEFAULT: "hsl(var(--card))", foreground: "hsl(var(--card-foreground))" },
        // 扩展中性档（对齐 BoardX Prototype 设计 hex）
        "border-strong": "hsl(var(--border-strong))",
        placeholder: "hsl(var(--placeholder))",
        surface: {
          1: "hsl(var(--surface-1))",
          2: "hsl(var(--surface-2))",
          3: "hsl(var(--surface-3))",
          darkest: "hsl(var(--surface-darkest))",
          dark: "hsl(var(--surface-dark))",
          "dark-2": "hsl(var(--surface-dark-2))",
          "dark-foreground": "hsl(var(--surface-dark-foreground))",
        },
        // 语义柔彩（标签/状态-soft 底色）
        tag: {
          green: "hsl(var(--tag-green))",
          blue: "hsl(var(--tag-blue))",
          purple: "hsl(var(--tag-purple))",
          pink: "hsl(var(--tag-pink))",
          yellow: "hsl(var(--tag-yellow))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
        // 设计常用圆角（px 命名，避免 [Npx] 任意值）
        "7": "7px",
        "9": "9px",
        "10": "10px",
        "11": "11px",
        "12": "12px",
        "14": "14px",
      },
      // 设计 token 字号网格（对齐 BoardX Prototype；以 px 命名，避免 [Npx] 任意值）。
      // 行高交给 leading-* 工具类按需设置。
      fontSize: {
        "9": "9px",
        "10": "10px",
        "11": "11px",
        "13": "13px",
        "15": "15px",
        "17": "17px",
        "22": "22px",
        "26": "26px",
        "30": "30px",
        "34": "34px",
      },
      // 设计 token 间距/尺寸网格。键 = px/4（与 Tailwind rem 网格同构），
      // 仅补 Tailwind 默认缺失的档（7/9/11/13/15/17/18/22/26/30/34/42px + 常用宽度）。
      spacing: {
        "1.25": "5px",
        "1.75": "7px",
        "2.25": "9px",
        "2.75": "11px",
        "3.25": "13px",
        "3.75": "15px",
        "4.25": "17px",
        "4.5": "18px",
        "5.5": "22px",
        "6.5": "26px",
        "7.5": "30px",
        "8.5": "34px",
        "10.5": "42px",
        "11.5": "46px",
        "15": "60px",
        "62": "248px",
        "85": "340px",
      },
      maxWidth: {
        brand: "420px",
        content: "980px",
      },
    },
  },
  plugins: [animate],
};

export default config;
