import {
  AfterViewInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ComponentFactoryResolver,
  HostBinding,
  Input,
  OnDestroy,
  QueryList,
  ViewChild,
  ViewChildren
} from '@angular/core';
import { ShowSubTasksMode, TaskAdditionalInfoTargetPanel, TaskWithSubTasks } from '../task.model';
import { IssueService } from '../../issue/issue.service';
import { TaskAttachmentService } from '../task-attachment/task-attachment.service';
import { BehaviorSubject, merge, Observable, of, Subject, Subscription } from 'rxjs';
import { TaskAttachment, TaskAttachmentCopy } from '../task-attachment/task-attachment.model';
import { catchError, delay, filter, map, shareReplay, switchMap, withLatestFrom } from 'rxjs/operators';
import { T } from '../../../t.const';
import { TaskService } from '../task.service';
import { expandAnimation, expandFadeInOnlyAnimation } from '../../../ui/animations/expand.ani';
import { fadeAnimation } from '../../../ui/animations/fade.ani';
import { swirlAnimation } from '../../../ui/animations/swirl-in-out.ani';
import { DialogTimeEstimateComponent } from '../dialog-time-estimate/dialog-time-estimate.component';
import { MatDialog } from '@angular/material/dialog';
import { isTouchOnly } from '../../../util/is-touch';
import { DialogAddTaskReminderComponent } from '../dialog-add-task-reminder/dialog-add-task-reminder.component';
import { AddTaskReminderInterface } from '../dialog-add-task-reminder/add-task-reminder-interface';
import { ReminderCopy } from '../../reminder/reminder.model';
import { ReminderService } from '../../reminder/reminder.service';
import { DialogEditTaskRepeatCfgComponent } from '../../task-repeat-cfg/dialog-edit-task-repeat-cfg/dialog-edit-task-repeat-cfg.component';
import { TaskRepeatCfgService } from '../../task-repeat-cfg/task-repeat-cfg.service';
import { TaskRepeatCfg } from '../../task-repeat-cfg/task-repeat-cfg.model';
import * as moment from 'moment';
import { DialogEditTaskAttachmentComponent } from '../task-attachment/dialog-edit-attachment/dialog-edit-task-attachment.component';
import { taskAdditionalInfoTaskChangeAnimation } from './task-additional-info.ani';
import { noopAnimation } from '../../../ui/animations/noop.ani';
import { TaskAdditionalInfoItemComponent } from './task-additional-info-item/task-additional-info-item.component';
import { IssueData, IssueProviderKey } from '../../issue/issue.model';
import { JIRA_TYPE } from '../../issue/issue.const';
import { ProjectService } from '../../project/project.service';
import { IS_ELECTRON } from '../../../app.constants';
import { IPC } from '../../../../../electron/ipc-events.const';
import { ElectronService } from '../../../core/electron/electron.service';
import { LayoutService } from '../../../core-ui/layout/layout.service';

