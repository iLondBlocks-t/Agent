# Remote Desktop (RDP)

## Status

RDP is planned but not implemented in the first milestone. The current image does not include xrdp/xorgxrdp, does not expose an RDP listening port, and has no Remote Desktop settings panel. Do not expect a Windows Remote Desktop or Android RDP client to connect.

## Required design for a future implementation

A future implementation must launch the nrmaOS session rather than an unrelated desktop. It must be disabled by default, deny root login, use normal local user authentication, avoid storing plaintext passwords, configure TLS, restrict firewall exposure to trusted networks, and explain secure remote access without configuring public router forwarding. Settings must show actual server status and current sessions only when those values can be retrieved reliably.

The first version may use a separate Xorg session per remote connection, but that behavior must be documented and tested. Resolution negotiation, clipboard behavior, session reconnection, authentication, firewall behavior, and an Android/Windows client connection all require integration tests before the feature can be marked complete.
