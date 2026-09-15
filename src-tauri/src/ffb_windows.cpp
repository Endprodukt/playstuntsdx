#define DIRECTINPUT_VERSION 0x0800
#include <windows.h>
#include <dinput.h>
#include <atomic>
#include <chrono>
#include <thread>
#include <algorithm>

namespace {
std::atomic<int> requestedForce{0};
std::atomic<bool> refreshRequested{false};
std::atomic<int> status{0};
std::once_flag workerOnce;

BOOL CALLBACK findWindowProc(HWND hwnd, LPARAM param) {
    DWORD processId = 0;
    GetWindowThreadProcessId(hwnd, &processId);
    if (processId != GetCurrentProcessId() || !IsWindowVisible(hwnd) || GetWindow(hwnd, GW_OWNER)) return TRUE;
    *reinterpret_cast<HWND*>(param) = hwnd;
    return FALSE;
}

HWND findProcessWindow() {
    HWND result = nullptr;
    EnumWindows(findWindowProc, reinterpret_cast<LPARAM>(&result));
    return result;
}

struct DeviceContext {
    IDirectInput8W* directInput = nullptr;
    IDirectInputDevice8W* device = nullptr;
};

BOOL CALLBACK enumDeviceProc(const DIDEVICEINSTANCEW* instance, VOID* context) {
    auto* devices = static_cast<DeviceContext*>(context);
    if (SUCCEEDED(devices->directInput->CreateDevice(instance->guidInstance, &devices->device, nullptr))) {
        return DIENUM_STOP;
    }
    return DIENUM_CONTINUE;
}

void runWorker() {
    IDirectInput8W* directInput = nullptr;
    if (FAILED(DirectInput8Create(GetModuleHandleW(nullptr), DIRECTINPUT_VERSION, IID_IDirectInput8W,
                                  reinterpret_cast<void**>(&directInput), nullptr))) {
        status.store(-1);
        return;
    }

    DeviceContext context{directInput, nullptr};
    if (FAILED(directInput->EnumDevices(DI8DEVCLASS_GAMECTRL, enumDeviceProc, &context,
                                        DIEDFL_ATTACHEDONLY | DIEDFL_FORCEFEEDBACK)) || !context.device) {
        directInput->Release();
        status.store(-1);
        return;
    }

    IDirectInputDevice8W* device = context.device;
    if (FAILED(device->SetDataFormat(&c_dfDIJoystick2))) {
        device->Release();
        directInput->Release();
        status.store(-1);
        return;
    }

    HWND hwnd = nullptr;
    for (int retry = 0; retry < 100 && !hwnd; ++retry) {
        hwnd = findProcessWindow();
        if (!hwnd) std::this_thread::sleep_for(std::chrono::milliseconds(50));
    }
    if (!hwnd || FAILED(device->SetCooperativeLevel(hwnd, DISCL_EXCLUSIVE | DISCL_FOREGROUND))) {
        device->Release();
        directInput->Release();
        status.store(-1);
        return;
    }

    DIPROPDWORD autoCenter{};
    autoCenter.diph.dwSize = sizeof(DIPROPDWORD);
    autoCenter.diph.dwHeaderSize = sizeof(DIPROPHEADER);
    autoCenter.diph.dwObj = 0;
    autoCenter.diph.dwHow = DIPH_DEVICE;
    autoCenter.dwData = DIPROPAUTOCENTER_OFF;
    device->SetProperty(DIPROP_AUTOCENTER, &autoCenter.diph);

    DWORD axes[1] = {DIJOFS_X};
    LONG directions[1] = {0};
    DICONSTANTFORCE constantForce{};
    constantForce.lMagnitude = 0;
    DIEFFECT effectDefinition{};
    effectDefinition.dwSize = sizeof(DIEFFECT);
    effectDefinition.dwFlags = DIEFF_CARTESIAN | DIEFF_OBJECTOFFSETS;
    effectDefinition.dwDuration = INFINITE;
    effectDefinition.dwGain = DI_FFNOMINALMAX;
    effectDefinition.dwTriggerButton = DIEB_NOTRIGGER;
    effectDefinition.cAxes = 1;
    effectDefinition.rgdwAxes = axes;
    effectDefinition.rglDirection = directions;
    effectDefinition.cbTypeSpecificParams = sizeof(DICONSTANTFORCE);
    effectDefinition.lpvTypeSpecificParams = &constantForce;

    IDirectInputEffect* effect = nullptr;
    device->Acquire();
    if (FAILED(device->CreateEffect(GUID_ConstantForce, &effectDefinition, &effect, nullptr)) || !effect) {
        device->Unacquire();
        device->Release();
        directInput->Release();
        status.store(-1);
        return;
    }

    status.store(0);
    int lastForce = 0x7fffffff;
    bool needsRestart = true;
    auto nextHealthCheck = std::chrono::steady_clock::now();
    auto nextAcquireAttempt = nextHealthCheck;

    for (;;) {
        const auto now = std::chrono::steady_clock::now();
        const int force = std::clamp(requestedForce.load(), -DI_FFNOMINALMAX, DI_FFNOMINALMAX);
        const bool refresh = refreshRequested.exchange(false);

        if (now >= nextHealthCheck) {
            DWORD effectStatus = 0;
            const HRESULT health = effect->GetEffectStatus(&effectStatus);
            if (FAILED(health) || !(effectStatus & DIEGES_PLAYING)) needsRestart = true;
            nextHealthCheck = now + std::chrono::milliseconds(100);
        }

        if ((force != lastForce || refresh || needsRestart) && now >= nextAcquireAttempt) {
            HRESULT result = device->Acquire();
            if (SUCCEEDED(result)) {
                device->SendForceFeedbackCommand(DISFFC_SETACTUATORSON);
                DICONSTANTFORCE updateForce{};
                updateForce.lMagnitude = force;
                DIEFFECT update{};
                update.dwSize = sizeof(DIEFFECT);
                update.cbTypeSpecificParams = sizeof(DICONSTANTFORCE);
                update.lpvTypeSpecificParams = &updateForce;
                result = effect->SetParameters(&update, DIEP_TYPESPECIFICPARAMS | DIEP_START);
            }

            if (SUCCEEDED(result)) {
                lastForce = force;
                needsRestart = false;
                status.store(1);
                nextHealthCheck = now + std::chrono::milliseconds(100);
            } else {
                // Foreground-exclusive DirectInput devices are expected to become
                // unacquired while another window has focus. Keep retrying without
                // treating that normal focus transition as a missing wheel.
                needsRestart = true;
                status.store(0);
                nextAcquireAttempt = now + std::chrono::milliseconds(50);
            }
        }
        std::this_thread::sleep_for(std::chrono::milliseconds(4));
    }
}

void ensureWorker() {
    std::call_once(workerOnce, [] {
        std::thread(runWorker).detach();
    });
}
} // namespace

extern "C" int stunts_ffb_set_force(int force) {
    requestedForce.store(std::clamp(force, -DI_FFNOMINALMAX, DI_FFNOMINALMAX));
    // A resend is also a recovery request. This matters when foreground focus
    // returns while the desired force happens to be identical to the old value.
    refreshRequested.store(true);
    ensureWorker();
    return status.load();
}

extern "C" int stunts_ffb_status() {
    ensureWorker();
    return status.load();
}

extern "C" void stunts_ffb_stop() {
    requestedForce.store(0);
    refreshRequested.store(true);
}
