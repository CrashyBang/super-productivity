import { enableProdMode } from '@angular/core';
import { platformBrowserDynamic } from '@angular/platform-browser-dynamic';

import { AppModule } from './app/app.module';
import { environment } from './environments/environment';
import { IS_ELECTRON } from './app/app.constants';
import 'hammerjs';
import { IS_ANDROID_WEB_VIEW } from './app/util/is-android-web-view';
import { androidInterface } from './app/core/android/android-interface';

if (environment.production) {
  enableProdMode();
}

platformBrowserDynamic().bootstrapModule(AppModule).then(() => {
  // TODO make asset caching work for electron
  if ('serviceWorker' in navigator && environment.production && !IS_ELECTRON) {
    return navigator.serviceWorker.register('ngsw-worker.js');
  }
}).catch(err => console.log(err));

declare global {
  interface Window {
    ipcRenderer: any;
  }
}
// fix mobile scrolling while dragging
window.addEventListener('touchmove', () => {
});

if (!environment.production && IS_ANDROID_WEB_VIEW) {
  setTimeout(() => {
    androidInterface.showToast('Android DEV works');
    console.log(androidInterface);
  }, 1000);
}
