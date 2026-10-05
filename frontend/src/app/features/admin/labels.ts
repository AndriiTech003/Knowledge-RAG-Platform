import { CompareRow } from '../../core/api/models';

export function stepLabel(step: string): string {
  switch (step) {
    case 'acl':
      return $localize`:@@admin.step.acl:ACL`;
    case 'condense':
      return $localize`:@@admin.step.condense:Condense`;
    case 'embed':
      return $localize`:@@admin.step.embed:Embed`;
    case 'vector':
      return $localize`:@@admin.step.vector:Vector search`;
    case 'lexical':
      return $localize`:@@admin.step.lexical:Lexical search`;
    case 'fetch':
      return $localize`:@@admin.step.fetch:Fetch chunks`;
    case 'rerank':
      return $localize`:@@admin.step.rerank:Rerank`;
    case 'first_token':
      return $localize`:@@admin.step.firstToken:First token`;
    case 'generate':
      return $localize`:@@admin.step.generate:Generate`;
    case 'total':
      return $localize`:@@admin.step.total:Total`;
    default:
      return step;
  }
}

export function outcomeLabel(outcome: string | null | undefined): string {
  switch (outcome) {
    case 'answered':
      return $localize`:@@admin.outcome.answered:answered`;
    case 'no_answer':
      return $localize`:@@admin.outcome.noAnswer:no_answer`;
    case 'error':
      return $localize`:@@admin.outcome.error:error`;
    default:
      return outcome ?? '';
  }
}

export function changeLabel(change: CompareRow['change']): string {
  switch (change) {
    case 'improved':
      return $localize`:@@admin.change.improved:improved`;
    case 'worse':
      return $localize`:@@admin.change.worse:worse`;
    case 'unchanged':
      return $localize`:@@admin.change.unchanged:unchanged`;
    case 'new':
      return $localize`:@@admin.change.new:new`;
    case 'removed':
      return $localize`:@@admin.change.removed:removed`;
    default:
      return change;
  }
}
