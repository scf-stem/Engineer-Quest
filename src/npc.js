// Provider boundary. Production AI must be implemented server-side with permission and retention rules.
export async function reviewRequirements(card, provider = null) {
  if (provider) {
    try {
      const result = await provider({stage:'requirements', card});
      if (!result || typeof result.question !== 'string') throw new Error('Invalid NPC response');
      return {...result, mode:'ai'};
    } catch { /* explicit fallback below */ }
  }
  const missing = ['input','condition','output','continuous'].filter(key => !card[key]);
  const questions = {input:'设备凭什么知道周围暗了？请选择它需要读取的信息。',condition:'什么时候开灯？请选择判断条件。',output:'环境变亮以后，灯应该怎样？',continuous:'只在开机判断一次够不够？需要持续检查吗？'};
  return {mode:'static', complete:missing.length===0, question: missing.length ? questions[missing[0]] : '方案已覆盖输入、判断、输出和持续检查。请用自己的话解释一次从暗到亮的变化，再进入接线台。', evidence:missing.length ? '需求卡仍有未选择项' : '四项固定需求覆盖检查通过', manualSection:'02 · 读懂需求'};
}
