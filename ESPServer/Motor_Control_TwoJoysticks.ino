#define PWM1 3
#define AIN2 4
#define AIN1 5
#define BIN1 6
#define BIN2 7
#define PWM2 9
#define smallPoten A0
#define bigPoten A1

float Ljoy = 0;
float Rjoy = 0;
int maxSpeed = 255;
float sensi = 25;
int Aspeed = 0;
int Bspeed = 0;

void setup() {
  Serial.begin(9600);  
  pinMode(PWM1,OUTPUT);
  pinMode(AIN2,OUTPUT);
  pinMode(AIN1,OUTPUT);
  pinMode(BIN1,OUTPUT);
  pinMode(BIN2,OUTPUT);
  pinMode(PWM2,OUTPUT);
}
 
void loop() {
  analogWrite(PWM1,Aspeed);
  analogWrite(PWM2,Bspeed);
  
  Ljoy = analogRead(smallPoten);
  Ljoy = map(Ljoy, 0, 1023, -255, 255);

  Rjoy = analogRead(bigPoten);
  Rjoy = map(Rjoy, 0, 1023, -255, 255);

  
  
  if(Ljoy >= sensi){
    digitalWrite(AIN1,HIGH); //Motor A clockwise
    digitalWrite(AIN2,LOW);

    Aspeed = map(Ljoy, sensi, 255, 0, maxSpeed);
  } else if(Ljoy <= -sensi){
    digitalWrite(AIN1,LOW); //Motor A counter clockwise
    digitalWrite(AIN2,HIGH);

    Aspeed = map(Ljoy, -sensi, -255, 0, maxSpeed);
  } else{
    digitalWrite(AIN1,LOW); //Motor A stop
    digitalWrite(AIN2,LOW);

    Aspeed = 0;
  }

  if(Rjoy >= sensi){
    digitalWrite(BIN1,HIGH); //Motor B clockwise
    digitalWrite(BIN2,LOW);

    Bspeed = map(Rjoy, sensi, 255, 0, maxSpeed);
  } else if(Rjoy <= -sensi){
    digitalWrite(BIN1,LOW); //Motor B counter clockwise
    digitalWrite(BIN2,HIGH);

    Bspeed = map(Rjoy, -sensi, -255, 0, maxSpeed);
  } else{
    digitalWrite(BIN1,LOW); //Motor B stop
    digitalWrite(BIN2,LOW);

    Bspeed = 0;
  }

}
