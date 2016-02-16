# two-way mbed connector

Web interface that can communicate with device running https://github.com/ARMmbed/mbed-client-mbedos-example
through mbed Device Connector.

## Usage

1. Flash the [mbed-client-mbedos-example](https://github.com/ARMmbed/mbed-client-mbedos-example) firmware on K64F
2. Note the Device ID
3. Get an API Key for mbed Device Connector (xxx)
4. Run `TOKEN=xxx node connector-web.js`
5. Go to /status/YOUR_DEVICE_ID and control the device
