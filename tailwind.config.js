/** @type {import('tailwindcss').Config} */
export default {
    content: ['./src/**/*.{html,js,svelte,ts}'],
    theme: {
        extend: {
            animation: {
                'pulse-slow': 'pulse-slow 11s cubic-bezier(0.4, 0, 0.6, 1) infinite',
            },
            keyframes: {
                'pulse-slow': {
                    '0%, 100%': { opacity: 1 },
                    '36%': { opacity: 0.5 },
                }
            }
        },
    },
    plugins: [],
}
