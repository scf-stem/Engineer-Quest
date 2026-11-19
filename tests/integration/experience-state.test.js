import test from 'node:test';
import assert from 'node:assert/strict';
import {deriveExperience} from '../../src/integration/experience-state.js';

test('one objective follows saved evidence, never hotspot visit counts',()=>{
  const states=[
    [{},'personal-entry'],[{joined:true},'claim-order'],[{joined:true,claimed:true},'read-order-and-save-card'],
    [{joined:true,claimed:true,cardSaved:true},'connect-hardware'],
    [{joined:true,claimed:true,cardSaved:true,wiringValid:true},'build-and-test'],
    [{joined:true,claimed:true,cardSaved:true,wiringValid:true,baseCurrent:true,basePassed:true},'preserve-and-change'],
    [{joined:true,claimed:true,cardSaved:true,wiringValid:true,hasCode:true},'customer-change'],
    [{joined:true,claimed:true,cardSaved:true,wiringValid:true,hasCode:true,codeCurrent:true,codePassed:true},'software-income'],
    [{joined:true,claimed:true,cardSaved:true,wiringValid:true,hasCode:true,codeCurrent:true,codePassed:true,incomeRecorded:true},'review-software'],
  ];
  for(const [state,id]of states){const view=deriveExperience(state);assert.equal(view.goal.id,id);assert.deepEqual(deriveExperience({...state,visited:['mail','npc','kit']}),view);}
});
test('stale proofs and broken wiring disable real tool entry without inventing passes',()=>{
  const state={joined:true,claimed:true,cardSaved:true,wiringValid:true,hasCode:true,codeCurrent:false,codePassed:true,incomeRecorded:true};
  assert.equal(deriveExperience(state).goal.id,'customer-change');
  assert.equal(deriveExperience({...state,wiringValid:false}).goal.id,'connect-hardware');
  const blocked=deriveExperience({...state,cardSaved:false});
  for(const id of ['open_wiring','open_blocks','open_code','open_tests'])assert.equal(blocked.actionStates[id].disabled,true);
  assert.equal(blocked.actionStates.inspect_kit.disabled,false);assert.equal(blocked.actionStates.open_manual.disabled,false);
});
