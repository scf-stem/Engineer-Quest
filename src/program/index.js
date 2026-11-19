export {LANGUAGE_PROFILE, SCHEMA_VERSION} from './common.js';
export {validateProgram} from './validate.js';
export {parseShortCpp} from './parser.js';
export {blocksToProgram, workspaceToProgram, registerProgramBlocks} from './blocks.js';
export {simulate, evaluate, runCustomerTests} from './simulate.js';
export {generateArduino, generateShortCpp} from './generate.js';
export {migrateLegacyProgram} from './migrate.js';
export {inspectProgramWorkspace, explainProgramDiagnostic} from './learning-guidance.js';
export {createProgramLearningMap} from './learning-map.js';
export {performProgramLearningAction} from './learning-actions.js';
export {getProgramPracticeCriterion, explainProgramPracticeResult} from './learning-diagnostics.js';
export {getLearningExercises, getLearningStarter, runLearningExercise, explainLearningFailure,
  createLearningRecord, recordLearningSupport, recordLearningPrediction, recordLearningAttempt,
  observeLearningEvidence, assessLearningRecord} from './learning-exercises.js';
