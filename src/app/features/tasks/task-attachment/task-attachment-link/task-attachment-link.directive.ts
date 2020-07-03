import { Directive, HostListener, Input } from '@angular/core';
import { IS_ELECTRON } from '../../../../app.constants';
import { TaskAttachmentType } from '../task-attachment.model';
import { SnackService } from '../../../../core/snack/snack.service';
import { IPC } from '../../../../../../electron/ipc-events.const';
import { T } from '../../../../t.const';
import { ElectronService } from '../../../../core/electron/electron.service';

@Directive({
  selector: '[taskAttachmentLink]'
})
export class TaskAttachmentLinkDirective {

  @Input() type: TaskAttachmentType;
  @Input() href: TaskAttachmentType;

  constructor(
    private _electronService: ElectronService,
    private _snackService: SnackService,
  ) {
  }

  @HostListener('click', ['$event']) onClick(ev: Event) {
    if (ev.target) {
      const el = ev.target as HTMLElement;
      el.blur();
    }
    if (IS_ELECTRON) {
      ev.preventDefault();
      if (!this.type || this.type === 'LINK') {
        this._openExternalUrl(this.href);
      } else if (this.type === 'FILE') {
        this._electronService.shell.openPath(this.href);
      } else if (this.type === 'COMMAND') {
        this._snackService.open({
          msg: T.GLOBAL_SNACK.RUNNING_X,
          translateParams: {str: this.href},
          ico: 'laptop_windows',
        });
        this._exec(this.href);
      }
    } else if (this.type === 'LINK') {
      this._openExternalUrl(this.href);
    }
  }

  private _openExternalUrl(rawUrl: string) {
    if (!rawUrl) {
      return;
    }

    // try to account for jira(?) adding a second http to the url
    const url = rawUrl
      .replace('https://https://', 'https://')
      .replace('http://http://', 'http://');

    if (IS_ELECTRON) {
      this._electronService.shell.openExternal(url);
    } else {
      const win = window.open(url, '_blank');
      win.focus();
    }
  }

  private _exec(command: string) {
    (this._electronService.ipcRenderer as typeof ipcRenderer).send(IPC.EXEC, command);
  }
}
