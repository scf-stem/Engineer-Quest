export interface Ref { id: string; version: string; digest: string }
export interface Range { start: number; end: number }
export interface Diagnostic { code: string; severity: 'error' | 'warning'; message: string; nodeId?: string; sourceRange?: Range }
export type Result<T> = {ok: true; value: T; diagnostics: Diagnostic[]} | {ok: false; diagnostics: Diagnostic[]};
export interface Node {id: string; sourceRange?: Range}
export interface Literal extends Node {kind: 'literal'; value: number | boolean}
export type Expression = Literal
  | (Node & {kind: 'variable'; name: string})
  | (Node & {kind: 'read'; port: string; signalType: 'analog' | 'digital'})
  | (Node & {kind: 'unary'; op: '!' | '-'; operand: Expression})
  | (Node & {kind: 'binary'; op: '+' | '-' | '*' | '/' | '%' | '<' | '<=' | '>' | '>=' | '==' | '!=' | '&&' | '||'; left: Expression; right: Expression});
export type Statement = (Node & {kind: 'assign'; name: string; value: Expression})
  | (Node & {kind: 'write'; port: string; value: Expression})
  | (Node & {kind: 'wait'; duration: Expression})
  | (Node & {kind: 'if'; condition: Expression; then: Statement[]; else: Statement[]})
  | (Node & {kind: 'while'; condition: Expression; body: Statement[]});
export interface ProgramIR {
  schemaVersion: 'eq-program/0.1'; languageProfileRef: Ref;
  variables: (Node & {name: string; type: 'int' | 'bool'; constant: boolean; initial: Literal})[];
  setup: Statement[]; loop: Statement[];
}
export interface LanguageProfile {ref: Ref}
export type Port = {pin: number | string; direction: 'input'; signalType: 'analog'; min: number; max: number; initialValue: number}
  | {pin: number | string; direction: 'input' | 'output'; signalType: 'digital'; initialValue: boolean};
