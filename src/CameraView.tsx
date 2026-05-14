import ImageResizer from '@bam.tech/react-native-image-resizer';
import * as Sentry from '@sentry/react-native';
import React, { useEffect, useRef, useState } from 'react';
import { Alert, Dimensions, Image, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import RNFS from 'react-native-fs';
import ImageMarker, { Position } from 'react-native-image-marker';
import Orientation from 'react-native-orientation-locker';
import Toast from 'react-native-root-toast';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Video from 'react-native-video';
import ViewShot from 'react-native-view-shot';
import { Camera, CameraProps, PhotoFile, useCameraDevice, useCameraFormat, VideoFile } from 'react-native-vision-camera';
import PageKeys from './PageKeys';

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
const CAMERA_RATIO = Platform.select({ harmony: 16 / 9, default: 4 / 3 })!;

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
    const [layoutSize, setLayoutSize] = useState(() => {
        const { width, height } = Dimensions.get('window');
        return { width: Math.min(width, height), height: Math.max(width, height) };
    });
    const [isPortraitLayout, setIsPortraitLayout] = useState(() => {
        const { width, height } = Dimensions.get('window');
        return height >= width;
    });

    const { width: layoutWidth, height: layoutHeight } = layoutSize;
    const ratio = CAMERA_RATIO;
    const availableHeight = layoutHeight - insets.top - insets.bottom;

    // Foldable screen support: cap camera width so viewfinder fits
    const maxCameraHeight = Math.max(0, availableHeight - bottomHeight);
    const idealCameraHeight = layoutWidth * ratio;
    const cameraWidth = idealCameraHeight > maxCameraHeight
        ? Math.min(layoutWidth, maxCameraHeight / ratio)
        : layoutWidth;
    const cameraHeight = cameraWidth * ratio;

    const remainingH = Math.max(0, availableHeight - cameraHeight);
    const bottomH = Math.max(remainingH * 0.75, bottomHeight);
    const topH = Math.max(0, remainingH - bottomH);

    const device = useCameraDevice(currentSideType);
    const format = useCameraFormat(device, [
        { photoAspectRatio: ratio, photoResolution: { width: picWidth, height: picWidth * ratio } }
    ]);

    useEffect(() => {
        Orientation.lockToPortrait();
        return () => {
            Orientation.unlockAllOrientations();
        };
    }, []);

    const _onLayout = (e: any) => {
        const { width, height } = e.nativeEvent.layout;
        setIsPortraitLayout(height >= width);
        setLayoutSize({ width: Math.min(width, height), height: Math.max(width, height) });
    };

    const _renderTopView = () => {
        const style = {
            top: topHeight > topH ? topH + insets.top : insets.top,
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

    const _renderCameraView = () => (
        <View style={{ flex: 1 }}>
            <View style={{ height: topH + insets.top }} />
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                <View style={{ width: cameraWidth, height: cameraHeight }}>
                    {device && isPortraitLayout && (
                        <Camera
                            ref={cameraRef}
                            device={device}
                            format={format}
                            torch={isVideo ? currentFlashMode : 'off'}
                            isActive={true}
                            video={isVideo}
                            audio={isVideo}
                            photo={!isVideo}
                            enableZoomGesture={true}
                            outputOrientation="preview"
                            style={StyleSheet.absoluteFill}
                            {...cameraProps}
                        />
                    )}
                    {waterView && isPortraitLayout && (
                        <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: 'transparent' }]}>
                            <ViewShot style={{ flex: 1 }} ref={viewShotRef}>
                                {waterView()}
                            </ViewShot>
                        </View>
                    )}
                </View>
            </View>
            <View style={{ height: bottomH + insets.bottom }} />
        </View>
    );

    const _renderPreviewView = () => (
        <View style={{ flex: 1, justifyContent: 'center', marginTop: topH + insets.top, marginBottom: bottomH + insets.bottom }}>
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

    const _renderBottomView = () => {
        const style = {
            bottom: insets.bottom,
            left: insets.left,
            right: insets.right,
            height: bottomH,
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
        const containerWidth = layoutWidth - insets.left - insets.right;
        const left = (containerWidth - bottomHeight) / 2;
        const icon = isRecording
            ? require('./images/video_recording.png')
            : require('./images/shutter.png');
        return (
            <TouchableOpacity
                onPress={isVideo ? _clickRecordVideo : _clickTakePicture}
                style={[styles.takeView, { left }]}
            >
                <Image style={styles.takeImage} source={icon} />
            </TouchableOpacity>
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

            // Handle landscape photo from sensor (applies to all platforms when device enters from landscape)
            if (item.width > item.height) {
                const rotatedImage = await ImageResizer.createResizedImage(
                    itemPath, item.height, item.width, 'JPEG', 100, 0,
                );
                item = { ...item, ...rotatedImage };
                itemPath =  Platform.OS === 'ios' ? rotatedImage.path : rotatedImage.uri;
            }

            // Watermark handling
            if (viewShotRef.current) {
                const watermarkImage = await viewShotRef.current.capture();
                const { width: imgW, height: imgH } = await _getImageSize(`${prefix}${watermarkImage}`);

                const fileCopy = Platform.select({
                    default: async () => {},
                    harmony: async () => {
                        const destPath = `file://${RNFS.CachesDirectoryPath}/${Date.now()}.jpeg`;
                        await RNFS.copyFile(itemPath, destPath);
                        itemPath = destPath;
                    },
                })!;
                await fileCopy();

                const resizedImage = await ImageResizer.createResizedImage(
                    itemPath, imgW, imgH, 'PNG', 100, 0,
                );
                const url = await ImageMarker.markImage({
                    backgroundImage: { src: resizedImage.uri },
                    watermarkImages: [{ src: watermarkImage, position: { position: Position.center } }],
                    quality: 100,
                });
                const path = Platform.select({
                    default: url,
                    harmony: url.replace('cn.hecom.cloud.har', ''),
                    android: `file://${url}`,
                })!;
                item = { ...item, path, width: imgW, height: imgH };
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
        <View style={styles.container} onLayout={_onLayout}>
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
    takeView: {
        position: 'absolute',
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
