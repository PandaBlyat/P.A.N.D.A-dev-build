import type { ValidationMessage } from './types';

export type ValidationGateResult = {
  proceed: boolean;
  errors: ValidationMessage[];
  warnings: ValidationMessage[];
};

export function splitValidationMessages(messages: ValidationMessage[]): ValidationGateResult {
  const errors = messages.filter((message) => message.level === 'error');
  const warnings = messages.filter((message) => message.level === 'warning');
  return {
    proceed: errors.length === 0,
    errors,
    warnings,
  };
}

export function buildValidationSummary(title: string, issues: ValidationMessage[], limit = 6): string {
  const lines = issues.slice(0, limit).map((issue) => {
    const location = [
      issue.turnNumber != null ? `Turn ${issue.turnNumber}` : null,
      issue.choiceIndex != null ? `Choice ${issue.choiceIndex}` : null,
      issue.fieldPath ? `path: ${issue.fieldPath}` : null,
    ].filter(Boolean).join(', ');
    return `• ${issue.message}${location ? ` (${location})` : ''}`;
  });

  const remainder = issues.length - lines.length;
  return [
    title,
    ...lines,
    remainder > 0 ? `• …and ${remainder} more.` : '',
  ].filter(Boolean).join('\n');
}
