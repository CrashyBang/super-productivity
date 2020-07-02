import { createFeatureSelector, createSelector } from '@ngrx/store';
import { TASK_FEATURE_NAME } from './task.reducer';
import { Task, TaskState, TaskWithSubTasks } from '../task.model';
import { taskAdapter } from './task.adapter';
import { GITHUB_TYPE, GITLAB_TYPE, JIRA_TYPE } from '../../issue/issue.const';
import { devError } from '../../../util/dev-error';

const mapSubTasksToTasks = (tasksIN): TaskWithSubTasks[] => {
  return tasksIN.filter((task) => !task.parentId)
    .map((task) => {
      if (task.subTaskIds && task.subTaskIds.length > 0) {
        return {
          ...task,
          subTasks: task.subTaskIds
            .map((subTaskId) => tasksIN.find((taskIN) => taskIN.id === subTaskId))
        };
      } else {
        return task;
      }
    });
};
const mapSubTasksToTask = (task: Task, s: TaskState): TaskWithSubTasks => {
  if (!task) {
    return null;
  }
  return {
    ...task,
    subTasks: task.subTaskIds.map(id => {
      const subTask = s.entities[id];
      if (!subTask) {
        devError('Task data not found for ' + id);
      }
      return subTask;
    })
  };
};

export const flattenTasks = (tasksIN): TaskWithSubTasks[] => {
  let flatTasks = [];
  tasksIN.forEach(task => {
    flatTasks.push(task);
    if (task.subTasks) {
      flatTasks = flatTasks.concat(task.subTasks);
    }
  });
  return flatTasks;
};

// SELECTORS
// ---------
const {selectIds, selectEntities, selectAll, selectTotal} = taskAdapter.getSelectors();
export const selectTaskFeatureState = createFeatureSelector<TaskState>(TASK_FEATURE_NAME);
export const selectTaskEntities = createSelector(selectTaskFeatureState, selectEntities);
export const selectCurrentTaskId = createSelector(selectTaskFeatureState, state => state.currentTaskId);
export const selectIsTaskDataLoaded = createSelector(selectTaskFeatureState, state => state.isDataLoaded);
export const selectCurrentTask = createSelector(selectTaskFeatureState, s => s.currentTaskId && s.entities[s.currentTaskId]);

export const selectCurrentTaskOrParentWithData = createSelector(
  selectTaskFeatureState,
  (s): TaskWithSubTasks => {
    const t = s.currentTaskId
      && s.entities[s.currentTaskId] && s.entities[s.currentTaskId].parentId
      && s.entities[s.entities[s.currentTaskId].parentId] || s.entities[s.currentTaskId];
    return mapSubTasksToTask(t, s);
  });

export const selectJiraTasks = createSelector(
  selectTaskFeatureState,
  (s): Task[] => {
    return s.ids
      .map(id => s.entities[id])
      .filter((task: Task) => task.issueType === JIRA_TYPE);
  });

export const selectGithubTasks = createSelector(
  selectTaskFeatureState,
  (s): Task[] => {
    return s.ids
      .map(id => s.entities[id])
      .filter((task: Task) => task.issueType === GITHUB_TYPE);
  });

export const selectGitlabTasks = createSelector(
  selectTaskFeatureState,
  (s): Task[] => {
    return s.ids
      .map(id => s.entities[id])
      .filter((task: Task) => task.issueType === GITLAB_TYPE);
  });

export const selectSelectedTaskId = createSelector(selectTaskFeatureState, (state) => state.selectedTaskId);
export const selectTaskAdditionalInfoTargetPanel = createSelector(selectTaskFeatureState, (state) => state.taskAdditionalInfoTargetPanel);
export const selectSelectedTask = createSelector(
  selectTaskFeatureState,
  (s): TaskWithSubTasks => {
    return s.selectedTaskId && mapSubTasksToTask(s.entities[s.selectedTaskId], s);
  });

