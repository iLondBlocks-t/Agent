# Security policy

nrmaOS is experimental software. The first milestone is a live development image, not a hardened general-purpose installation. Do not use it for sensitive workloads.

## Current security status

- RDP/xrdp is not included in the first milestone and no RDP port is opened.
- Wine is optional by design and is not installed in the base image.
- The live session may automatically log in to a locked local account to make the image evaluable; this is not an installed-user login design.
- No claim is made that the first milestone has completed a security audit.

## Reporting a vulnerability

Please do not publish exploitable details in a public issue. Contact the repository owner privately through GitHub's security advisory feature, if available, and include affected commit or image, reproduction steps, impact, and a safe contact method. Do not include passwords, access tokens, or private keys in issues, pull requests, logs, or artifacts.

## Required safeguards for future RDP work

RDP must remain disabled by default. Remote access must use regular non-root nrmaOS accounts, secure authentication, TLS, firewall restrictions, and explicit user configuration. Passwords must never be stored in plaintext. Public exposure and unsafe router port-forwarding must not be configured automatically. Each control must be tested before it is presented as functional.
