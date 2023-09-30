// constants won't change. Used here to set a pin number:
#include <Wire.h>

#include <SparkFun_VL6180X.h>

#define VL6180X_ADDRESS 0x29

// VL6180xIdentification identification;
VL6180x sensor(VL6180X_ADDRESS);

const int ledPin2 = 13;// the number of the LED pin
const int ledPin = 10;
const int buttonPin = 2;
// Variables will change:
int ledState = LOW;             // ledState used to set the LED
int buttonState = 0; 

// Generally, you should use "unsigned long" for variables that hold time
// The value will quickly become too large for an int to store
// unsigned long previousMillis = 0;        // will store last time LED was updated

// constants won't change:
// const long interval = 1000;           // interval at which to blink (milliseconds)

void setup() {
  // set the digital pin as output:
  Serial.begin(115200);
  Wire.begin();         // Start I2C library
  delay(100);           // delay .1s


  pinMode(ledPin, OUTPUT);
  pinMode(ledPin2, OUTPUT);
  pinMode(buttonPin, INPUT);


  if (sensor.VL6180xInit() != 0)
  {
    Serial.println("Failed to initialize. Freezing..."); // Initialize device and check for errors
    while (1)
      ;
  }

  sensor.VL6180xDefautSettings(); // Load default settings to get started.

  delay(1000); // delay 1s

}
char c;
int count =10;
void loop() {
  delay(100);
  
  read();
  send();
  // delay(500);

}

void updateCount(){
  count++;
  if(count>99){
    count=10;
  }
  return;
}

int sendCount = 1;

void send(){
  // buttonState = digitalRead(buttonPin);

  // // check if the pushbutton is pressed. If it is, the buttonState is HIGH:
  // if (buttonState == HIGH) {
  //   // turn LED on:
  //   Serial.println("Hello World");
  // } else {
  //   // turn LED off:
  //   Serial.println("Goodbye World");
  // }

  Serial.println(createPacket(sendCount));




  sendCount++;
  if(sendCount>3){
    sendCount=1;
  }


}

String createPacket(int identifier){  
  int num = identifier;
  String s = ",";
  s += String(num);
  num -=1;
  num *= 6;
  num +=1;

  for(int i=0;i<5;i++){
    s += ",";
    s += String(num+i);
    s += String(count);
  }
  s += ",";
  s += String(num+5);
  s += String((int)((sensor.getDistance()*99)/255.0));
  

  updateCount();
  return s;

}


void read(){
    if(Serial.available()){
    c = Serial.read();
    if(c=='1'){
      ledState = HIGH;
      digitalWrite(ledPin2, ledState);

    }
    else if(c=='0'){
      ledState = LOW;
      digitalWrite(ledPin2, ledState);

    }
    // else{
    //   Serial.println(c);
    // }
    
    digitalWrite(ledPin, ledState);
  }
}
