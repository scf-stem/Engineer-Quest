import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync, writeFileSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {generateArduino, parseShortCpp, simulate} from '../../src/program/index.js';
import {AUTO_LIGHT_SOURCE, SYNTHETIC_DEVICE as device, SYNTHETIC_TOPOLOGY as topology, SYNTHETIC_CUSTOMER_TESTS as tests} from '../../src/program/examples.js';

const compiler = process.env.CXX || 'clang++';
const compilerReady = spawnSync(compiler, ['--version'], {encoding: 'utf8'}).status === 0;
const header = `#pragma once
#include <stdint.h>
#define A0 14
#define HIGH 1
#define LOW 0
#define INPUT 0
#define OUTPUT 1
int analogRead(uint8_t);
int digitalRead(uint8_t);
void digitalWrite(uint8_t, int);
void pinMode(uint8_t, int);
void delay(unsigned long);
`;

function compare(source, timeline = tests[0].inputTimeline) {
  const parsed = parseShortCpp(source); assert.equal(parsed.ok, true, JSON.stringify(parsed.diagnostics));
  const generated = generateArduino(parsed.value, device); assert.equal(generated.ok, true);
  const simulation = simulate(parsed.value, topology, timeline, {maxSteps: 10000, maxTimeMs: 300}).value;
  let light = device.pinMap.LIGHT.initialValue, button = device.pinMap.BUTTON.initialValue;
  const frames = timeline.map(f => {
    light = f.signals.LIGHT ?? light; button = f.signals.BUTTON ?? button;
    return `{${f.atMs}, ${light}, ${button ? 1 : 0}}`;
  });
  // Compile the exact returned .ino text unchanged, linked to a deterministic
  // Arduino API stub. This is host-C++ evidence, not AVR/Uno compile evidence.
  const harness = `#include <iostream>
struct End {};
static unsigned long nowMs = 0;
static bool enabled[20] = {};
struct Frame { unsigned long at; int light; int button; };
static const Frame frames[] = {{0,0,0}${frames.length ? ',' + frames.join(',') : ''}};
static Frame current() { Frame f = frames[0]; for (const auto &x : frames) { if(x.at <= nowMs) f=x; } return f; }
int analogRead(uint8_t p) { int value=current().light; std::cout << "R " << nowMs << " " << int(p) << " " << value << "\\n"; return value; }
int digitalRead(uint8_t p) { int value=current().button; std::cout << "R " << nowMs << " " << int(p) << " " << value << "\\n"; return value; }
void digitalWrite(uint8_t p, int value) { if(enabled[p]) std::cout << "W " << nowMs << " " << int(p) << " " << value << "\\n"; }
void pinMode(uint8_t p, int mode) { enabled[p]=(mode==OUTPUT); }
void delay(unsigned long ms) { if(nowMs+ms>300) throw End{}; nowMs+=ms; }
int main() { try { setup(); while(true) loop(); } catch(const End &) {} }
`;
  const directory = mkdtempSync(join(tmpdir(), 'eq-program-cpp-'));
  try {
    writeFileSync(join(directory, 'Arduino.h'), header);
    writeFileSync(join(directory, 'generated.cpp'), generated.value.source + harness);
    const binary = join(directory, 'generated');
    const compiled = spawnSync(compiler, ['-std=c++11', '-Wall', '-Wextra', '-I', directory, join(directory, 'generated.cpp'), '-o', binary], {encoding: 'utf8', timeout: 10000});
    assert.equal(compiled.status, 0, compiled.stderr);
    const executed = spawnSync(binary, [], {encoding: 'utf8', timeout: 3000, maxBuffer: 100000});
    assert.equal(executed.status, 0, executed.stderr);
    const expected = simulation.events.filter(e => ['read', 'write'].includes(e.kind)).map(e => `${e.kind === 'read' ? 'R' : 'W'} ${e.atMs} ${device.pinMap[e.port].pin === 'A0' ? 14 : device.pinMap[e.port].pin} ${typeof e.value === 'boolean' ? Number(e.value) : e.value}`);
    assert.deepEqual(executed.stdout.trim().split('\n').filter(Boolean), expected);
  } finally { rmSync(directory, {recursive: true, force: true}); }
}

test('exact generated Arduino C++ compiles on host and matches interpreter read/write timing', {skip: !compilerReady}, () => {
  compare(AUTO_LIGHT_SOURCE);
  compare('int count = 0; void setup() { writeDigital(LAMP, true); } void loop() { count = 0; while (count < 3) { writeDigital(LAMP, count % 2 == 0); count = count + 1; waitMs(10); } waitMs(40); }');
  compare('bool b = false; void loop() { b = false && readDigital(BUTTON); b = true || (1 / 0 > 0); writeDigital(LAMP, b && (readAnalog(LIGHT) >= 450 || readDigital(BUTTON))); waitMs(100); }');
  compare('int x = 0; void loop() { x = (-7 / 3) * 3 + (-7 % 3); writeDigital(LAMP, x == -7 && -32768 < x); waitMs(100); }');
  // Fault before right-side sampling must not be reordered by C++ evaluation.
  compare('int x = 0; void loop() { x = (1 / x) + readAnalog(LIGHT); waitMs(100); }');
  compare('int x = 32767; void loop() { writeDigital(LAMP, true); x = x + 1; }');
  compare('int x = -32768; void loop() { x = -x; }');
  compare('int x = -1; void loop() { waitMs(x); }');
});
