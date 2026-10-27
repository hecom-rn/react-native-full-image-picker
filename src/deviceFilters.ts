import type { CameraDevice } from 'react-native-vision-camera';

/**
 * 过滤掉没有任何 format 的摄像头设备。
 *
 * 阔折/多摄设备（如华为 Pura X）会向系统枚举出零 format 的逻辑摄像头，
 * vision-camera 的 useCameraFormat/getCameraFormat 选中这类设备时会在渲染期抛
 * device/invalid-device（"The given Camera Device (N) does not have any formats!"），
 * 未捕获即 fatal 闪退（bug 71203297 / Sentry CRMPLUS-53Y）。
 */
export function filterDevicesWithFormats(devices: CameraDevice[]): CameraDevice[] {
    return devices.filter((device) => Array.isArray(device.formats) && device.formats.length > 0);
}
