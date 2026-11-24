# Tests

Tests must distinguish static source checks from successful ISO builds and real boots. `scripts/test-source.sh` covers selected source structure and security defaults; it does not establish ISO build success, boot success, shell interaction, or RDP/Wine behavior. Add integration tests alongside each implemented component and report the environment used.
