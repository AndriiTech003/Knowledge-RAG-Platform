import '@angular/localize/init';
import { provideZonelessChangeDetection } from '@angular/core';
import { applicationConfig, type Preview } from '@storybook/angular';

const preview: Preview = {
  decorators: [applicationConfig({ providers: [provideZonelessChangeDetection()] })],
  parameters: {
    layout: 'padded',
    controls: { expanded: true },
  },
  tags: ['test'],
};

export default preview;
