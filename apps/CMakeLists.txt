cmake_minimum_required(VERSION 3.21)
project(nrmaos-apps VERSION 0.1.0 LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)
set(CMAKE_AUTOMOC ON)

find_package(Qt6 6.2 REQUIRED COMPONENTS Core Gui Qml Quick QuickControls2)

set(NRMAOS_APPS_QML_DIR "/usr/lib/nrmaos/apps" CACHE PATH
    "Install directory for nrmaOS native application QML files")

# 1. nrma Files (Native File Manager)
add_executable(nrma-files
    nrma-files/main.cpp
    nrma-files/FileManagerBridge.cpp
    nrma-files/FileManagerBridge.h
)

target_link_libraries(nrma-files PRIVATE
    Qt6::Core
    Qt6::Gui
    Qt6::Qml
    Qt6::Quick
    Qt6::QuickControls2
)

target_compile_definitions(nrma-files PRIVATE
    NRMAOS_FILES_SOURCE_QML="${CMAKE_CURRENT_SOURCE_DIR}/nrma-files/FilesMain.qml"
    NRMAOS_FILES_INSTALL_QML="${NRMAOS_APPS_QML_DIR}/FilesMain.qml"
)

# 2. nrma Settings (Appearance, Wallpaper, Display, Remote Desktop, Runtime, About)
add_executable(nrma-settings
    nrma-settings/main.cpp
    nrma-settings/SettingsBackend.cpp
    nrma-settings/SettingsBackend.h
)

target_link_libraries(nrma-settings PRIVATE
    Qt6::Core
    Qt6::Gui
    Qt6::Qml
    Qt6::Quick
    Qt6::QuickControls2
)

target_compile_definitions(nrma-settings PRIVATE
    NRMAOS_SETTINGS_SOURCE_QML="${CMAKE_CURRENT_SOURCE_DIR}/nrma-settings/SettingsMain.qml"
    NRMAOS_SETTINGS_INSTALL_QML="${NRMAOS_APPS_QML_DIR}/SettingsMain.qml"
)

install(TARGETS nrma-files nrma-settings RUNTIME DESTINATION bin)
install(FILES
    nrma-files/FilesMain.qml
    nrma-settings/SettingsMain.qml
    DESTINATION "${NRMAOS_APPS_QML_DIR}"
)
install(FILES
    nrma-files/nrma-files.desktop
    nrma-settings/nrma-settings.desktop
    DESTINATION share/applications
)
