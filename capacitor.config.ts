import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'ai.annadata.app',
  appName: 'annadata-fe',
  webDir: 'dist',
  plugins: {
    LlamaCpp: {
      // Plugin configuration options can go here
    }
  }
};

export default config;
