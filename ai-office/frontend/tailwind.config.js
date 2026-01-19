/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                "primary": "#1337ec",
                "primary-dark": "#0f2cb8",
                "primary-light": "#eff3ff",
                "background-light": "#f6f6f8",
                "surface": "#ffffff",
                "surface-highlight": "#f3f4f6",
                "text-main": "#111827",
                "text-muted": "#6b7280",
                "grid-border": "#e2e8f0",
            },
            fontFamily: {
                "sans": ["'Noto Sans SC'", "sans-serif"],
                "display": ["'Noto Sans SC'", "sans-serif"]
            },
        },
    },
    plugins: [],
}
