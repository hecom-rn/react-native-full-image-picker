import ImageResizer from '@bam.tech/react-native-image-resizer';
import * as Sentry from '@sentry/react-native';
import React, { useRef, useState } from 'react';
import {
    Alert,
    Image,
    Platform,
    StyleSheet,
    Text,
    TouchableOpacity,
    useWindowDimensions,
    View,
} from 'react-native';
import RNFS from 'react-native-fs';
import ImageMarker, { Position } from 'react-native-image-marker';
import Toast from 'react-native-root-toast';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Video from 'react-native-video';
import ViewShot from 'react-native-view-shot';
import {
    Camera,
    CameraProps,
    PhotoFile,
    getCameraDevice,
    useCameraDevices,
    useCameraFormat,
    VideoFile,
} from 'react-native-vision-camera';
import { filterDevicesWithFormats } from './deviceFilters';
import PageKeys from './PageKeys';

/*
 * CameraView —— 折叠屏拍照方向方案（bug 71117652 拍照后照片自动旋转 /
 * 70945454 横拍无水印）。产品决策：UI 控件与水印不随重力实时旋转，按锁定方向
 * 固定展示。三点思路：
 *   1. 方向策略（产品拍板终版）：完全不锁定——拍照页保持应用默认 unlockAll
 *      状态，窗口跟随系统旋转；不做任何 lock/unlock/监听（此前形态感知重锁实测
 *      循环旋转、无条件竖锁在展开态又与面板方向错位，均弃用）。成片仍由原生按
 *      重力姿态补偿（内容直立），JS 无任何旋转。
 *   2. 取景器 == 成片：信任原生重力补偿出图（成片 = 原图像素，内容直立、画幅随
 *      握持，不再 JS 强转/不再截图覆盖），预览 contain 铺满（FOV == 成片 FOV）；
 *      UI 控件按锁定方向固定渲染，不随握持旋转。
 *   3. 水印按成片实际方向合成：水印截图（窗口向、锚定框 = 预览在窗口中的投影
 *      矩形）先 contain 等比缩放进成片画布再居中盖章——握持==锁定方向时画幅
 *      一致、恰好全幅铺满、位置逐像素对位；握持≠锁定方向（如锁竖屏横拍，成片
 *      为横图）时不变形、完整落在图内，文字方向不强求与成片像素方向一致
 *      （产品决策）。永不落图外 = 修 70945454「横屏没有水印」。水印层触摸不
 *      穿透、不可拖动为产品既定行为。
 */

type Props = {
    maxSize?: number;
    sideType?: 'back' | 'front';
    flashMode?: 'off' | 'on';
    cameraProps?: Partial<CameraProps>;
    pictureOptions?: { width?: number };
    isVideo?: boolean;
    waterView?: () => React.ReactElement;
    layerView?: () => React.ReactElement;
    cancelLabel?: string;
    okLabel?: string;
    useVideoLabel?: string;
    usePhotoLabel?: string;
    maxSizeTakeAlert?: (maxSize: number) => string;
    navigation?: any;
    callback?: (data: Array<{ uri: string } & Result>) => void;
};

type Result = PhotoFile | VideoFile;

const topHeight = 60;
const bottomHeight = 84;
/*
     鸿蒙上改回4:3， 因为 @react-native-ohos/react-native-vision-camera": "4.7.1"中
     CameraConstants   public static readonly PHOTO_RATIO: number = 4 / 3;
       public static readonly VIDEO_RATIO: number = 16 / 9;
    现在并没有录制视频的需求，暂时统一设置为4:3.
*/
const CAMERA_RATIO = 4 / 3;

/*
 * direction 模型：窗口按进入方向锁定（见下方 lockAtEntry），整个拍照会话内窗口
 * 方向冻结，UI 控件与水印按锁定方向固定渲染（产品决策：不随重力实时旋转）；
 * 成片由原生按重力姿态补偿（ohos getPhotoRotation / 上游 outputOrientation="device"），
 * 拍照后照片不发生任何 JS 侧旋转（71117652 的"照片自动旋转"即旧版强转逻辑）。
 */

