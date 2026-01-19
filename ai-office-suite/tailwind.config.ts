import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#1337ec',
          dark: '#0f2cb8',
          light: '#eff3ff',
        },
        background: {
          light: '#f6f6f8',
          DEFAULT: '#f8fafc',
        },
        surface: {
          DEFAULT: '#ffffff',
          highlight: '#f3f4f6',
        },
        border: {
          DEFAULT: '#e5e7eb',
          light: '#f1f5f9',
        },
      },
      fontFamily: {
        display: ['Noto Sans SC', 'sans-serif'],
        sans: ['Noto Sans SC', 'sans-serif'],
      },
      borderRadius: {
        DEFAULT: '0.25rem',
        lg: '0.5rem',
        xl: '0.75rem',
      },
      boxShadow: {
        'primary': '0 4px 14px 0 rgba(19, 55, 236, 0.2)',
        'card': '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
      },
    },
  },
  plugins: [],
}
export default config
