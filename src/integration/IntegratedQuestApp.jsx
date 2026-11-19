import React,{useCallback} from 'react';
import QuestApp from './QuestApp.jsx';
import {NpcTutorial} from '../tutorial/NpcTutorial.jsx';
import {requirementTutorialFacts} from '../../content/requirements-review.js';
import {RequirementPractice} from './RequirementPractice.jsx';
import {ProgramPractice} from './ProgramPractice.jsx';
import {StudentManual} from './StudentManual.jsx';
import {createIntegratedProgramContext} from './manual-bundle.js';
import {createWorkspacePolicies} from './learning-policy-adapter.js';
import {openLocalWorkspace} from './local-workspace.js';
import {createIndexedDbProgressStore} from './local-progress-store.js';
import {LocalEmployees} from './LocalEmployees.jsx';

function ScopedTutorial({facts,...props}){
  const storageKey=facts.learnerId&&facts.attemptId?`eq.npc-tutorial.v1:${facts.learnerId}:${facts.attemptId}`:null;
  return <NpcTutorial {...props} facts={{...facts,requirementReview:facts.requirementReview?requirementTutorialFacts(facts.requirementReview):null}} storageKey={storageKey}/>;
}

/** Public composition only; each specialist retains its actual rules or UI module. */
export default function IntegratedQuestApp(){
  return <LocalEmployees>{profile=><EmployeeQuest key={profile.recordKey} profile={profile}/>}</LocalEmployees>;
}
export function HostedQuest({workspaceKey}){
  return <EmployeeQuest key={workspaceKey} recordKey={`quest-session:${workspaceKey}`} />;
}
function EmployeeQuest({profile, recordKey = profile.recordKey}){
  const openWorkspace=useCallback(async programContext=>openLocalWorkspace({programContext,policies:await createWorkspacePolicies(programContext),store:createIndexedDbProgressStore({recordKey})}),[recordKey]);
  return <QuestApp enableStory employeeControls={profile} createContext={createIntegratedProgramContext} openWorkspace={openWorkspace}
    TutorialComponent={ScopedTutorial} ManualComponent={StudentManual}
    RequirementPracticeComponent={RequirementPractice} ProgramPracticeComponent={ProgramPractice}/>;
}
