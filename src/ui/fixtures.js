// Synthetic visual fixtures only. These are not course, device, ledger or test truth.
export const DEMO_EMPLOYEE = { nickname: '小林', employeeId: 'EQ-DEMO-017', role: '见习工程师', synthetic: true };
export const DEMO_TASK = {
  id: 'synthetic-light-001', title: '让桌灯懂得天色', client: '校园阅读角',
  subject: '委托 001 / 一盏会看天色的灯',
  description: '阅读角靠窗的桌面，傍晚总会先暗下来。我们想做一个小装置：环境暗时，LED 自动亮起；环境变亮，LED 就关闭。它需要一直留意光线的变化。',
  scope: '先完成低压桌面演示。联网、显示屏和手动开关留到以后的订单。',
  synthetic: true,
};
export const DEMO_STAGES = [
  { id: 'onboarding', title: '个人入职', subtitle: '领到你的员工证', state: 'complete' },
  { id: 'requirements', title: '读懂客户需求', subtitle: '先用中文说清楚', state: 'current' },
  { id: 'wiring', title: '认识元件与接线', subtitle: '查手册，做方案', state: 'upcoming' },
  { id: 'blocks', title: '搭建积木 Demo', subtitle: '让逻辑运行起来', state: 'upcoming' },
  { id: 'code', title: '修改简写 C++', subtitle: '回应一个新变化', state: 'upcoming' },
  { id: 'delivery', title: '真机与教师验收', subtitle: '之后在现场完成', state: 'upcoming' },
];
export const DEMO_INCOME = [
  { id: 'synthetic-01', name: '松果', income: 360 },
  { id: 'synthetic-02', name: '阿禾', income: 280 },
  { id: 'synthetic-03', name: '星野', income: 220 },
  { id: 'synthetic-17', name: '小林', income: 0, self: true },
];
export const REQUIREMENT_FIELDS = [
  { id: 'input', title: '输入', question: '装置需要知道什么？', options: ['环境光照的读数', '今天是星期几'] },
  { id: 'condition', title: '判断', question: '什么情况下开灯？', options: ['环境变暗时', '始终保持亮灯'] },
  { id: 'output', title: '输出', question: '环境变亮以后呢？', options: ['关闭 LED', '保持 LED 亮起'] },
  { id: 'repeat', title: '持续工作', question: '只检查一次够吗？', options: ['持续重复检查', '只在开机时检查'] },
];
