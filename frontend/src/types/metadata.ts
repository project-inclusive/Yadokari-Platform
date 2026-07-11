// --- Backend Metadata (OpenFisca schema) ---

export interface Node {
  id: string; // strictモード適合のためキー名からプロパティへ移行
  type: 'conditional' | 'assignment' | 'return';
  condition?: string;
  true_node?: string;
  false_node?: string;
  target?: string;
  expression?: string;
  next_node?: string;
}

export interface FormulaDependencyVariable {
  name: string;
  as?: string;
  entity: 'person' | 'household' | 'household_members';
  period: string;
  required: boolean;
  default?: string | number | boolean;
}

export interface FormulaDependencyParameter {
  path: string;
  as: string;
}

export interface FlowchartFormula {
  date: string; // strictモード適合のためキー名からプロパティへ移行
  dependencies: {
    variables: FormulaDependencyVariable[];
    parameters: FormulaDependencyParameter[];
  };
  start_node: string;
  nodes: Node[]; // Recordから配列に変更
}

export interface PossibleValue {
  value: string;
  label: string;
}

export interface Variable {
  name: string;
  label: string;
  documentation?: string;
  reference?: string;
  value_type: 'float' | 'int' | 'bool' | 'str' | 'Enum';
  possible_values?: PossibleValue[]; // Recordから配列に変更
  default_value?: string | number | boolean;
  entity: '人物' | '世帯';
  definition_period: 'DAY' | 'MONTH' | 'YEAR' | 'ETERNITY';
  end?: string;
  formulas?: FlowchartFormula[]; // Recordから配列に変更
}

export interface ParameterValue {
  date: string;
  value: number;
}

export interface Parameter {
  path: string;
  description: string;
  unit: 'currency-JPY' | '/1' | 'year' | 'person';
  values: ParameterValue[]; // Recordから配列に変更
}

export interface TestCase {
  name: string;
  period: string;
  input: string | Record<string, any>;  // strictモード適合のため文字列として送られてくる可能性がある共用体
  output: string | Record<string, any>; // 同上
}

export interface TestFile {
  file_path: string;
  test_cases: TestCase[];
}

export interface BackendMetadata {
  variables: Variable[];
  parameters: Parameter[];
  tests: TestFile[];
}


// --- Frontend Metadata (App Manifest schema) ---

export interface AppMetadata {
  app_title: string;
  theme: {
    primary_color: string;
  };
}

export interface Question {
  id: string;
  title: string;
  type: 'Selection' | 'Address' | 'Age' | 'PersonNum' | 'MultipleSelection';
  options: string[];
  target_entities: string[];
}

export interface Guard {
  type: 'mode_check' | 'loop_check' | 'has_members';
  mode?: string;
  relation?: string;
  limit_source?: string;
  source?: string;
}

export interface NextCondition {
  target: string;
  guard: Guard;
}

export interface FlowState {
  id: string; // strictモード適合のためキー名からプロパティへ移行
  nextQuestionKey?: string | null;
  nextConditions?: NextCondition[];
  type?: 'member_transition';
  relation?: string;
  action?: 'start' | 'next';
}

export interface Flow {
  start_state: string;
  states: FlowState[]; // Recordから配列に変更
}

export interface OpenFiscaMapping {
  question_id: string;
  openfisca_variable: string;
  level: string;
  transform?: string | null;
  scale?: number;
  multiple_selection_map?: Record<string, string>;
}

export interface FrontendMetadata {
  app_metadata: AppMetadata;
  questions: Question[];
  flow: Flow;
  openfisca_mapping: OpenFiscaMapping[];
}


// --- Entire Project State ---

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  displayContent?: string;
}

export interface ProjectState {
  projectName: string;
  chatHistory: ChatMessage[];
  backendMetadata: BackendMetadata | null;
  frontendMetadata: FrontendMetadata | null;
  jsonParseError?: string | null;
  rawJsonString?: string | null;
}
