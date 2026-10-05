import { SchedulerLike, animationFrameScheduler, asapScheduler } from 'rxjs';

export function frameScheduler(): SchedulerLike {
  return typeof requestAnimationFrame === 'function' ? animationFrameScheduler : asapScheduler;
}
