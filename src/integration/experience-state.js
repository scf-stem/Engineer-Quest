import {firstOrderExperienceCandidate as content} from '../../content/index.js';

/** Derives one objective from current evidence; exploration visits are deliberately absent. */
export function deriveExperience(state){
  const {joined=false,claimed=false,cardSaved=false,wiringValid=false,hasCode=false,baseCurrent=false,basePassed=false,codeCurrent=false,codePassed=false,incomeRecorded=false}=state;
  const requirementReason=!joined?'先领取个人员工证。':!claimed?'先领取当前客户委托。':!cardSaved?'先保存当前中文方案卡；解释仍待核对。':'';
  const wiringReason=requirementReason||(!wiringValid?'先完成当前虚拟接线规则检查。':'');
  const actionStates={
    open_mail:{disabled:!joined,reason:!joined?'先领取个人员工证。':''},
    talk_requirements_npc:{disabled:false},inspect_kit:{disabled:false},open_manual:{disabled:false},request_help:{disabled:false},
    open_wiring:{disabled:!!requirementReason,reason:requirementReason},
    open_blocks:{disabled:!!wiringReason,reason:wiringReason},
    open_code:{disabled:!!wiringReason||!hasCode,reason:wiringReason||(!hasCode?'先在积木工具中保存快照，查看对应代码。':'')},
    open_tests:{disabled:!!requirementReason,reason:requirementReason},
    open_income:{disabled:!joined,reason:!joined?'先领取个人员工证。':''},
  };
  const goal=(id,title,detail)=>({id,title,detail,status:'in_progress'});
  if(!joined)return {goal:goal('personal-entry','领取我的个人员工证','先用昵称进入本机工位，再领取校园自动灯委托。'),actionStates};
  if(!claimed)return {goal:goal('claim-order','领取校园自动灯委托','到公司邮箱找林工接单；探索物品可以随时跳过。'),actionStates};
  if(!cardSaved)return {goal:goal(content.currentObjectiveCandidate.id,content.currentObjectiveCandidate.title,content.currentObjectiveCandidate.reason),actionStates};
  if(!wiringValid)return {goal:goal('connect-hardware','连接输入与输出，检查我的接线','方案已保存，解释仍待核对。现在查手册、接线并修正具体诊断。'),actionStates};
  if(hasCode){
    if(!codeCurrent||!codePassed)return {goal:goal('customer-change','让灯更早亮，运行新版客户测试','把自己的简写 C++ 边界改为 600；先预测输入 500，再解析并运行当前测试。'),actionStates};
    if(!incomeRecorded)return {goal:goal('software-income','记录本次软件演示收入','新版客户测试通过。在代码工具中明确请求合成入账；查看物品或对话不会发钱。'),actionStates};
    return {goal:goal('review-software','回看软件成果，保留实物待验清单','合成收入已有记录。可以重放实际测试；目标板编译、烧录与教师实物验收仍未完成。'),actionStates};
  }
  if(baseCurrent&&basePassed)return {goal:goal('preserve-and-change','保留积木快照，回应客户变更','基础软件测试通过。在积木工具中保存快照，查看自己的代码与客户新要求。'),actionStates};
  return {goal:goal('build-and-test','搭建自动灯，运行基础客户测试','每轮重新读取、判断、输出，再等待。失败先看第一条预期与实际记录；可以重试或求助。'),actionStates};
}
