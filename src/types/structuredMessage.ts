export interface StepListItem {
  title?: string;
  text?: string;
}

export interface SourceItem {
  docName?: string;
  title?: string;
  description?: string;
  picture?: string;
  url?: string;
}

export interface StructuredMessagePayload {
  kind: 'step_list' | 'sources';
  title?: string;
  steps?: StepListItem[];
  items?: SourceItem[];
}

export type AgentResponsePart =
  | {
      type: 'text';
      text: string;
    }
  | {
      type: 'step_list';
      steps: StepListItem[];
    }
  | {
      type: 'sources';
      title?: string;
      items: SourceItem[];
    };
