import type { StorybookConfig } from '@storybook/angular';

const config: StorybookConfig = {
  stories: ['../src/app/**/*.stories.ts'],
  addons: [],
  framework: { name: '@storybook/angular', options: {} },
  core: { disableTelemetry: true, disableWhatsNewNotifications: true },
};

export default config;
