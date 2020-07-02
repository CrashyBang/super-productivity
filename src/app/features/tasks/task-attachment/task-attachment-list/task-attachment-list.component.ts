import { ChangeDetectionStrategy, Component, Input, OnInit } from '@angular/core';
import { TaskAttachment } from '../task-attachment.model';
import { TaskAttachmentService } from '../task-attachment.service';
import { MatDialog } from '@angular/material/dialog';
import { DialogEditTaskAttachmentComponent } from '../dialog-edit-attachment/dialog-edit-task-attachment.component';
import { standardListAnimation } from '../../../../ui/animations/standard-list.ani';
import { T } from '../../../../t.const';

@Component({
  selector: 'task-attachment-list',
  templateUrl: './task-attachment-list.component.html',
  styleUrls: ['./task-attachment-list.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  animations: [standardListAnimation]
})
export class TaskAttachmentListComponent implements OnInit {
  @Input() taskId: string;
  @Input() attachments: TaskAttachment[];
  @Input() isDisableControls: boolean = false;

  T: any = T;
  isError: boolean[] = [];

  constructor(
    public readonly attachmentService: TaskAttachmentService,
    private readonly _matDialog: MatDialog,
  ) {
  }

  ngOnInit() {
  }

  openEditDialog(attachment?: TaskAttachment) {
    if (!this.taskId) {
      throw new Error('No task id given');
    }

    this._matDialog.open(DialogEditTaskAttachmentComponent, {
      restoreFocus: true,
      data: {
        attachment
      },
    }).afterClosed()
      .subscribe((attachmentIN) => {
        if (attachmentIN) {
          if (attachmentIN.id) {
            this.attachmentService.updateAttachment(this.taskId, attachmentIN.id, attachmentIN);
          } else {
            this.attachmentService.addAttachment(this.taskId, attachmentIN);
          }
        }
      });
  }

  remove(id: string) {
    this.attachmentService.deleteAttachment(this.taskId, id);
  }

  trackByFn(i: number, attachment: TaskAttachment) {
    return attachment
      ? attachment.id
      : i;
  }
}
