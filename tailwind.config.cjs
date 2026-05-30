/** @type {import('tailwindcss').Config} */
module.exports = {
    content: ["./src/index.html", "./src/main.js"],
    darkMode: "class",
    theme: {
        extend: {
            colors: {
                "primary": "#7f13ec",
                "background-light": "#f7f6f8",
                "background-dark": "#191022",
            },
            fontFamily: {
                "display": ["Spline Sans", "sans-serif"]
            },
            borderRadius: {
                "DEFAULT": "0.25rem",
                "lg": "0.5rem",
                "xl": "0.75rem",
                "full": "9999px"
            },
        },
    },
    plugins: [
        require('@tailwindcss/forms'),
        require('@tailwindcss/container-queries'),
    ],
}
