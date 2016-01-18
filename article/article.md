# Connecting your IoT device to the cloud with mbed

First let's set up our device. Tri-color LED on a breadboard. 220 Ohm on red and blue pin, less resistance on the green one, because it's less bright (here 2x 220 Ohm in parallel = 110 Ohm).

So we need device connector library. `yt install mbed-client`. Our main.cpp we can copy from [here](https://github.com/ARMmbed/mbed-client-examples/blob/master/source/main.cpp). It's a bit much code. But a las.

Now sign up for connector, and click 'My Devices' -> 'Security Credentials' -> 'Get my security credentials'.

Get that file and store it as source/security.h... Now in main.cpp add some code to address the tri-color LED:

```cpp
static DigitalOut red(YOTTA_CFG_HARDWARE_PINS_D5);
static DigitalOut green(YOTTA_CFG_HARDWARE_PINS_D6);
static DigitalOut blue(YOTTA_CFG_HARDWARE_PINS_D7);
```

Build the app and flash device. Now connect to the device over screen. Or use Arduino Serial Monitor (9600 baud), it's nice. You should see something like:

```
IP address 192.168.2.8
Device name 521f9d17-c5d7-4769-b89f-b6089026b4da

Registered
```

Now if you go to [Connected devices](https://connector.mbed.com/#endpoints) page, you should see the device as Active...

![Connector](assets/connector1.png)

We can send some data back to the cloud now by pressing SW2 button (in the `update_resource` function). It will say that in the console as well...

```
updating resource to 1
updating resource to 2
```

Now we can go to the [API Console](https://connector.mbed.com/#console) and query the status of the device:

```
https://api.connector.mbed.com/endpoints/521f9d17-c5d7-4769-b89f-b6089026b4da/Test/0/D
```

*Todo: What's the difference between /S and /D??*

![Connector](assets/connector2.png)

*The payload is base64 decoded, and we encoded the value that we send in ASCII on the device.*

## Sending data back to the device

So now we can send data from the device to the cloud. Now time to send some data back. First go to [Access Keys](https://connector.mbed.com/#accesskeys), and obtain an access key.

Now test if you can use the access key by executing the same command as we did in the API Console but via curl instead...