export const selectCurrentTaskParentOrCurrent = createSelector(selectTaskFeatureState, (s): Task =>
  s.currentTaskId
  && s.entities[s.currentTaskId] && s.entities[s.currentTaskId].parentId
  && s.entities[s.entities[s.currentTaskId].parentId]
  || s.entities[s.currentTaskId]
);

export const selectAllTasks = createSelector(selectTaskFeatureState, selectAll);
export const selectScheduledTasks = createSelector(selectAllTasks, (tasks) => tasks.filter(task => task.reminderId));

export const selectAllTasksWithSubTasks = createSelector(selectAllTasks, mapSubTasksToTasks);

// DYNAMIC SELECTORS
// -----------------
export const selectTaskById = createSelector(
  selectTaskFeatureState,
  (state, props: { id: string }): Task => state.entities[props.id]
);

export const selectTasksById = createSelector(
  selectTaskFeatureState,
  (state, props: { ids }) => props.ids ? props.ids.map(
    id => state.entities[id]) : []
);

export const selectTasksWithSubTasksByIds = createSelector(
  selectTaskFeatureState,
  (state, props: { ids: string[] }): TaskWithSubTasks[] =>
    props.ids.map(id => {
      const task = state.entities[id];
      if (!task) {
        devError('Task data not found for ' + id);
      }
      return mapSubTasksToTask(task, state);
    })
);

export const selectTaskByIdWithSubTaskData = createSelector(
  selectTaskFeatureState,
  (state, props: { id: string }): TaskWithSubTasks => {
    const task = state.entities[props.id];
    if (!task) {
      devError('Task data not found for ' + props.id);
    }
    return mapSubTasksToTask(task, state);
  }
);

export const selectMainTasksWithoutTag = createSelector(
  selectAllTasks,
  (tasks: Task[], props: { tagId: string }): Task[] => tasks.filter(
    task => !task.parentId && !task.tagIds.includes(props.tagId)
  )
);

export const selectTasksWorkedOnOrDoneFlat = createSelector(selectAllTasks, (tasks, props: { day: string }) => {
  if (!props) {
    return null;
  }

  const todayStr = props.day;
  return tasks.filter(
    (t: Task) => t.isDone || (t.timeSpentOnDay && t.timeSpentOnDay[todayStr] && t.timeSpentOnDay[todayStr] > 0)
  );
});

// REPEATABLE TASKS
// ----------------
export const selectAllRepeatableTaskWithSubTasks = createSelector(
  selectAllTasksWithSubTasks,
  (tasks: TaskWithSubTasks[]) => {
    return tasks.filter(task => !!task.repeatCfgId && task.repeatCfgId !== null);
  }
);
export const selectAllRepeatableTaskWithSubTasksFlat = createSelector(
  selectAllRepeatableTaskWithSubTasks,
  flattenTasks,
);

export const selectTasksByRepeatConfigId = createSelector(
  selectTaskFeatureState,
  (state, props: { repeatCfgId: string }): Task[] => {
    const ids = state.ids as string[];
    const taskIds = ids.filter(idIN => state.entities[idIN]
      && state.entities[idIN].repeatCfgId === props.repeatCfgId);

    return (taskIds && taskIds.length)
      ? taskIds.map(id => state.entities[id])
      : null;
  }
);

export const selectTaskWithSubTasksByRepeatConfigId = createSelector(
  selectAllTasksWithSubTasks,
  (tasks: TaskWithSubTasks[], props: { repeatCfgId: string }) => {
    return tasks.filter(task => task.repeatCfgId === props.repeatCfgId);
  }
);

export const selectTasksByTag = createSelector(
  selectAllTasksWithSubTasks,
  (tasks: TaskWithSubTasks[], props: { tagId: string }) => {
    return tasks.filter(task => task.tagIds.indexOf(props.tagId) !== -1);
  }
);

