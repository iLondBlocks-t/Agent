# Windows application compatibility

## Status

Wine and nrma Runtime are not included in the first milestone. There is no `.exe` file association, installer wizard, prefix manager, application shortcut workflow, or compatibility diagnostics UI yet.

## Planned safeguards

Wine support is intended to be optional so the base image remains small. When implemented, the project must clearly explain that Windows application compatibility varies by application and must not claim universal compatibility. The runtime should use separate Wine prefixes where appropriate, report the selected Wine version and prefix, and avoid launching untrusted executables automatically. Installation, cleanup, logs, and troubleshooting must be documented before presenting the workflow as complete.
