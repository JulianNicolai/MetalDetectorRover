#define LED_FLASH 4
#define SER_DATA 14
#define LATCH 13
#define SER_CLK 15
#define PWMA 16
#define PWMB 2
#define GPS_TX 3
#define GPS_RX 1
#define MTL_DTCT 12

#define PORT 8080

#define CAMERA_MODEL_AI_THINKER // Has PSRAM

#include <TinyGPS++.h>
#include <TinyGPSPlus.h>
#include "esp_camera.h"
#include <WiFi.h>
#include <WebSocketsServer.h>
#include <ArduinoJson.h>
#include "camera_pins.h"

uint8_t serialArr[8] = {0, 0, 0, 0, 0, 0, 0, 0};
const int SER_ARR_SIZE = 8;
// 0  : 0000 : A -   | B -
// 1  : 0001 : A -   | B CW
// 2  : 0010 : A -   | B CCW
// 4  : 0100 : A CW  | B -
// 5  : 0101 : A CW  | B CW
// 6  : 0110 : A CW  | B CCW
// 8  : 1000 : A CCW | B -
// 9  : 1001 : A CCW | B CW
// 10 : 1010 : A CCW | B CCW

bool metalDetected = false;
uint8_t connectedClient = 0;
int timePrev;

const char* ssid = "SponseredByDoubleStuffedOreos";
const char* password = "1969moon";
//const char* ssid = "Basestation";
//const char* password = "basestation";



WebSocketsServer webSocket = WebSocketsServer(PORT);

DynamicJsonDocument doc_in(96);
DynamicJsonDocument doc_out(128);
DynamicJsonDocument doc_out_misc(128);
char message[128];
char message_misc[256];

TinyGPSPlus gps;

void shiftOutCustom(uint8_t dataPin, uint8_t clockPin, uint8_t bitOrder, uint8_t val) {
    uint8_t i;

    for(i = 0; i < 8; i++) {
        if(bitOrder == LSBFIRST)
            digitalWrite(dataPin, !!(val & (1 << i)));
        else
            digitalWrite(dataPin, !!(val & (1 << (7 - i))));

        digitalWrite(clockPin, HIGH);
        digitalWrite(clockPin, LOW);
    }
}

void motorDirection(int analogInputY1, int analogInputY2) {

  if (analogInputY1 > 0) { // Motor A clockwise
    serialArr[4] = 0;
    serialArr[5] = 1;
  } else if (analogInputY1 < 0) { // Motor A counter-clockwise
    serialArr[4] = 1;
    serialArr[5] = 0;
  } else { // Motor A stop
    serialArr[4] = 0;
    serialArr[5] = 0;
  }

  if (analogInputY2 > 0) { // Motor B clockwise
    serialArr[6] = 1;
    serialArr[7] = 0;
  } else if (analogInputY2 < 0) { // Motor B counter-clockwise
    serialArr[6] = 0;
    serialArr[7] = 1;
  } else { // Motor B stop
    serialArr[6] = 0;
    serialArr[7] = 0;
  }
  
  int serialByte = 0;

  for (int i = 0; i < SER_ARR_SIZE; i++) {
    serialByte = serialByte << 1;
    serialByte = serialByte + serialArr[i];
  }

  digitalWrite(LATCH, LOW);
  shiftOutCustom(SER_DATA, SER_CLK, LSBFIRST, serialByte);
  digitalWrite(LATCH, HIGH);

  doc_out_misc["type"] = 0;
  doc_out_misc["payload"] = serialByte;
  serializeJson(doc_out_misc, message_misc);
  webSocket.sendTXT(connectedClient, message_misc);

//  analogWrite(PWMA, abs(analogInputY1));
//  analogWrite(PWMB, abs(analogInputY2));
  
}

void updateFlash(bool flashStatus) {
  digitalWrite(LED_FLASH, flashStatus);
}

void onWebSocketEvent(uint8_t num, WStype_t type, uint8_t *payload, size_t length) {
  
  switch (type) {

    case WStype_TEXT: {

        DeserializationError error = deserializeJson(doc_in, payload);

        if (error) {
//          Serial.print("JSON Deserialization Error: ");
//          Serial.println(error.f_str());
          return;
        }

        int jsonPayloadType = doc_in["type"];

        if (jsonPayloadType == 0) {
          int axisY1 = doc_in["payload"]["analog"][0];
          int axisY2 = doc_in["payload"]["analog"][1];
          bool flashStatus = doc_in["payload"]["flash"];
          updateFlash(flashStatus);
          motorDirection(axisY1, axisY2);
        }

//        webSocket.sendTXT(num, message);
//        webSocket.broadcastTXT(message);
        break;
      }
      
    // client has disconnected
    case WStype_DISCONNECTED: 
      {
        connectedClient = 0;
      }
      
      break;

    // client has connected
    case WStype_CONNECTED:
      {
          connectedClient = num;
//        IPAddress ip = webSocket.remoteIP(num);
      }
      break;

    // otherwise do nothing
    case WStype_BIN:
    case WStype_ERROR:
    case WStype_FRAGMENT_TEXT_START:
    case WStype_FRAGMENT_BIN_START:
    case WStype_FRAGMENT:
    case WStype_FRAGMENT_FIN:
    default:
      break;
  }
}

