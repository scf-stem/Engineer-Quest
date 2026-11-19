import test from 'node:test';
import assert from 'node:assert/strict';
import {describeReviewCitations} from '../../src/integration/citations.js';
import {reviewStaticRequirements} from '../../content/npc.js';

test('student citations resolve readable sections and retain the actual requirement version',()=>{
  const review=reviewStaticRequirements({requirementVersion:'1.0.0',card:{}});
  const result=describeReviewCitations(review.citations);
  assert.match(result.label,/当前需求 · 输入信息/);assert.match(result.label,/手册 §03.1/);
  assert.doesNotMatch(result.label,/eq-requirement|sections\//);assert.equal(result.manualSection,'03.1');
  assert.match(describeReviewCitations(review.citations,'1.1.0').label,/历史需求（需核对）/);
});
test('unknown or stale manual references do not invent a section',()=>{
  for(const citation of [{ref:{id:'eq-student-manual',version:'old'},path:'sections/02.1'},{ref:{id:'eq-student-manual',version:'0.1.0-draft'},path:'sections/no-such-section'}]){
    assert.deepEqual(describeReviewCitations([citation]),{label:'引用资料待核对',manualSection:null});
  }
});
