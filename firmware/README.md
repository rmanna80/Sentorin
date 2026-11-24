# Pen firmware (nRF52832 / Fanstel BC832 V1)

nRF Connect SDK (Zephyr) application. **Status: written, not compiled and not run on hardware.**
Expect to adjust Kconfig/devicetree names to your SDK version on the first build.

Build for a development kit first:

    west build -b nrf52dk/nrf52832 firmware

What v1 does
- Scannable, non-connectable advertising every 2 s at the default 0 dBm.
- Advertises the Sentorin service UUID and the name `STN-<public id>`; battery voltage in manufacturer data.
- Reads the public ID from UICR CUSTOMER[0..1] (8 ASCII characters, written when the pen is programmed).
- Internal RC low-frequency clock (no crystal on the board); DC/DC regulator mode.
- Measures supply voltage every 10 minutes; below 2.1 V it advertises five times less often.

Not implemented yet
- **Rotating private identifiers.** v1 broadcasts a fixed name, so anyone nearby can recognise the same pen over time.
- Authenticated provisioning, configuration and ownership transfer over Bluetooth.
- Unwanted-tracking protections, firmware update, access-port protection for production.
- A registered Bluetooth company ID (0xFFFF is the test value).
- No compatibility with Apple Find My or Google Find Hub.