export default function CameraView(props: Props): React.ReactElement {
    const {
        maxSize = 1,
        sideType = 'back',
        flashMode = 'off',
        cameraProps = {},
        pictureOptions: { width: picWidth = 1920 } = {},
        isVideo = false,
        waterView,
        layerView,
        cancelLabel = '',
        okLabel = '',
        useVideoLabel = '',
        usePhotoLabel = '',
        maxSizeTakeAlert,
        navigation,
        callback,
    } = props;

    const isHarmony = Platform.OS === 'harmony';
    const insets = useSafeAreaInsets();
    const [data, setData] = useState<Array<{ uri: string } & Result>>([]);
    const [isPreview, setIsPreview] = useState(false);
    const [currentSideType, setCurrentSideType] = useState<'back' | 'front'>(sideType);
    const [currentFlashMode, setCurrentFlashMode] = useState<'off' | 'on'>(flashMode);
    const [isRecording, setIsRecording] = useState(false);
    const [takingPicture, setTakingPicture] = useState(false);
    const cameraRef = useRef<Camera>(null);
    const viewShotRef = useRef<ViewShot>(null);
    const flashModes: Array<'off' | 'on'> = ['off', 'on'];
    // 窗口尺寸直接挂 useWindowDimensions（旋转事件直驱）：比根容器 onLayout →
    // setState 的两段式早一拍，旋转后锚定框/快门位置不出现"先旧后新"的卡顿帧
    const { width: layoutWidth, height: layoutHeight } = useWindowDimensions();

    // 先过滤零 format 设备再选：阔折/多摄设备（如 Pura X）会枚举出无任何 format 的
    // 逻辑摄像头，useCameraFormat 选中即渲染期抛 invalid-device 闪退（bug 71203297）
    const allDevices = useCameraDevices();
    const device = getCameraDevice(filterDevicesWithFormats(allDevices), currentSideType);
    const format = useCameraFormat(device, [
        { photoAspectRatio: CAMERA_RATIO, photoResolution: { width: picWidth, height: picWidth * CAMERA_RATIO } }
    ]);

    // 水印锚定框 = 预览在窗口中的投影矩形：port 默认预览矩形在竖屏原生显示上
    // 跟随窗口横竖（竖窗全宽 3:4、横窗全高 4:3，见 WindowUtil.getMaxDisplaySize），
    // 此处按同口径计算；宿主 WaterView 在框内固定渲染（水印不可拖动为产品既定
    // 行为，水印层触摸不穿透）。注：三折叠全展开内屏为横屏原生方向，默认矩形
    // 会呈竖卡状，此时锚定框与预览矩形存在偏差（产品已接受走 vision-camera
    // 默认行为，不 patch）。
    const windowIsLandscape = layoutWidth >= layoutHeight;
    let wmWidth;
    let wmHeight;
    if (windowIsLandscape) {
        wmHeight = layoutHeight;
        wmWidth = Math.min(layoutWidth, layoutHeight * CAMERA_RATIO);
    } else {
        wmWidth = layoutWidth;
        wmHeight = Math.min(layoutHeight, layoutWidth * CAMERA_RATIO);
    }

    const _renderCameraView = () => (
        <View style={StyleSheet.absoluteFill}>
            {device && (
                <Camera
                    ref={cameraRef}
                    device={device}
                    format={format}
                    isActive={true}
                    photo={!isVideo}
                    video={isVideo}
                    audio={isVideo}
                    torch={isVideo ? currentFlashMode : 'off'}
                    enableZoomGesture={true}
                    // 取景器铺满不转（simple-camera 模型）：cover 裁切，预览方向由原生
                    // 按窗口补偿。ohos 移植版 JS 默认即 cover，此处显式声明两端一致。
                    resizeMode="cover"
                    // 成片跟随物理握持（stock camera 行为）。ohos 移植版不消费该 prop
                    // （原生按重力姿态补偿，行为等价）；Android/iOS 走上游 outputOrientation。
                    outputOrientation="device"
                    // SurfaceView（默认）在锁竖屏 App + 阔折内屏展开（display rotation≠0）时
                    // CameraX 变换补偿缺陷导致预览 180° 颠倒；TextureView 走应用侧矩阵补偿行为正确
                    androidPreviewViewType="texture-view"
                    style={StyleSheet.absoluteFill}
                    {...cameraProps}
                />
            )}
            {waterView && (
                <View style={[StyleSheet.absoluteFill, styles.watermarkAnchor]}>
                    <ViewShot ref={viewShotRef} style={{ width: wmWidth, height: wmHeight }}>
                        {waterView()}
                    </ViewShot>
                </View>
            )}
        </View>
    );

    const _renderPreviewView = () => (
        <View style={{ flex: 1 }}>
            {isVideo ? (
                <Video
                    source={{ uri: data[0].uri }}
                    style={{ flex: 1 }}
                />
            ) : (
                <Image
                    resizeMode="contain"
                    style={{ flex: 1 }}
                    source={{ uri: data[0].uri }}
                />
            )}
            {layerView?.()}
        </View>
    );

    const _renderTopView = () => {
        const style = {
            top: insets.top,
            left: insets.left,
            right: insets.right,
        };
        let image;
        switch (currentFlashMode) {
            case 'on':
                image = require('./images/flash_open.png');
                break;
            default:
                image = require('./images/flash_close.png');
        }
        return (
            <View style={[styles.top, style]}>
                {!isVideo && _renderTopButton(image, _clickFlashMode)}
                {_renderTopButton(require('./images/switch_camera.png'), _clickSwitchSide)}
            </View>
        );
    };

    const _renderTopButton = (image: any, onPress: () => void) => (
        <TouchableOpacity onPress={onPress}>
            <Image style={styles.topImage} source={image} />
        </TouchableOpacity>
    );

    const _renderBottomView = () => {
        const style = {
            bottom: insets.bottom,
            left: insets.left,
            right: insets.right,
            height: bottomHeight,
        };
        const isMulti = maxSize > 1;
        const hasPhoto = data.length > 0;
        const buttonName = isVideo ? useVideoLabel : usePhotoLabel;
        return (
            <View style={[styles.bottom, style]}>
                {isMulti && hasPhoto
                    ? _renderPreviewButton()
                    : !isRecording && _renderBottomButton(cancelLabel, _clickCancel)}
                {!isPreview && _renderTakePhotoButton()}
                {isMulti
                    ? hasPhoto && _renderBottomButton(okLabel, _clickOK)
                    : isPreview && _renderBottomButton(buttonName, _clickOK)}
            </View>
        );
    };

    const _renderPreviewButton = () => {
        const text = `${data.length}/${maxSize}`;
        return (
            <TouchableOpacity onPress={_clickPreview} style={styles.previewTouch}>
                <View style={styles.previewView}>
                    <Image
                        style={styles.previewImage}
                        source={{ uri: data[data.length - 1].uri }}
                    />
                    <Text style={styles.previewText}>{text}</Text>
                </View>
            </TouchableOpacity>
        );
    };

    const _renderBottomButton = (text: string, onPress: () => void) => (
        <TouchableOpacity onPress={onPress} style={styles.buttonTouch}>
            <Text style={styles.buttonText}>{text}</Text>
        </TouchableOpacity>
    );

    const _renderTakePhotoButton = () => {
        const icon = isRecording
            ? require('./images/video_recording.png')
            : require('./images/shutter.png');
        return (
            <View style={styles.takeView}>
                <TouchableOpacity onPress={isVideo ? _clickRecordVideo : _clickTakePicture}>
                    <Image style={styles.takeImage} source={icon} />
                </TouchableOpacity>
            </View>
        );
    };

    const _onFinish = (finishData: typeof data) => {
        callback?.(finishData);
    };

    const _onDeletePageFinish = (newData: typeof data) => {
        setData([...newData]);
    };

    const _getImageSize = (path: string): Promise<{ width: number; height: number }> => {
        return new Promise((resolve, reject) => {
            Image.getSize(path, (w, h) => resolve({ width: w, height: h }), reject);
        });
    };

    const _clickTakePicture = async () => {
        if (takingPicture) return;
        if (!cameraRef.current) return;
        try {
            setTakingPicture(true);
            let item = await cameraRef.current.takePhoto({
                flash: currentFlashMode,
                enableShutterSound: false,
            });
            if (Platform.OS === 'ios' && item.path.startsWith('file://')) {
                item.path = item.path.substring(7);
            }
            const prefix = Platform.select({
                ios: '',
                android: 'file://',
                harmony: 'file://',
                default: '',
            })!;
            let itemPath = `${prefix}${item.path}`;

            // 方向说明：拍照原生侧已按设备姿态补偿（实测展开/收起、横握/竖握交付像素
            // 均为直立内容，画幅随握持方向横竖变化），JS 侧不再旋转——orientation
            // 元数据语义随 OS 版本漂移（OS6/OS7 同签名不同内容方向），按它旋转会在
            // 自然方向误转 90°。仅保留交付尺寸封顶（仅 harmony，按文件实测像素宽
            // 计算缩放；Android/iOS 维持原交付尺寸）：超大图全分辨率交付会让预览页
            // 解码显示不完整、上传缓慢。
            let finalWidth = item.width;
            let finalHeight = item.height;
            if (isHarmony) {
                const pixelSize = await _getImageSize(itemPath);
                const deliveryScale = Math.min(1, picWidth / pixelSize.width);
                const targetWidth = Math.round(pixelSize.width * deliveryScale);
                const targetHeight = Math.round(pixelSize.height * deliveryScale);
                if (deliveryScale < 1) {
                    // ohos 版 resizer 对非缓存根目录路径走 fs.copy（实测对相机原始
                    // 路径抛 401 参数无效），先复制到缓存根目录再进 resizer
                    const destPath = `file://${RNFS.CachesDirectoryPath}/${Date.now()}.jpeg`;
                    await RNFS.copyFile(itemPath, destPath);
                    itemPath = destPath;
                }
                const scaledImage = await ImageResizer.createResizedImage(
                    itemPath, targetWidth, targetHeight, 'JPEG', 100, 0,
                );
                // 以 resizer 实际输出尺寸为准（contain 语义下可能与请求值有 ±1px
                // 出入；横拍文件按宽缩放后为横画幅，勿沿用 item 的竖向元数据）
                finalWidth = scaledImage.width;
                finalHeight = scaledImage.height;
                item = { ...item, ...scaledImage, width: finalWidth, height: finalHeight };
                itemPath = Platform.OS === 'ios' ? scaledImage.path : scaledImage.uri;
            }

            // Watermark handling: 画幅基准 = 照片本身（已降采样到交付尺寸）。水印截图
            // （窗口向，锚定框见 wmWidth/wmHeight）按 contain 等比缩放进成片画布后
            // 居中盖章：握持==锁定方向时画幅一致、恰好全幅铺满、位置逐像素对位；
            // 握持≠锁定方向（如锁竖屏横拍、成片横图）时不变形、完整落在图内（文字
            // 方向不强求与成片一致——产品决策），修 70945454「横屏没有水印」。
            if (viewShotRef.current) {
                const watermarkImage = await viewShotRef.current.capture();
                const stampSize = await _getImageSize(`${prefix}${watermarkImage}`);
                // ViewShot 截图写在 ability temp 目录（非缓存根目录），ohos resizer
                // 对这类路径走 fs.copy（实测 401），同样先复制到缓存根目录
                let stampOrigin = `${prefix}${watermarkImage}`;
                if (isHarmony) {
                    const stampCopy = `file://${RNFS.CachesDirectoryPath}/stamp-${Date.now()}.png`;
                    await RNFS.copyFile(stampOrigin, stampCopy);
                    stampOrigin = stampCopy;
                }
                // contain 等比缩放（最长边贴住成片画布），杜绝水印落图外
                const stampScale = Math.min(
                    finalWidth / stampSize.width,
                    finalHeight / stampSize.height,
                );
                const scaledStamp = await ImageResizer.createResizedImage(
                    stampOrigin,
                    Math.round(stampSize.width * stampScale),
                    Math.round(stampSize.height * stampScale),
                    'PNG', 100, 0,
                );
                const stampPath = Platform.OS === 'ios' ? scaledStamp.path : scaledStamp.uri;
                const url = await ImageMarker.markImage({
                    backgroundImage: { src: itemPath },
                    watermarkImages: [{
                        src: stampPath,
                        position: { position: Position.center },
                    }],
                    quality: 100,
                });
                const path = Platform.select({
                    default: url,
                    harmony: url.replace('cn.hecom.cloud.har', ''),
                    android: `file://${url}`,
                })!;
                item = { ...item, path, width: finalWidth, height: finalHeight };
                itemPath = path;
            }

            setTakingPicture(false);
            if (maxSize > 1) {
                if (data.length >= maxSize) {
                    Alert.alert('', maxSizeTakeAlert?.(maxSize) || '');
                } else {
                    setData([...data, { ...item, uri: itemPath }]);
                }
            } else {
                setData([{ ...item, uri: itemPath }]);
                setIsPreview(true);
            }
        } catch (err: any) {
            Sentry.captureMessage('相机拍照异常', { extra: { message: err } });
            Toast.show(err.message || '相机拍照异常');
            setTakingPicture(false);
        }
    };

    const _clickRecordVideo = () => {
        if (!cameraRef.current) return;
        if (isRecording) {
            cameraRef.current.stopRecording();
        } else {
            setIsRecording(true);
            _startRecording();
        }
    };

    const _startRecording = () => {
        cameraRef.current?.startRecording({
            flash: currentFlashMode,
            fileType: 'mp4',
            onRecordingFinished: (item) => {
                if (Platform.OS === 'ios' && item.path.startsWith('file://')) {
                    item.path = item.path.substring(7);
                }
                const prefix = Platform.select({
                    ios: '',
                    android: 'file://',
                    harmony: 'file://',
                    default: '',
                })!;
                setData([{ ...item, uri: `${prefix}${item.path}` }]);
                setIsRecording(false);
                setIsPreview(true);
            },
            onRecordingError: (err) => {
                Sentry.captureMessage('视频录制异常', { extra: { message: err } });
                Toast.show(err.message || '视频录制异常');
                setIsRecording(false);
            },
        });
    };

    const _clickOK = () => _onFinish(data);

    const _clickSwitchSide = () => {
        setCurrentSideType(prev => prev === 'back' ? 'front' : 'back');
    };

    const _clickFlashMode = () => {
        const idx = flashModes.indexOf(currentFlashMode);
        setCurrentFlashMode(flashModes[(idx + 1) % flashModes.length]);
    };

    const _clickPreview = () => {
        navigation?.navigate(PageKeys.preview, {
            ...props,
            images: data,
            callback: _onDeletePageFinish,
        });
    };

    const _clickCancel = () => {
        if (maxSize <= 1 && isPreview) {
            setData([]);
            setIsPreview(false);
        } else {
            _onFinish([]);
        }
    };

    return (
        <View style={styles.container}>
            {!isPreview ? _renderCameraView() : _renderPreviewView()}
            {!isPreview && _renderTopView()}
            {_renderBottomView()}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: 'black',
    },
    top: {
        position: 'absolute',
        height: topHeight,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: 'transparent',
        paddingHorizontal: 5,
    },
    topImage: {
        margin: 10,
        width: 27,
        height: 27,
    },
    bottom: {
        position: 'absolute',
        height: bottomHeight,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: 'transparent',
    },
    watermarkAnchor: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    takeView: {
        position: 'absolute',
        left: 0,
        right: 0,
        justifyContent: 'center',
        alignItems: 'center',
    },
    takeImage: {
        width: 64,
        height: 64,
        margin: 10,
    },
    buttonTouch: {
        marginHorizontal: 5,
    },
    buttonText: {
        margin: 10,
        height: 44,
        lineHeight: 44,
        fontSize: 16,
        color: 'white',
        backgroundColor: 'transparent',
    },
    previewTouch: {
        marginLeft: 15,
    },
    previewView: {
        flexDirection: 'row',
        alignItems: 'center',
        height: bottomHeight,
    },
    previewImage: {
        width: 50,
        height: 50,
    },
    previewText: {
        fontSize: 16,
        marginLeft: 10,
        color: 'white',
        backgroundColor: 'transparent',
    },
});