void startCameraServer();

void setup() {
  Serial.begin(9600);

  camera_config_t config;
  config.ledc_channel = LEDC_CHANNEL_0;
  config.ledc_timer = LEDC_TIMER_0;
  config.pin_d0 = Y2_GPIO_NUM;
  config.pin_d1 = Y3_GPIO_NUM;
  config.pin_d2 = Y4_GPIO_NUM;
  config.pin_d3 = Y5_GPIO_NUM;
  config.pin_d4 = Y6_GPIO_NUM;
  config.pin_d5 = Y7_GPIO_NUM;
  config.pin_d6 = Y8_GPIO_NUM;
  config.pin_d7 = Y9_GPIO_NUM;
  config.pin_xclk = XCLK_GPIO_NUM;
  config.pin_pclk = PCLK_GPIO_NUM;
  config.pin_vsync = VSYNC_GPIO_NUM;
  config.pin_href = HREF_GPIO_NUM;
  config.pin_sscb_sda = SIOD_GPIO_NUM;
  config.pin_sscb_scl = SIOC_GPIO_NUM;
  config.pin_pwdn = PWDN_GPIO_NUM;
  config.pin_reset = RESET_GPIO_NUM;
  config.xclk_freq_hz = 20000000;
  config.pixel_format = PIXFORMAT_JPEG;

  // if PSRAM IC present, init with UXGA resolution and higher JPEG quality
  //                      for larger pre-allocated frame buffer.
  if (psramFound()) {
    config.frame_size = FRAMESIZE_UXGA;
    config.jpeg_quality = 10;
    config.fb_count = 2;
  } else {
    config.frame_size = FRAMESIZE_SVGA;
    config.jpeg_quality = 12;
    config.fb_count = 1;
  }

  pinMode(LED_FLASH, OUTPUT);
  pinMode(SER_DATA, OUTPUT);
  pinMode(LATCH, OUTPUT);
  pinMode(SER_CLK, OUTPUT);
  pinMode(PWMA, OUTPUT);
  pinMode(PWMB, OUTPUT);
  pinMode(GPS_TX, INPUT);
  pinMode(GPS_RX, OUTPUT);
  pinMode(MTL_DTCT, INPUT);

  // camera init
  esp_err_t err = esp_camera_init(&config);
  if (err != ESP_OK) {
    return;
  }

  sensor_t * s = esp_camera_sensor_get();
  // initial sensors are flipped vertically and colors are a bit saturated
  if (s->id.PID == OV3660_PID) {
    s->set_vflip(s, 1); // flip it back
    s->set_brightness(s, 1); // up the brightness just a bit
    s->set_saturation(s, -2); // lower the saturation
  }
  // drop down frame size for higher initial frame rate
  s->set_framesize(s, FRAMESIZE_SVGA);
  s->set_gainceiling(s, (gainceiling_t)1);

#if defined(CAMERA_MODEL_M5STACK_WIDE) || defined(CAMERA_MODEL_M5STACK_ESP32CAM)
  s->set_vflip(s, 1);
  s->set_hmirror(s, 1);
#endif

  WiFi.begin(ssid, password);

  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
  }

  startCameraServer();

  webSocket.begin();
  webSocket.onEvent(onWebSocketEvent);

  timePrev = millis();
}

void loop() {
  
  int metalDetectStatus = digitalRead(MTL_DTCT);

  while (Serial.available() > 0) {
    gps.encode(Serial.read());
  }
  
  if (!metalDetected && metalDetectStatus) { // New metal detected!
    metalDetected = true;
    doc_out["type"] = 1;
    doc_out["payload"]["location"][0] = gps.location.lat();
    doc_out["payload"]["location"][1] = gps.location.lng();
    doc_out["payload"]["metal"] = metalDetected;
    serializeJson(doc_out, message);
    webSocket.sendTXT(connectedClient, message);
  } else if (metalDetected && !metalDetectStatus) { // Metal detector just turned off
    metalDetected = false;
  } else {
    int timeNow = millis();
    if ((timeNow - timePrev) > 1000) {
      doc_out["type"] = 2;
      doc_out["payload"]["location"][0] = gps.location.lat();
      doc_out["payload"]["location"][1] = gps.location.lng();
      doc_out["payload"]["sats"] = gps.satellites.value();
      doc_out["payload"]["alt"] = gps.altitude.meters();
      doc_out["payload"]["hdop"] = gps.hdop.value();
      serializeJson(doc_out, message);
      webSocket.sendTXT(connectedClient, message);
      timePrev = timeNow;
    }
    
  }
  webSocket.loop();
}
