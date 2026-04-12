import { validate } from './validation';
import type { Project, ValidationMessage } from './types';

type ValidationRequest = {
  revision: number;
  project: Project;
};

type ValidationResponse = {
  revision: number;
  messages: ValidationMessage[];
  durationMs: number;
};

self.onmessage = (event: MessageEvent<ValidationRequest>) => {
  const start = performance.now();
  const { revision, project } = event.data;
  const messages = validate(project);
  const response: ValidationResponse = {
    revision,
    messages,
    durationMs: performance.now() - start,
  };
  self.postMessage(response);
};
