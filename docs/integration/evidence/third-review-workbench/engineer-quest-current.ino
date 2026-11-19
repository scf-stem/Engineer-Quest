#include <Arduino.h>
#include <stdint.h>
// Fixed teaching runtime. On arithmetic/wait fault, hold outputs until reset.
static void _eqFault() { while (true) { delay(1000UL); } }
static int16_t _eqInt(int32_t value) {
  if (value < -32768L || value > 32767L) _eqFault();
  return (int16_t)value;
}
static int16_t _eqAdd(int16_t a, int16_t b) { return _eqInt((int32_t)a + b); }
static int16_t _eqSub(int16_t a, int16_t b) { return _eqInt((int32_t)a - b); }
static int16_t _eqMul(int16_t a, int16_t b) { return _eqInt((int32_t)a * b); }
static int16_t _eqDiv(int16_t a, int16_t b) { if (b == 0) _eqFault(); return _eqInt((int32_t)a / b); }
static int16_t _eqMod(int16_t a, int16_t b) { if (b == 0) _eqFault(); return _eqInt((int32_t)a % b); }
static int16_t _eqNeg(int16_t a) { return _eqInt(-(int32_t)a); }
static int16_t readAnalog(uint8_t pin) { return _eqInt(analogRead(pin)); }
static bool readDigital(uint8_t pin) { return digitalRead(pin) == HIGH; }
static void writeDigital(uint8_t pin, bool on) { digitalWrite(pin, on ? HIGH : LOW); }
static void waitMs(int16_t ms) { if (ms < 0) _eqFault(); delay((unsigned long)ms); }
static const uint8_t _eqp_LIGHT = A0;
static const uint8_t _eqp_LAMP = 9;
static int16_t _eqv_light = 0;
void setup() {
  pinMode(_eqp_LIGHT, INPUT);
  digitalWrite(_eqp_LAMP, LOW);
  pinMode(_eqp_LAMP, OUTPUT);
}
void loop() {
  const auto _eqt_1 = readAnalog(_eqp_LIGHT);
  _eqv_light = _eqt_1;
  const auto _eqt_3 = _eqv_light;
  const auto _eqt_4 = 600;
  const auto _eqt_2 = (_eqt_3 < _eqt_4);
  if (_eqt_2) {
    const auto _eqt_5 = true;
    writeDigital(_eqp_LAMP, _eqt_5);
  } else {
    const auto _eqt_6 = false;
    writeDigital(_eqp_LAMP, _eqt_6);
  }
  const auto _eqt_7 = 100;
  waitMs(_eqt_7);
}
