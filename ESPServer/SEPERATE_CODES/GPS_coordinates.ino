#include "TinyGPS++.h"
#include "SoftwareSerial.h"

SoftwareSerial serial_connection(2, 3); //RX(g) =pin 3, TX(w) =pin 2
TinyGPSPlus gps;
void setup()
{
  Serial.begin(9600);
  serial_connection.begin(9600);
  Serial.println("GPS Start");
}

void loop()
{
  while(serial_connection.available())
  {
    gps.encode(serial_connection.read());
  }
  if(gps.location.isUpdated())
  {
    Serial.println("Satellite Count:");
    Serial.println(gps.satellites.value());
    Serial.println("Latitude:");
    Serial.println(gps.location.lat(), 6);
    Serial.println("Longitude:");
    Serial.println(gps.location.lng(), 6);
    Serial.println("");
    delay (1000);
  } 
  
 
}
