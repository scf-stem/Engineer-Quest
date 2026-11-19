import {UNO_CANDIDATE_PROFILE} from './profile.js';
import {validateDeviceProfile} from './wiring.js';

export const DARK_BRIGHT_DARK_SCENARIO = Object.freeze({
  id: 'synthetic-dark-bright-dark', synthetic: true,
  samples: Object.freeze([{atMs: 0, value: 150}, {atMs: 500, value: 850}, {atMs: 1000, value: 150}].map(Object.freeze)),
});

/** Input data only. Does not execute a program, choose a threshold or assert outputs. */
export function createInputFixture(profile = UNO_CANDIDATE_PROFILE, scenario = DARK_BRIGHT_DARK_SCENARIO) {
  if (!validateDeviceProfile(profile).ok) throw new TypeError('设备 profile 无效。');
  if (!Array.isArray(scenario?.samples) || !scenario.samples.length || scenario.samples.length > 1000) throw new TypeError('合成输入需要 1–1000 个样本。');
  let previous = -1;
  return scenario.samples.map(({atMs, value}) => {
    if (!Number.isSafeInteger(atMs) || atMs < 0 || atMs <= previous || !Number.isInteger(value) || value < 0 || value > 1023) throw new TypeError('样本时间必须为严格递增的非负整数毫秒；光照必须是 0–1023 整数。');
    previous = atMs;
    return {atMs, signals: {light: value}};
  });
}
