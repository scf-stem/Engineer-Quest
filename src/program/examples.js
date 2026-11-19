// Synthetic development fixtures only. D owns real course/customer requirements;
// B owns the calibrated physical device profile. No student-derived expectations.
export const SYNTHETIC_DEVICE = {
  ref: {id: 'synthetic-uno', version: '0.1', digest: 'synthetic-device-0.1'},
  family: 'arduino-uno', variant: null, fqbn: null, calibrationStatus: 'synthetic',
  pinMap: {
    LIGHT: {pin: 'A0', direction: 'input', signalType: 'analog', min: 0, max: 1023, initialValue: 0},
    BUTTON: {pin: 2, direction: 'input', signalType: 'digital', initialValue: false},
    LAMP: {pin: 9, direction: 'output', signalType: 'digital', initialValue: false},
  },
};
export const SYNTHETIC_TOPOLOGY = {
  deviceProfile: SYNTHETIC_DEVICE, deviceProfileRef: SYNTHETIC_DEVICE.ref,
  wiringRef: {id: 'synthetic-wiring', version: '0.1', digest: 'synthetic-wiring-0.1'},
};
export const AUTO_LIGHT_SOURCE = `const int threshold = 450;
int light = 0;
void loop() {
  light = readAnalog(LIGHT);
  if (light < threshold) {
    writeDigital(LAMP, true);
  } else {
    writeDigital(LAMP, false);
  }
  waitMs(100);
}
`;
export const SYNTHETIC_CUSTOMER_TESTS = [{
  id: 'fixed-light-boundaries-and-hold', requirementId: 'synthetic-auto-light',
  inputTimeline: [{atMs: 0, signals: {LIGHT: 150}}, {atMs: 40, signals: {LIGHT: 850}},
    {atMs: 160, signals: {LIGHT: 449}}, {atMs: 260, signals: {LIGHT: 450}}],
  assertions: [{atMs: 0, output: 'LAMP', equals: true}, {atMs: 50, output: 'LAMP', equals: true},
    {atMs: 100, output: 'LAMP', equals: false}, {atMs: 200, output: 'LAMP', equals: true}, {atMs: 300, output: 'LAMP', equals: false}],
  maxSteps: 1000, maxTimeMs: 300,
}];
export const SYNTHETIC_REFS = {
  programRef: {id: 'synthetic-program', version: '0.1', digest: 'replace-with-exact-program-digest'},
  wiringRef: SYNTHETIC_TOPOLOGY.wiringRef, deviceProfileRef: SYNTHETIC_DEVICE.ref,
  requirementRef: {id: 'synthetic-auto-light', version: '0.1', digest: 'synthetic-requirement-0.1'},
  testSuiteRef: {id: 'synthetic-suite', version: '0.1', digest: 'synthetic-suite-0.1'},
};

export function createExampleBlocks() {
  let id = 0;
  const block = (type, fields = {}, inputs = {}) => ({type, id: `example-${++id}`, fields, inputs});
  const value = b => ({block: b});
  const number = n => block('math_number', {NUM: n});
  const bool = b => block('logic_boolean', {BOOL: b ? 'TRUE' : 'FALSE'});
  const variable = name => block('variables_get', {VAR: {name}});
  const threshold = block('eqp_declare', {NAME: 'threshold', TYPE: 'int', CONSTANT: 'TRUE'}, {INITIAL: value(number(450))});
  const light = block('eqp_declare', {NAME: 'light', TYPE: 'int', CONSTANT: 'FALSE'}, {INITIAL: value(number(0))});
  threshold.next = value(light);
  const read = block('variables_set', {VAR: {name: 'light'}}, {VALUE: value(block('eqp_read_analog', {PORT: 'LIGHT'}))});
  const conditional = block('controls_if', {}, {IF0: value(block('logic_compare', {OP: 'LT'}, {A: value(variable('light')), B: value(variable('threshold'))})),
    DO0: value(block('eqp_write', {PORT: 'LAMP'}, {VALUE: value(bool(true))})), ELSE: value(block('eqp_write', {PORT: 'LAMP'}, {VALUE: value(bool(false))}))});
  conditional.extraState = {hasElse: true};
  read.next = value(conditional); conditional.next = value(block('eqp_wait', {}, {MS: value(number(100))}));
  return {blocks: {languageVersion: 0, blocks: [block('eqp_program', {}, {VARIABLES: value(threshold), LOOP: value(read)})]}};
}
