import type { Config } from "tailwindcss";
import tailwindcssAnimate from "tailwindcss-animate";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    container: {
      center: true,
      padding: { DEFAULT: "1rem", sm: "1.5rem", lg: "2rem" },
      screens: { "2xl": "1360px" },
    },
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
          /* Interaction steps for brand fills. */
          hover: "hsl(var(--primary-hover))",
          active: "hsl(var(--primary-active))",
          /* Accessible blue for text on light surfaces (#2563C7). */
          strong: "hsl(var(--primary-strong))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        success: {
          DEFAULT: "hsl(var(--success))",
          foreground: "hsl(var(--success-foreground))",
          /* Accessible text/icon step on tinted status surfaces. */
          strong: "hsl(var(--success-strong))",
        },
        warning: {
          DEFAULT: "hsl(var(--warning))",
          foreground: "hsl(var(--warning-foreground))",
          /* Accessible text/icon step on tinted status surfaces. */
          strong: "hsl(var(--warning-strong))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
          /* Decorative or large text only — below 4.5:1 on white. */
          subtle: "hsl(var(--subtle-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        navy: {
          DEFAULT: "hsl(var(--navy))",
          foreground: "hsl(var(--navy-foreground))",
          muted: "hsl(var(--navy-muted))",
          border: "hsl(var(--navy-border))",
        },
        brand: {
          50: "#eef6ff",
          100: "#d9eaff",
          200: "#bbdaff",
          300: "#8ac3ff",
          400: "#52a2ff",
          500: "#2a7ef5",
          600: "#1560e0",
          700: "#0f4bb5",
          800: "#123f8f",
          900: "#143771",
          950: "#0d2246",
        },
        cyanx: {
          400: "#22b8e6",
          500: "#0c9ccb",
          600: "#087ba6",
        },
        ember: {
          400: "#fb923c",
          500: "#f5721a",
          600: "#d95c0c",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "SFMono-Regular", "monospace"],
      },
      /* Soft blue-grey shadows (#172033 at low alpha) rather than neutral black. */
      boxShadow: {
        xs: "0 1px 2px 0 rgb(23 32 51 / 0.05)",
        sm: "0 1px 3px 0 rgb(23 32 51 / 0.07), 0 1px 2px -1px rgb(23 32 51 / 0.05)",
        md: "0 6px 14px -4px rgb(23 32 51 / 0.10), 0 2px 6px -2px rgb(23 32 51 / 0.06)",
        lg: "0 14px 28px -8px rgb(23 32 51 / 0.12), 0 4px 10px -4px rgb(23 32 51 / 0.07)",
        panel: "0 1px 2px rgb(23 32 51 / 0.04), 0 10px 28px -14px rgb(23 32 51 / 0.18)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        "fade-in": {
          from: { opacity: "0", transform: "translateY(6px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "fade-in-fast": {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        "pulse-ring": {
          "0%": { boxShadow: "0 0 0 0 hsl(var(--destructive) / 0.45)" },
          "70%": { boxShadow: "0 0 0 12px hsl(var(--destructive) / 0)" },
          "100%": { boxShadow: "0 0 0 0 hsl(var(--destructive) / 0)" },
        },
        "scan-line": {
          "0%": { transform: "translateY(-100%)" },
          "100%": { transform: "translateY(1100%)" },
        },
        shimmer: {
          "100%": { transform: "translateX(100%)" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "fade-in": "fade-in 0.35s ease-out both",
        "fade-in-fast": "fade-in-fast 0.2s ease-out both",
        "pulse-ring": "pulse-ring 2s infinite",
        "scan-line": "scan-line 2.4s ease-in-out infinite",
        shimmer: "shimmer 1.8s infinite",
      },
    },
  },
  plugins: [tailwindcssAnimate],
};

export default config;
