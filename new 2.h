// definování pinů pro displej 
const int latchPin = 4;
const int clkPin = 7;
const int dataPin = 8;
// definování pinu pro potenciometr
const int potPin = A0;

// inicializace proměnné pro potenciometr
int potVal;

// pole čísel pro displej od 0 do 9 
const byte mapSegment[] = {0xC0,0xF9,0xA4,0xB0,0x99,0x92,0x82,0xF8,0X80,0X90};
// pole číslic na displeji 
const byte mapNumSeg[] = {0xF1,0xF2,0xF4,0xF8};

void setup()
{
  // nastavení pinů vstupních/výstupních
  pinMode(latchPin, OUTPUT);
  pinMode(clkPin, OUTPUT);
  pinMode(dataPin, OUTPUT);
  pinMode(potPin, INPUT);
}

void loop()
{
  // čtění analogové hodnoty potenciometru
  potVal = analogRead(potPin);
  
  // zapsání hodnoty na displej
  // volání fuknce (segment, hodnota)
  // na segment "0" se napíše řád tísícovek
  writeSeg(0 , potVal / 1000);
  // na segment "1" se napíše řád stovek
  writeSeg(1 , (potVal / 100) % 10);
  writeSeg(2 , (potVal / 10) % 10);
  writeSeg(3 , potVal % 10);
}

// uživatelem definovaná funkce pro zápis
void writeSeg(byte segment, byte hodnota)
{
  // při přepisování musí být latchPin LOW!
  digitalWrite(latchPin, LOW);
  shiftOut(dataPin, clkPin, MSBFIRST, mapSegment[hodnota]);
  shiftOut(dataPin, clkPin, MSBFIRST, mapNumSeg[segment] );
  // jakmile přepisování skončí, pin zase nastavíme na HIGH
  digitalWrite(latchPin, HIGH);
}