export interface DeviceProfile {
  ref: Ref; family: 'arduino-uno'; variant?: string | null; fqbn?: string | null;
  calibrationStatus?: 'synthetic' | 'pending' | 'verified'; pinMap: Record<string, Port>;
  [key: string]: unknown;
}
/** Caller has already checked circuit safety/topology with B. */
export interface ValidatedTopology {deviceProfile: DeviceProfile; deviceProfileRef: Ref; wiringRef: Ref}
export interface Limits {maxSteps: number; maxTimeMs: number}
export type InputTimeline = {atMs: number; signals: Record<string, number | boolean>}[];
export interface SimulationEvent {
  atMs: number; step: number; kind: 'initial' | 'read' | 'assign' | 'write' | 'wait' | 'resume' | 'branch' | 'cycle' | 'stop';
  nodeId?: string; variables: Record<string, number | boolean>; inputs: Record<string, number | boolean>; outputs: Record<string, boolean>;
  port?: string; value?: number | boolean; durationMs?: number; resumeAtMs?: number; branch?: boolean; status?: SimulationResult['status'];
}
export interface SimulationResult {
  status: 'completed' | 'budget_exceeded' | 'runtime_error'; completedThroughMs: number; steps: number;
  events: SimulationEvent[]; diagnostics: Diagnostic[]; limits: Limits; inputTimeline: InputTimeline; deviceProfileRef: Ref; wiringRef: Ref;
}
export interface CustomerTest extends Limits {
  id: string; requirementId: string; inputTimeline: InputTimeline;
  assertions: {atMs: number; output: string; equals: boolean}[];
}
export interface Evaluation {
  passed: boolean; diagnostics: Diagnostic[];
  cases: {id?: string; requirementId?: string; passed: boolean; diagnostics: Diagnostic[];
    assertions: {atMs: number; output: string; equals: boolean; actual?: boolean; passed: boolean; nodeId?: string}[]}[];
}
export interface TestRefs {programRef: Ref; wiringRef: Ref; requirementRef: Ref; testSuiteRef: Ref; deviceProfileRef: Ref}
export interface SourceMapEntry {nodeId: string; sourceRange: Range; inputSourceRange?: Range; nodeKind?: string}
export interface ArduinoOutput {
  source: string; map: SourceMapEntry[];
  toolchainRequirements: {family: 'arduino-uno'; variant: string | null; fqbn: string | null; cppStandard: 'c++11'; libraries: string[]; runtimeVersion: string; compileStatus: 'not_run'; requiresVerifiedBoardTarget: true};
}
export const SCHEMA_VERSION: 'eq-program/0.1';
export const LANGUAGE_PROFILE: Readonly<LanguageProfile>;
export function parseShortCpp(source: string, profile?: LanguageProfile): Result<ProgramIR>;
export function blocksToProgram(blockState: unknown, profile?: LanguageProfile): Result<ProgramIR>;
/** Blockly instance is explicitly injected; no global Blockly is imported by the engine. */
export function workspaceToProgram(workspace: unknown, Blockly: any, profile?: LanguageProfile): Result<ProgramIR>;
export function registerProgramBlocks(Blockly: any, deviceProfile: DeviceProfile): void;
export function validateProgram(program: unknown, profile?: DeviceProfile): Result<{program: ProgramIR; deviceProfileRef?: Ref; portsUsed: Record<string, string>; nodeCount: number}>;
export function generateShortCpp(program: ProgramIR): Result<{source: string; map: SourceMapEntry[]; sections: {setup:Range;loop:Range}}>;
export function generateArduino(program: ProgramIR, profile: DeviceProfile): Result<ArduinoOutput>;
export function simulate(program: ProgramIR, topology: ValidatedTopology, timeline: InputTimeline, limits?: Limits): Result<SimulationResult>;
export function evaluate(simulation: SimulationResult, tests: CustomerTest[]): Evaluation;
export function runCustomerTests(program: ProgramIR, topology: ValidatedTopology, tests: CustomerTest[], refs: TestRefs): Result<{
  schemaVersion: 'eq-test-run-draft/0.1'; refs: TestRefs; passed: boolean;
  runs: {testId: string; simulation: SimulationResult; evaluation: Evaluation}[];
}>;
export function migrateLegacyProgram(legacy: unknown, mapping: {inputPort: string; outputPort: string}): Result<{
  program: ProgramIR; migration: {from: 'legacy-template/1'; to: 'eq-program/0.1'; direction: 'one-way'; original: unknown};
}>;
export interface TeachingFocus {blockId?:string;blockType?:string;toolboxCategory?:string;inputName?:string;sourceRange?:Range}
export interface TeachingGuidance {title:string;observation:string;nextAction:string;focus:TeachingFocus;code?:string;technical?:Diagnostic}
export interface WorkspaceInsight {
  state:'empty'|'needs_structure'|'invalid'|'runnable';canRun:boolean;program:ProgramIR|null;diagnostics:Diagnostic[];guidance:TeachingGuidance;
  observations:{id:string;label:string;nodeIds:string[];observed:boolean}[];
}
export interface ProgramLearningLink {
  nodeId:string;blockId?:string;inputName?:string;path:string;concept:string;label:string;meaning:string;
  generatedRange:Range;originalRange?:Range;code:string;
}
export interface ProgramLearningMap {source:string;links:ProgramLearningLink[];sections:{setup:Range;loop:Range}}
export function inspectProgramWorkspace(blockState:unknown,options?:{activityId?:string}):WorkspaceInsight;
export function explainProgramDiagnostic(diagnostic:Diagnostic,context?:{blockState?:unknown}):TeachingGuidance;
export function createProgramLearningMap(program:ProgramIR,options?:{blockState?:unknown}):Result<ProgramLearningMap>;
export interface ProgramLearningFact {factCode:string;source:'program-runtime'|'program-analysis';payload:Record<string,unknown>}
export type ProgramLearningAction = {actionId:'observe-output';inputs:{on:boolean};topology:ValidatedTopology}
  | {actionId:'read-input';inputs:{light:number};program:ProgramIR;topology:ValidatedTopology}
  | {actionId:'branch-output';inputs:{scene:'dark'|'bright'};program:ProgramIR;topology:ValidatedTopology}
  | {actionId:'repeat-read';inputs:Record<string,never>;program:ProgramIR;topology:ValidatedTopology}
  | {actionId:'code-mapping';inputs:{nodeId:string};blockState:unknown};
