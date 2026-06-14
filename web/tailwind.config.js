/** @type {import('tailwindcss').Config} */
const withAlpha = (v) => `rgb(var(${v}) / <alpha-value>)`;

export default {
  darkMode: ["class"],
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        background: withAlpha("--bg"),
        surface: withAlpha("--surface"),
        "surface-2": withAlpha("--surface-2"),
        border: withAlpha("--border"),
        "border-strong": withAlpha("--border-strong"),
        input: withAlpha("--border"),
        ring: withAlpha("--primary"),
        foreground: withAlpha("--foreground"),
        faint: withAlpha("--faint"),
        primary: { DEFAULT: withAlpha("--primary"), foreground: withAlpha("--primary-foreground") },
        secondary: { DEFAULT: withAlpha("--surface-2"), foreground: withAlpha("--foreground") },
        accent: { DEFAULT: withAlpha("--surface-2"), foreground: withAlpha("--foreground") },
        destructive: { DEFAULT: withAlpha("--danger"), foreground: withAlpha("--foreground") },
        muted: { DEFAULT: withAlpha("--surface-2"), foreground: withAlpha("--muted") },
        card: { DEFAULT: withAlpha("--surface"), foreground: withAlpha("--foreground") },
        // Espectro de ciclo de vida do ambiente
        amber: withAlpha("--amber"),
        ready: withAlpha("--ready"),
        danger: withAlpha("--danger"),
        slate: withAlpha("--slate"),
      },
      fontFamily: {
        display: ['"Space Grotesk"', "system-ui", "sans-serif"],
        sans: ['"IBM Plex Sans"', "system-ui", "sans-serif"],
        mono: ['"IBM Plex Mono"', "ui-monospace", "monospace"],
      },
      borderRadius: {
        lg: "0.75rem",
        md: "0.5rem",
        sm: "0.375rem",
      },
      boxShadow: {
        glow: "0 0 0 1px rgb(var(--primary) / 0.25), 0 8px 30px -8px rgb(var(--primary) / 0.35)",
        panel: "0 1px 0 0 rgb(255 255 255 / 0.02) inset, 0 20px 40px -24px rgb(0 0 0 / 0.7)",
      },
      keyframes: {
        "pulse-core": {
          "0%, 100%": { opacity: "1", transform: "scale(1)" },
          "50%": { opacity: "0.45", transform: "scale(0.82)" },
        },
        "fade-up": {
          from: { opacity: "0", transform: "translateY(8px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "sheen": {
          from: { backgroundPosition: "200% 0" },
          to: { backgroundPosition: "-200% 0" },
        },
      },
      animation: {
        "pulse-core": "pulse-core 1.6s ease-in-out infinite",
        "fade-up": "fade-up 0.4s ease both",
        sheen: "sheen 2.4s linear infinite",
      },
    },
  },
  plugins: [],
};
