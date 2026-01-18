import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          light: '#e3f2fd',
          DEFAULT: '#1976d2',
          dark: '#0d47a1',
        },
        success: {
          light: '#e8f5e9',
          DEFAULT: '#4caf50',
          dark: '#2e7d32',
        },
        warning: {
          light: '#fff3e0',
          DEFAULT: '#ff9800',
          dark: '#e65100',
        },
        danger: {
          light: '#ffebee',
          DEFAULT: '#f44336',
          dark: '#c62828',
        },
      },
    },
  },
  plugins: [],
};

export default config;
