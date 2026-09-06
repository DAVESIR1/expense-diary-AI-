module.exports = {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
    // Only text-bearing formats — binary assets (png/jpg) must NOT be scanned,
    // otherwise Tailwind's extractor picks up random byte sequences as class
    // candidates (e.g. "[iCZ:$P%P...) and emits invalid utilities.
    './public/**/*.{html,js,svg}'
  ],
  theme: {
    extend: {},
  },
  plugins: [],
};
