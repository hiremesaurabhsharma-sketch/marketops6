import tailwindcss from '@tailwindcss/vite';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    plugins: [tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
    build: {
      rollupOptions: {
        input: {
          main: path.resolve(__dirname, 'index.html'),
          about: path.resolve(__dirname, 'about.html'),
          services: path.resolve(__dirname, 'services.html'),
          ecommerce: path.resolve(__dirname, 'ecommerce.html'),
          performanceMarketing: path.resolve(__dirname, 'performance-marketing.html'),
          websiteDevelopment: path.resolve(__dirname, 'website-development.html'),
          seo: path.resolve(__dirname, 'seo.html'),
          marketingCreative: path.resolve(__dirname, 'marketing-creative.html'),
          overseasBusiness: path.resolve(__dirname, 'overseas-business.html'),
          caseStudies: path.resolve(__dirname, 'case-studies.html'),
          contact: path.resolve(__dirname, 'contact.html'),
          policy: path.resolve(__dirname, 'policy.html'),
        },
      },
    },
  };
});
