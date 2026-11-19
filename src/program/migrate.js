import {LANGUAGE_PROFILE, SCHEMA_VERSION, exact, fail, result, unwrap} from './common.js';
import {validateProgram} from './validate.js';

/** Explicit one-way migration. The caller retains the v1 document unchanged. */
export function migrateLegacyProgram(legacy, mapping) {
  return result(() => {
    exact(mapping, ['inputPort', 'outputPort']);
    const {inputPort, outputPort} = mapping;
    exact(legacy, ['version', 'sensorThreshold', 'lampOnWhenDark', 'delayMs']);
    if (legacy.version !== 1 || !Number.isInteger(legacy.sensorThreshold) || legacy.sensorThreshold < 1 || legacy.sensorThreshold > 1023 || typeof legacy.lampOnWhenDark !== 'boolean' || !Number.isInteger(legacy.delayMs) || legacy.delayMs < 10 || legacy.delayMs > 2000) fail('LEGACY_PROGRAM', '不支持此旧程序模板');
    const literal = (id, value) => ({id, kind: 'literal', value});
    const program = {schemaVersion: SCHEMA_VERSION, languageProfileRef: {...LANGUAGE_PROFILE.ref}, variables: [], setup: [], loop: [
      {id: 'legacy:if', kind: 'if', condition: {id: 'legacy:compare', kind: 'binary', op: '<', left: {id: 'legacy:read', kind: 'read', port: inputPort, signalType: 'analog'}, right: literal('legacy:threshold', legacy.sensorThreshold)},
        then: [{id: 'legacy:on', kind: 'write', port: outputPort, value: literal('legacy:yes', legacy.lampOnWhenDark)}],
        else: [{id: 'legacy:off', kind: 'write', port: outputPort, value: literal('legacy:no', !legacy.lampOnWhenDark)}]},
      {id: 'legacy:wait', kind: 'wait', duration: literal('legacy:duration', legacy.delayMs)},
    ]};
    unwrap(validateProgram(program));
    return {program, migration: {from: 'legacy-template/1', to: SCHEMA_VERSION, direction: 'one-way', original: structuredClone(legacy)}};
  });
}
