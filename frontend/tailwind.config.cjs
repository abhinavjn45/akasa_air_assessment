module.exports = {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        canvas: 'var(--color-background)',
        detail: 'var(--color-background-detail)',
        surface: 'var(--color-surface)',
        ink: 'var(--color-text-primary)',
        muted: 'var(--color-text-secondary)',
        disabled: 'var(--color-text-disabled)',
        line: 'var(--color-border)',
        focus: 'var(--color-focus-ring)',
        success: 'var(--color-success)',
        warning: 'var(--color-warning)',
        danger: 'var(--color-danger)',
        info: 'var(--color-info)',
        link: {
          DEFAULT: 'var(--color-link)',
          hover: 'var(--color-link-hover)',
        },
        brand: {
          orange: 'var(--color-brand-orange)',
          purple: 'var(--color-brand-purple)',
          hover: 'var(--color-brand-orange-hover)',
        },
      },
    },
  },
  plugins: [],
};
