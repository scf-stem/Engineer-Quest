import {CAPS, LANGUAGE_PROFILE, SCHEMA_VERSION, checkLanguage, fail, isRecord, result, unwrap} from './common.js';
import {inspectDevice, validateProgram} from './validate.js';

/** Converts Blockly 12 serialization, preserving block IDs for UI highlighting. */
export function blocksToProgram(state, languageProfile = LANGUAGE_PROFILE) {
  return result(() => {
    checkLanguage(languageProfile);
    const tops = state?.blocks?.blocks;
    if (!Array.isArray(tops) || tops.length !== 1 || tops[0]?.type !== 'eqp_program') fail('BLOCK_ROOT', tops?.length ? '把现有动作接进一个「程序入口」的「持续执行」里；保留作品并检查散落积木。' : '工作区还没有程序。先从「变量与流程」拖入「程序入口」，再连接一个输出与等待。');
    const ids = new Set(), seen = new WeakSet(); let count = 0;
    const variableNames = new Map((Array.isArray(state?.variables) ? state.variables : []).filter(isRecord).map(v => [v.id, v.name]));
    function check(block, depth) {
      if (!isRecord(block) || depth > CAPS.depth || ++count > CAPS.nodes) fail('BLOCK_BUDGET', '积木数量或嵌套超出预算');
      if (seen.has(block)) fail('BLOCK_CYCLE', '积木连接包含循环或重复对象');
      seen.add(block);
      if (typeof block.id !== 'string' || !block.id || block.id.length > 120 || ids.has(block.id)) fail('BLOCK_ID', '积木须有唯一 ID');
      ids.add(block.id);
      if (block.disabled === true || block.enabled === false || block.disabledReasons?.length) fail('DISABLED_BLOCK', '请移除或启用停用的积木', {id: block.id});
      return block;
    }
    function input(block, name, required = true) {
      const connection = block.inputs?.[name], child = connection?.block ?? connection?.shadow;
      if (!child && required) fail('BLOCK_INPUT', `请补齐 ${name} 中的积木`, {id: block.id});
      return child;
    }
    function inputs(block, allowed) {
      if (block.inputs && (!isRecord(block.inputs) || Object.keys(block.inputs).some(k => !allowed.includes(k)))) fail('BLOCK_INPUT', '此积木包含不支持的输入或分支', {id: block.id});
    }
    function field(block, name) {
      const v = block.fields?.[name];
      return isRecord(v) ? variableNames.get(v.id) ?? v.name ?? v.id : v;
    }
    function expression(block, depth) {
      check(block, depth);
      if (block.next?.block) fail('BLOCK_EXPRESSION', '值积木不能连接后续语句', {id: block.id});
      const base = {id: block.id};
      switch (block.type) {
        case 'math_number': inputs(block, []); return {...base, kind: 'literal', value: block.fields?.NUM};
        case 'logic_boolean':
          inputs(block, []);
          if (!['TRUE', 'FALSE'].includes(block.fields?.BOOL)) fail('BLOCK_FIELD', '布尔值无效', base);
          return {...base, kind: 'literal', value: block.fields.BOOL === 'TRUE'};
        case 'variables_get': inputs(block, []); return {...base, kind: 'variable', name: field(block, 'VAR')};
        case 'eqp_get': inputs(block, []); return {...base, kind: 'variable', name: field(block, 'NAME')};
        case 'eqp_read_analog': case 'eqp_read_digital':
          inputs(block, []); return {...base, kind: 'read', port: field(block, 'PORT'), signalType: block.type === 'eqp_read_analog' ? 'analog' : 'digital'};
        case 'logic_negate':
          inputs(block, ['BOOL']); return {...base, kind: 'unary', op: '!', operand: expression(input(block, 'BOOL'), depth + 1)};
        case 'math_arithmetic': case 'logic_compare': case 'logic_operation': {
          inputs(block, ['A', 'B']);
          const operators = {math_arithmetic: {ADD: '+', MINUS: '-', MULTIPLY: '*', DIVIDE: '/'}, logic_compare: {LT: '<', LTE: '<=', GT: '>', GTE: '>=', EQ: '==', NEQ: '!='}, logic_operation: {AND: '&&', OR: '||'}};
          const op = operators[block.type][field(block, 'OP')];
          if (!op) fail('BLOCK_OPERATOR', '不支持此积木运算符', base);
          return {...base, kind: 'binary', op, left: expression(input(block, 'A'), depth + 1), right: expression(input(block, 'B'), depth + 1)};
        }
        default: fail('BLOCK_EXPRESSION', `不支持值积木 ${block.type}`, base);
      }
    }
    function chain(first, depth) {
      const list = []; let block = first;
      while (block) {
        check(block, depth); const base = {id: block.id};
        switch (block.type) {
          case 'variables_set':
            inputs(block, ['VALUE']); list.push({...base, kind: 'assign', name: field(block, 'VAR'), value: expression(input(block, 'VALUE'), depth + 1)}); break;
          case 'eqp_set':
            inputs(block, ['VALUE']); list.push({...base, kind: 'assign', name: field(block, 'NAME'), value: expression(input(block, 'VALUE'), depth + 1)}); break;
          case 'eqp_write':
            inputs(block, ['VALUE']); list.push({...base, kind: 'write', port: field(block, 'PORT'), value: expression(input(block, 'VALUE'), depth + 1)}); break;
          case 'eqp_wait':
            inputs(block, ['MS']); list.push({...base, kind: 'wait', duration: expression(input(block, 'MS'), depth + 1)}); break;
          case 'controls_if':
            // Else-if is built by nesting a second if; never silently drop IF1.
            inputs(block, ['IF0', 'DO0', 'ELSE']);
            if (block.extraState?.elseIfCount) fail('BLOCK_BRANCH', '请将否则如果改成在否则中嵌套判断', base);
            list.push({...base, kind: 'if', condition: expression(input(block, 'IF0'), depth + 1), then: chain(input(block, 'DO0', false), depth + 1), else: chain(input(block, 'ELSE', false), depth + 1)}); break;
          case 'eqp_while': case 'controls_whileUntil': {
            const standard = block.type === 'controls_whileUntil'; inputs(block, standard ? ['BOOL', 'DO'] : ['CONDITION', 'BODY']);
            if (standard && field(block, 'MODE') !== 'WHILE') fail('BLOCK_LOOP', '本版本只支持当条件成立时循环', base);
            list.push({...base, kind: 'while', condition: expression(input(block, standard ? 'BOOL' : 'CONDITION'), depth + 1), body: chain(input(block, standard ? 'DO' : 'BODY', false), depth + 1)}); break;
          }
          default: fail('BLOCK_STATEMENT', `不支持语句积木 ${block.type}`, base);
        }
        block = block.next?.block;
      }
      return list;
    }
    const root = check(tops[0], 0); inputs(root, ['VARIABLES', 'SETUP', 'LOOP']);
    if (root.next?.block) fail('BLOCK_ROOT', '程序入口后不能再连接语句', {id: root.id});
    const variables = []; let declaration = input(root, 'VARIABLES', false);
    while (declaration) {
      check(declaration, 1); inputs(declaration, ['INITIAL']);
      if (declaration.type !== 'eqp_declare') fail('BLOCK_DECLARATION', '变量区只接受声明积木', {id: declaration.id});
      const constant = field(declaration, 'CONSTANT');
      if (!['TRUE', 'FALSE'].includes(constant)) fail('BLOCK_FIELD', '常量字段无效', {id: declaration.id});
      variables.push({id: declaration.id, name: field(declaration, 'NAME'), type: field(declaration, 'TYPE'), constant: constant === 'TRUE', initial: expression(input(declaration, 'INITIAL'), 2)});
      declaration = declaration.next?.block;
    }
    const program = {schemaVersion: SCHEMA_VERSION, languageProfileRef: {...LANGUAGE_PROFILE.ref}, variables,
      setup: chain(input(root, 'SETUP', false), 1), loop: chain(input(root, 'LOOP', false), 1)};
    unwrap(validateProgram(program)); return program;
  });
}

