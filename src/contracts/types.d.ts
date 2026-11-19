export type Ref = Readonly<{id:string;version:string;digest:`sha256:${string}`}>
export type Diagnostic = {code:string;severity:'error'|'warning';message:string;nodeId?:string;terminalIds?:string[];sourceRange?:{start:number;end:number};manualSection?:string}
export type Result<T> = {ok:true;value:T;diagnostics:Diagnostic[]}|{ok:false;diagnostics:Diagnostic[]}
export type WorkSubmission = {
  expectedRevision:number;
  requirementRef:Ref;deviceProfileRef:Ref;testSuiteRef:Ref;manualRef:Ref;languageProfileRef:Ref;
  program:unknown;wiring:unknown;source:string;requirementCard:Record<string,unknown>;
  phase:'blocks'|'short-cpp';
}
export type SubmissionSnapshot = Readonly<Omit<WorkSubmission,'expectedRevision'> & {
  schemaVersion:'eq.submission/1';id:string;projectId:string;ownerStudentId:string;revision:number;
  taskRef:Ref;programRef:Ref;wiringRef:Ref;sourceDigest:string;digest:string;createdAt:string;synthetic:true;
}>
export type SoftwareReport = {passed:boolean;cases:({passed:boolean}&Record<string,unknown>)[]}
export type HardwareStatus = {compilation:'not-implemented';upload:'not-implemented';safetyApproval:'not-verified';hardwareAcceptance:'not-verified'}
export type LedgerEvent = {id:string;studentId:string;kind:'income';amount:number;reason:string;sourceEvidenceId:string;idempotencyKey:string;createdAt:string;synthetic:true}
