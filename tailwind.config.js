/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class"],
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        border: "var(--rule)",
        input: "var(--rule)",
        ring: "var(--pine)",
        background: "var(--paper)",
        foreground: "var(--ink)",
        primary: {
          DEFAULT: "var(--pine)",
          foreground: "var(--chalk)",
        },
        secondary: {
          DEFAULT: "var(--plum)",
          foreground: "var(--chalk)",
        },
        destructive: {
          DEFAULT: "var(--red)",
          foreground: "var(--chalk)",
        },
        muted: {
          DEFAULT: "var(--paper)",
          foreground: "var(--soft)",
        },
        accent: {
          DEFAULT: "var(--pine-lt)",
          foreground: "var(--ink)",
        },
        popover: {
          DEFAULT: "var(--chalk)",
          foreground: "var(--ink)",
        },
        card: {
          DEFAULT: "var(--chalk)",
          foreground: "var(--ink)",
        },
        // Custom Command Board colors
        paper: "var(--paper)",
        chalk: "var(--chalk)",
        ink: "var(--ink)",
        soft: "var(--soft)",
        pine: "var(--pine)",
        "pine-lt": "var(--pine-lt)",
        plum: "var(--plum)",
        "plum-lt": "var(--plum-lt)",
        rule: "var(--rule)",
        amber: "var(--amber)",
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      boxShadow: {
        'glass': '0 4px 30px rgba(0, 0, 0, 0.1)',
        'glass-dark': '0 4px 30px rgba(0, 0, 0, 0.5)',
      }
    },
  },
  plugins: [require("tailwindcss-animate")],
}
