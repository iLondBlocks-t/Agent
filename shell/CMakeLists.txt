cmake_minimum_required(VERSION 3.21)
project(nrmaos-shell VERSION 0.1.0 LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)
set(CMAKE_AUTOMOC ON)

find_package(Qt6 6.2 REQUIRED COMPONENTS Core Gui Network Qml Quick QuickControls2)
find_package(X11 REQUIRED)

set(NRMAOS_QML_INSTALL_DIR "/usr/lib/nrmaos" CACHE PATH
    "Install directory for nrmaOS shell QML files")

add_executable(nrmaos-shell
    src/main.cpp
    src/SystemSettings.cpp
    src/SystemSettings.h
    src/WindowManagerBridge.cpp
    src/WindowManagerBridge.h
    src/LauncherBridge.cpp
    src/LauncherBridge.h
    src/SystemControlBridge.cpp
    src/SystemControlBridge.h
    src/NotificationCenter.cpp
    src/NotificationCenter.h
    src/ShellIpcServer.cpp
    src/ShellIpcServer.h
)

target_link_libraries(nrmaos-shell PRIVATE
    Qt6::Core
    Qt6::Gui
    Qt6::Network
    Qt6::Qml
    Qt6::Quick
    Qt6::QuickControls2
    X11::X11
)

target_compile_definitions(nrmaos-shell PRIVATE
    NRMAOS_SOURCE_QML_DIR="${CMAKE_CURRENT_SOURCE_DIR}/qml"
    NRMAOS_INSTALL_QML_DIR="${NRMAOS_QML_INSTALL_DIR}"
)

install(TARGETS nrmaos-shell RUNTIME DESTINATION bin)
install(DIRECTORY qml/ DESTINATION "${NRMAOS_QML_INSTALL_DIR}")

include(CTest)
if(BUILD_TESTING)
    find_package(Python3 COMPONENTS Interpreter QUIET)
    if(Python3_Interpreter_FOUND)
        add_test(NAME shell-static-contract
            COMMAND "${Python3_EXECUTABLE}" "${CMAKE_CURRENT_SOURCE_DIR}/tests/test_shell_contract.py")
    endif()
endif()
