import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  return {
    server: {
      proxy: {
        '/api': {
          target: env.VITE_BACKEND_PROXY_TARGET,
          changeOrigin: true,
        },
      },
    },
  };
});