export function performProgramLearningAction(action:ProgramLearningAction):Result<{
  actionId:string;factCodes:string[];facts:ProgramLearningFact[];program:ProgramIR;
  simulation?:SimulationResult;mapping?:ProgramLearningMap;observation:Record<string,unknown>;
}>;
export type LearningExerciseId='first-output'|'follow-light'|'repair-stale-read'|'hold-between-bounds';
export interface LearningExercise {id:LearningExerciseId;title:string;goal:string;instructions:string[];checkpoint:{atMs:number;output:string;question:string};synthetic:true}
export interface LearningArtifact {exerciseId:LearningExerciseId;source?:string;program?:ProgramIR;blockState?:unknown;topology?:ValidatedTopology}
export interface LearningExecution {
  exerciseId:LearningExerciseId;synthetic:true;behaviorPassed:boolean;understanding:'not_assessed';program:ProgramIR;programIdentity:string;source?:string;mapping:ProgramLearningMap;
  runs:{testId:string;test:CustomerTest;simulation:SimulationResult;evaluation:Evaluation;feedback:LearningFailure}[];
  checkpoint:{atMs:number;output:string;question:string;actual?:boolean};
}
export interface LearningFailure {passed:boolean;diagnostics:Diagnostic[];counterexamples:({testId:string;atMs:number;output:string;expected:boolean;actual?:boolean;observation:string;nextAction:string}&Record<string,unknown>)[]}
export interface LearningRecord {schemaVersion:'eq-program-learning-record/1';origin:'blank'|'example'|'bug-fixture'|'restored';support:{kind:string;scope:string}[];predictions:Record<string,unknown>[];attempts:(LearningExecution&{id:string;supportUsed:Record<string,unknown>[];prediction:Record<string,unknown>|null})[];observations:Record<string,unknown>[]}
export function getLearningExercises():LearningExercise[];
export function getLearningStarter(id:LearningExerciseId):Result<{source:string;origin:'bug-fixture'}>;
export function runLearningExercise(input:LearningArtifact):Result<LearningExecution>;
export function explainLearningFailure(simulation:SimulationResult,test:CustomerTest,mapping:ProgramLearningMap):LearningFailure;
export function createLearningRecord(options?:{origin?:LearningRecord['origin']}):LearningRecord;
export function recordLearningSupport(record:LearningRecord,support:{kind:'example'|'bug-fixture'|'hint'|'restored';scope?:string}):Result<LearningRecord>;
export function recordLearningPrediction(record:LearningRecord,input:LearningArtifact&{predicted:boolean}):Result<LearningRecord>;
export function recordLearningAttempt(record:LearningRecord,input:LearningArtifact):Result<{record:LearningRecord;attempt:LearningRecord['attempts'][number]}>;
export function observeLearningEvidence(record:LearningRecord,input:{attemptId:string;testId:string;eventIndex:number}):Result<LearningRecord>;
export function assessLearningRecord(record:LearningRecord):{status:'collecting_evidence'|'ready_for_review';steps:{id:string;title:string;behaviorVerified:boolean;evidenceRecorded:boolean}[];supportUsed:LearningRecord['support'];hasExampleSupport:boolean;understanding:'not_assessed';independentCompletion:'not_established';message:string};