@Component({
  selector: 'task-additional-info',
  templateUrl: './task-additional-info.component.html',
  styleUrls: ['./task-additional-info.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  animations: [expandAnimation, expandFadeInOnlyAnimation, fadeAnimation, swirlAnimation, taskAdditionalInfoTaskChangeAnimation, noopAnimation]

})
export class TaskAdditionalInfoComponent implements AfterViewInit, OnDestroy {
  @HostBinding('@noop') alwaysTrue: boolean = true;

  @ViewChildren(TaskAdditionalInfoItemComponent) itemEls: QueryList<TaskAdditionalInfoItemComponent>;
  @ViewChild('attachmentPanelElRef') attachmentPanelElRef: TaskAdditionalInfoItemComponent;

  ShowSubTasksMode: typeof ShowSubTasksMode = ShowSubTasksMode;
  selectedItemIndex: number = 0;
  isFocusNotes: boolean = false;
  T: any = T;
  issueAttachments: TaskAttachment[];
  reminderId$: BehaviorSubject<string | null> = new BehaviorSubject(null);
  reminderData$: Observable<ReminderCopy> = this.reminderId$.pipe(
    switchMap(id => id
      ? this._reminderService.getById$(id)
      : of(null)
    ),
  );

  issueIdAndType$: Subject<{ id: string | number; type: IssueProviderKey }> = new Subject();
  issueIdAndTypeShared$: Observable<{ id: string | number; type: IssueProviderKey }> = this.issueIdAndType$.pipe(
    shareReplay(1),
  );

  issueDataNullTrigger$: Subject<{ id: string | number; type: IssueProviderKey }> = new Subject();

  issueDataTrigger$: Observable<{ id: string | number; type: IssueProviderKey }> = merge(
    this.issueIdAndTypeShared$,
    this.issueDataNullTrigger$
  );
  issueData: IssueData;
  repeatCfgId$: BehaviorSubject<string | null> = new BehaviorSubject(null);
  repeatCfgDays$: Observable<string> = this.repeatCfgId$.pipe(
    switchMap(id => (id)
      ? this._taskRepeatCfgService.getTaskRepeatCfgById$(id).pipe(
        map(repeatCfg => {
          if (!repeatCfg) {
            return null;
          }
          const days: (keyof TaskRepeatCfg)[] = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
          const localWeekDays = moment.weekdaysMin();
          return days.filter(day => repeatCfg[day])
            .map((day, index) => localWeekDays[days.indexOf(day)])
            .join(', ');
        }),
      )

      : of(null)
    ),
  );
  parentId$: BehaviorSubject<string> = new BehaviorSubject(null);
  parentTaskData$: Observable<TaskWithSubTasks> = this.parentId$.pipe(
    switchMap((id) => id ? this.taskService.getByIdWithSubTaskData$(id) : of(null))
  );
  localAttachments: TaskAttachment[];
  issueAttachments$: Observable<TaskAttachmentCopy[]> = this.issueData$.pipe(
    withLatestFrom(this.issueIdAndTypeShared$),
    map(([data, {type}]) => (data && type)
      ? this._issueService.getMappedAttachments(type, data)
      : [])
  );
  private _taskData: TaskWithSubTasks;
  issueData$: Observable<IssueData> = this.issueDataTrigger$.pipe(
    switchMap((args) => (args && args.id && args.type)
      ? this._issueService.getById$(args.type, args.id, this._taskData.projectId)
        // ? throwError({[HANDLED_ERROR_PROP_STR]: 'XX'})
        .pipe(
          // delayWhen(x => timer(3000)),
          // NOTE we need this, otherwise the error is going to weird up the observable
          catchError(() => {
            return of(false);
          }),
        )
      : of(null)),
    shareReplay(1),
    // NOTE: this seems to fix the issue loading bug, when we end up with the
    // expandable closed when the data is loaded
    delay(0),
  );
  private _focusTimeout: number;
  private _subs: Subscription = new Subscription();

  constructor(
    public attachmentService: TaskAttachmentService,
    public taskService: TaskService,
    public layoutService: LayoutService,
    private _resolver: ComponentFactoryResolver,
    private _issueService: IssueService,
    private _reminderService: ReminderService,
    private _taskRepeatCfgService: TaskRepeatCfgService,
    private _matDialog: MatDialog,
    private _projectService: ProjectService,
    private _electronService: ElectronService,
    private _cd: ChangeDetectorRef,
  ) {
    // NOTE: needs to be assigned here before any setter is called
    this._subs.add(this.issueAttachments$.subscribe((attachments) => this.issueAttachments = attachments));
    this._subs.add(this.issueData$.subscribe((issueData) => {
      this.issueData = issueData;
      this._cd.detectChanges();
    }));

    // NOTE: this works as long as there is no other place to display issue attachments for jira
    if (IS_ELECTRON) {
      this._subs.add(this.issueIdAndTypeShared$.pipe(
        filter(({id, type}) => type === JIRA_TYPE),
        // not strictly reactive reactive but should work a 100% as issueIdAndType are triggered after task data
        switchMap(() => this._projectService.getJiraCfgForProject$(this._taskData.projectId))
      ).subscribe((jiraCfg) => {
        if (jiraCfg.isEnabled) {
          this._electronService.ipcRenderer.send(IPC.JIRA_SETUP_IMG_HEADERS, jiraCfg);
        }
      }));
    }
    // this.issueIdAndType$.subscribe((v) => console.log('issueIdAndType$', v));
    // this.issueDataTrigger$.subscribe((v) => console.log('issueDataTrigger$', v));
    // this.issueData$.subscribe((v) => console.log('issueData$', v));
  }

  get task(): TaskWithSubTasks {
    return this._taskData;
  }

  @Input() set task(newVal: TaskWithSubTasks) {
    const prev = this._taskData;
    this._taskData = newVal;
    this.localAttachments = newVal.attachments;

    if (!prev || !newVal || (prev.id !== newVal.id)) {
      this._focusFirst();
    }

    // NOTE: check for task change or issue update
    if (!prev || (prev.issueId !== newVal.issueId || newVal.issueWasUpdated === true && !prev.issueWasUpdated)) {
      this.issueDataNullTrigger$.next(null);
      this.issueIdAndType$.next({
        id: newVal.issueId,
        type: newVal.issueType
      });
    }
    if (!newVal.issueId) {
      this.issueDataNullTrigger$.next(null);
    }

    if (!prev || prev.issueId !== newVal.issueId) {
      this.reminderId$.next(newVal.reminderId);
    }

    if (!prev || prev.issueId !== newVal.issueId) {
      this.repeatCfgId$.next(newVal.repeatCfgId);
    }

    if (!prev || prev.issueId !== newVal.issueId) {
      this.parentId$.next(newVal.parentId);
    }
  }

  get progress() {
    return this._taskData && this._taskData.timeEstimate && (this._taskData.timeSpent / this._taskData.timeEstimate) * 100;
  }

  ngAfterViewInit(): void {
    this._subs.add(this.taskService.taskAdditionalInfoTargetPanel$.pipe(
      // hacky but we need a minimal delay to make sure selectedTaskId is ready
      delay(50),
      withLatestFrom(this.taskService.selectedTaskId$),
      filter(([, id]) => !!id),
    ).subscribe(([v]) => {
      if (v === TaskAdditionalInfoTargetPanel.Attachments) {
        this.focusItem(this.attachmentPanelElRef);
      } else {
        this._focusFirst();
      }
    }));
  }

  ngOnDestroy(): void {
    window.clearTimeout(this._focusTimeout);
  }

  changeTaskNotes($event: string) {
    this.taskService.update(this.task.id, {notes: $event});
  }

  close() {
    this.taskService.setSelectedId(null);
  }

  estimateTime() {
    this._matDialog
      .open(DialogTimeEstimateComponent, {
        data: {task: this.task},
        autoFocus: !isTouchOnly(),
      });
  }

  editReminder() {
    if (this.task.repeatCfgId) {
      return;
    }

    this._matDialog.open(DialogAddTaskReminderComponent, {
      restoreFocus: true,
      data: {task: this.task} as AddTaskReminderInterface
    });
  }

  editTaskRepeatCfg() {
    this._matDialog.open(DialogEditTaskRepeatCfgComponent, {
      restoreFocus: false,
      data: {
        task: this.task,
      }
    });
  }

  addAttachment() {
    this._matDialog
      .open(DialogEditTaskAttachmentComponent, {
        data: {},
      })
      .afterClosed()
      .subscribe(result => {
        if (result) {
          this.attachmentService.addAttachment(this.task.id, {
            ...result,
          });
        }
      });
  }

  addSubTask() {
    this.taskService.addSubTaskTo(this.task.parentId || this.task.id);
  }

  collapseParent() {
    this.taskService.setSelectedId(null);
    this.taskService.focusTask(this.task.id);
  }

  onItemKeyPress(ev: KeyboardEvent) {
    if (ev.key === 'ArrowUp' && this.selectedItemIndex > 0) {
      this.selectedItemIndex--;
      this.itemEls.toArray()[this.selectedItemIndex].focusEl();
    } else if (ev.key === 'ArrowDown' && this.itemEls.toArray().length > (this.selectedItemIndex + 1)) {
      this.selectedItemIndex++;
      this.itemEls.toArray()[this.selectedItemIndex].focusEl();
    }
  }

  focusItem(cmpInstance: TaskAdditionalInfoItemComponent, timeoutDuration: number = 150) {
    window.clearTimeout(this._focusTimeout);
    this._focusTimeout = window.setTimeout(() => {
      const i = this.itemEls.toArray().findIndex(el => el === cmpInstance);
      if (i === -1) {
        this.focusItem(cmpInstance);
      } else {
        this.selectedItemIndex = i;
        cmpInstance.elementRef.nativeElement.focus();
      }
    }, timeoutDuration);
  }

  updateTaskTitleIfChanged(isChanged: boolean, newTitle: string) {
    if (isChanged) {
      this.taskService.update(this._taskData.id, {title: newTitle});
    }
  }

  private _focusFirst() {
    this._focusTimeout = window.setTimeout(() => {
      this.focusItem(this.itemEls.first, 0);
    }, 150);
  }

}
