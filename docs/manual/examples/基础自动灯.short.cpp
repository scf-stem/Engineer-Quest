const int threshold = 450;
int light = 0;

void setup() {
}

void loop() {
  light = readAnalog(LIGHT);
  if (light < threshold) {
    writeDigital(LAMP, true);
  } else {
    writeDigital(LAMP, false);
  }
  waitMs(100);
}
