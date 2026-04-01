import { provideZonelessChangeDetection } from '@angular/core';
import {
  BootstrapContext,
  bootstrapApplication,
} from '@angular/platform-browser';
import { provideServerRendering } from '@angular/platform-server';
import { App } from './app/app';

const bootstrap = (context: BootstrapContext) =>
  bootstrapApplication(
    App,
    {
      providers: [provideServerRendering(), provideZonelessChangeDetection()],
    },
    context,
  );

export default bootstrap;
