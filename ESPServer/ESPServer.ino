#include <TinyGPS++.h>
#include <TinyGPSPlus.h>
#include "esp_camera.h"
#include <WiFi.h>
#include <WebSocketsServer.h>
#include <ArduinoJson.h>



//
// WARNING!!! PSRAM IC required for UXGA resolution and high JPEG quality
//            Ensure ESP32 Wrover Module or other board with PSRAM is selected
//            Partial images will be transmitted if image exceeds buffer size
//

#define CAMERA_MODEL_AI_THINKER // Has PSRAM

#include "camera_pins.h"

//const char* ssid = "SponseredByDoubleStuffedOreos";
//const char* password = "1969moon";
const char* ssid = "Basestation";
const char* password = "basestation";

WebSocketsServer webSocket = WebSocketsServer(8080);

DynamicJsonDocument doc_in(96);

const int LED_FLASH = 4;

void motorDirection(int analogInputX, int analogInputY) {
  Serial.printf("X: %d   Y: %d\n", analogInputX, analogInputY);
}

void updateFlash(bool flashStatus) {
  digitalWrite(LED_FLASH, flashStatus);
}

void onWebSocketEvent(uint8_t num, WStype_t type, uint8_t *payload, size_t length) {
  // Figure out the type of WebSocket event
  switch (type) {

    // Client has disconnected
    case WStype_DISCONNECTED:
      Serial.printf("[%u] Disconnected!\n", num);
      break;

    // New client has connected
    case WStype_CONNECTED:
      {
        IPAddress ip = webSocket.remoteIP(num);
        Serial.printf("[%u] Connection from ", num);
        Serial.println(ip.toString());
      }
      break;

    // Echo text message back to client
    case WStype_TEXT: {

        DeserializationError error = deserializeJson(doc_in, payload);

        if (error) {
          Serial.print("JSON Deserialization Error: ");
          Serial.println(error.f_str());
          return;
        }

        int jsonPayloadType = doc_in["type"];
        char result[100];
        char message0[64];
        char message1[100];

        if (jsonPayloadType == 0) {

          DynamicJsonDocument doc_out0(128);
          DynamicJsonDocument doc_out1(128);
          
          int axisX = doc_in["payload"]["analog"][0];
          int axisY = doc_in["payload"]["analog"][1];
          bool flashStatus = doc_in["payload"]["flash"];
          updateFlash(flashStatus);
          motorDirection(axisX, axisY);
//          doc_out0["type"] = 1;
//          doc_out0["payload"][0] = 45.384492;
//          doc_out0["payload"][1] = -75.698446;
//          serializeJson(doc_out0, message0);
//          sprintf(result, "ESP32 Received: X: %d  Y: %d  F: %d", axisX, axisY, flashStatus);
//          doc_out1["type"] = 0;
//          doc_out1["payload"] = result;
//          serializeJson(doc_out1, message1);
        }

//        Serial.printf("[%u] Text: %s\n", num, payload);
//        Serial.printf("[%u] Result: %s\n", num, result);
//        webSocket.sendTXT(num, message1);
//        webSocket.broadcastTXT(message0);
        break;
      }

    // For everything else: do nothing
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
  Serial.begin(115200);
  Serial.setDebugOutput(true);
  Serial.println();

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

  // camera init
  esp_err_t err = esp_camera_init(&config);
  if (err != ESP_OK) {
    Serial.printf("Camera init failed with error 0x%x", err);
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
    Serial.print(".");
  }
  Serial.println("");
  Serial.println("WiFi connected");

  startCameraServer();

  Serial.print("Camera Ready! Use 'http://");
  Serial.print(WiFi.localIP());
  Serial.println("' to connect");

  webSocket.begin();
  webSocket.onEvent(onWebSocketEvent);
}

void loop() {
  webSocket.loop();
}