export function workspaceToProgram(workspace, Blockly, languageProfile = LANGUAGE_PROFILE) {
  return blocksToProgram(Blockly.serialization.workspaces.save(workspace), languageProfile);
}

// Opt-in registration: does not import Blockly or mutate the old demo registry.
export function registerProgramBlocks(Blockly, deviceProfile) {
  inspectDevice(deviceProfile);
  const ports = direction => Object.entries(deviceProfile.pinMap).filter(([, p]) => p.direction === direction).map(([name]) => [name, name]);
  const reads = type => Object.entries(deviceProfile.pinMap).filter(([, p]) => p.direction === 'input' && p.signalType === type).map(([name]) => [name, name]);
  const input = name => ({type: 'input_value', name});
  const statement = name => ({type: 'input_statement', name});
  const dropdown = (name, options) => ({type: 'field_dropdown', name, options: options.length ? options : [['无可用端口', 'UNAVAILABLE']]});
  const definitions = [
    {type: 'eqp_program', message0: '程序入口 %1 变量 %2 启动时 %3 持续执行 %4', args0: [{type:'input_dummy'},statement('VARIABLES'), statement('SETUP'), statement('LOOP')], colour: 180},
    {type: 'eqp_declare', message0: '声明 %1 类型 %2 常量 %3 初值 %4', args0: [{type: 'field_input', name: 'NAME', text: 'light'}, dropdown('TYPE', [['整数', 'int'], ['布尔', 'bool']]), dropdown('CONSTANT', [['否', 'FALSE'], ['是', 'TRUE']]), input('INITIAL')], previousStatement: null, nextStatement: null, colour: 260},
    {type: 'eqp_get', message0: '变量 %1 的值', args0: [{type: 'field_input', name: 'NAME', text: 'light'}], output: null, colour: 260},
    {type: 'eqp_set', message0: '变量 %1 设为 %2', args0: [{type: 'field_input', name: 'NAME', text: 'light'}, input('VALUE')], previousStatement: null, nextStatement: null, colour: 260},
    {type: 'eqp_read_analog', message0: '读取模拟输入 %1', args0: [dropdown('PORT', reads('analog'))], output: 'Number', colour: 210},
    {type: 'eqp_read_digital', message0: '读取数字输入 %1', args0: [dropdown('PORT', reads('digital'))], output: 'Boolean', colour: 210},
    {type: 'eqp_write', message0: '数字输出 %1 设为 %2', args0: [dropdown('PORT', ports('output')), {...input('VALUE'), check: 'Boolean'}], previousStatement: null, nextStatement: null, colour: 30},
    {type: 'eqp_wait', message0: '等待毫秒 %1', args0: [{...input('MS'), check: 'Number'}], previousStatement: null, nextStatement: null, colour: 180},
    {type: 'eqp_while', message0: '当 %1 循环 %2', args0: [{...input('CONDITION'), check: 'Boolean'}, statement('BODY')], previousStatement: null, nextStatement: null, colour: 180},
  ];
  for (const definition of definitions) {
    // Capture a profile per workspace. Avoid replacing definitions another view uses.
    if (Blockly.Blocks[definition.type]) fail('BLOCK_REGISTRATION', '程序积木已注册；同一 Blockly 实例只注册一次');
  }
  Blockly.defineBlocksWithJsonArray(definitions);
}
