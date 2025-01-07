import React, { useState, useEffect, useRef } from 'react';
import { Alert, Dimensions, Image, Platform, StatusBar, SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Camera, useCameraDevice, useCameraFormat, CameraProps, PhotoFile, VideoFile } from 'react-native-vision-camera';
import { getSafeAreaInset } from '@hecom/react-native-pure-navigation-bar';
import ImageResizer from '@bam.tech/react-native-image-resizer';
import ImageMarker, { Position } from 'react-native-image-marker';
import Orientation from 'react-native-orientation-locker';
import RNFS from 'react-native-fs';
import ViewShot from 'react-native-view-shot';
import Video from 'react-native-video';
import PageKeys from '@hecom-rn/react-native-full-image-picker/src/PageKeys';
import * as Sentry from '@sentry/react-native';
import Toast from 'react-native-root-toast';

type Props = {
    maxSize?: number,
    sideType?: 'back' | 'front',
    flashMode?: 'off' | 'on',
    cameraProps?: CameraProps,
    pictureOptions?: { width: number },
    isVideo?: boolean,
    waterView?: () => JSX.Element,
    layerView?: () => JSX.Element,
    cancelLabel?: string,
    okLabel?: string,
    useVideoLabel?: string,
    usePhotoLabel?: string,
    maxSizeTakeAlert?: (maxSize: number) => string,
    navigation?: any,
    callback?: (data: Array<{ uri: string } & Result>) => void,
};

type Result = PhotoFile | VideoFile;

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
    const [data, setData] = useState<Array<{ uri: string } & Result>>([]);
    const [isPreview, setIsPreview] = useState(false);
    const [currentSideType, setCurrentSideType] = useState(sideType);
    const [currentFlashMode, setCurrentFlashMode] = useState(flashMode);
    const [isRecording, setIsRecording] = useState(false);
    const [takePicture, setTakePicture] = useState(false);
    const camera = useRef<Camera>(null);
    const viewShot = useRef<ViewShot>(null);
    const flashModes = ['off', 'on'];
    const [size, setSize] = useState(Dimensions.get('window'));
    const { width, height } = size;
    const { top, bottom } = getSafeAreaInset();
    const ratio = 4 / 3;
    const otherH = isVideo ? bottomHeight : height - top - bottom - ratio * width;
    const bottomH = otherH > bottomHeight ? otherH * 0.75 > bottomHeight ? otherH * 0.75 : otherH : otherH;
    const topH = otherH - bottomH;

    const device = useCameraDevice(currentSideType === 'back' ? 'back' : 'front');

    const format = useCameraFormat(device, [
        { photoAspectRatio: ratio, photoResolution: { width: picWidth, height: picWidth * ratio }, }
    ])

    useEffect(() => {
        Orientation.lockToPortrait();
        return () => {
            Orientation.unlockAllOrientations();
        };
    }, []);

    const _renderTopView = () => {
        const safeArea = getSafeAreaInset();
        const style = {
            top: topHeight > topH ? topH + safeArea.top : safeArea.top,
            left: safeArea.left,
            right: safeArea.right,
        };
        let image;
        switch (currentFlashMode) {
            case 'off':
                image = require('./images/flash_close.png');
                break;
            case 'on':
                image = require('./images/flash_open.png');
                break;
            default:
                image = require('./images/flash_auto.png');
        }
        return (
            <View style={[styles.top, style]}>
                {!isVideo && _renderTopButton(image, _clickFlashMode)}
                {_renderTopButton(require('./images/switch_camera.png'), _clickSwitchSide)}
            </View>
        );
    };

    const _renderTopButton = (image, onPress) => {
        return (
            <TouchableOpacity onPress={onPress}>
                <Image style={styles.topImage} source={image} />
            </TouchableOpacity>
        );
    };

    const _renderBottomView = () => {
        const safeArea = getSafeAreaInset();
        const style = {
            bottom: safeArea.bottom,
            left: safeArea.left,
            right: safeArea.right,
            height: bottomH
        };
        const isMulti = maxSize > 1;
        const hasPhoto = data.length > 0;
        const buttonName = isVideo ? useVideoLabel : usePhotoLabel;
        return (
            <View style={[styles.bottom, style]}>
                {isMulti && hasPhoto ? _renderPreviewButton() : !isRecording && _renderBottomButton(cancelLabel, _clickCancel)}
                {!isPreview && _renderTakePhotoButton()}
                {isMulti ? hasPhoto && _renderBottomButton(okLabel, _clickOK) : isPreview && _renderBottomButton(buttonName, _clickOK)}
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
                    <Text style={styles.previewText}>
                        {text}
                    </Text>
                </View>
            </TouchableOpacity>
        );
    };

    const _renderBottomButton = (text, onPress) => {
        return (
            <TouchableOpacity onPress={onPress} style={styles.buttonTouch}>
                <Text style={styles.buttonText}>
                    {text}
                </Text>
            </TouchableOpacity>
        );
    };

    const _renderTakePhotoButton = () => {
        const safeArea = getSafeAreaInset();
        const left = (width - safeArea.left - safeArea.right - bottomHeight) / 2;
        const icon = isRecording ?
            require('./images/video_recording.png') :
            require('./images/shutter.png');
        return (
            <TouchableOpacity
                onPress={isVideo ? _clickRecordVideo : _clickTakePicture}
                style={[styles.takeView, { left }]}
            >
                <Image style={styles.takeImage} source={icon} />
            </TouchableOpacity>
        );
    };

    const _onFinish = (data) => {
        callback && callback(data);
    };

    const _onDeletePageFinish = (data) => {
        setData([...data]);
    };

    const _getImageSize = (path: string) => {
        return new Promise((resolve, reject) => {
            Image.getSize(path, (width, height) => {
                resolve({ width, height });
            }, (err) => {
                reject(err);
            });
        });
    };

    const _clickTakePicture = async () => {
        if (takePicture) return;
        if (camera?.current) {
            try {
                setTakePicture(true);
                let item = await camera.current.takePhoto({
                    flash: currentFlashMode,
                    enableShutterSound: false,
                });
                if (Platform.OS === 'ios') {
                    if (item.path.startsWith('file://')) {
                        item.path = item.path.substring(7);
                    }
                }
                const prefix = Platform.select({
                    default: "",
                    harmony: "file://",
                });
                let itemPath = `${prefix}${item.path}`;
                if (viewShot.current) {
                    const watermarkImage = await viewShot.current.capture();
                    const { width: imageWidth, height: imageHeight } = await _getImageSize(`${prefix}${watermarkImage}`);

                    const fileCopy = Platform.select({
                        default: () => { },
                        harmony: async () => {
                            const destPath = `file://${RNFS.CachesDirectoryPath}/${new Date().getTime()}.jpeg`;
                            await RNFS.copyFile(itemPath, destPath)
                            itemPath = destPath;
                        },
                    });
                    await fileCopy();

                    const resizedImage = await ImageResizer.createResizedImage(
                        itemPath,
                        imageWidth,
                        imageHeight,
                        'PNG',
                        100,
                    );
                    const url = await ImageMarker.markImage({
                        backgroundImage: { src: resizedImage.uri },
                        watermarkImages: [{ src: watermarkImage, position: { position: Position.center }, alpha: 0.3 }],
                        quality: 100,
                    });
                    const path = Platform.select({
                        default: url,
                        harmony: `file://${url}`,
                        android: `file://${url}`
                    });
                    item = { ...item, path, width, height };
                    itemPath = path;
                }
                setTakePicture(false);
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
            } catch (err) {
                Sentry.captureMessage('相机拍照异常', {
                    extra: {
                        message: err
                    },
                });
                Toast.show(err.message || '相机拍照异常');
                setTakePicture(false);
            }
        }
    };

    const _clickRecordVideo = () => {
        if (camera?.current) {
            if (isRecording) {
                camera.current.stopRecording();
            } else {
                setIsRecording(true);
                _startRecording();
            }
        }
    };

    const _startRecording = () => {
        camera?.current?.startRecording({
            flash: currentFlashMode,
            fileType: 'mp4',
            onRecordingFinished: (item) => {
                if (Platform.OS === 'ios') {
                    if (item.path.startsWith('file://')) {
                        item.path = item.path.substring(7);
                    }
                }
                setData([{ ...item, uri: item.path }]);
                setIsRecording(false);
                setIsPreview(true);
            },
            onRecordingError: (err) => {
                Sentry.captureMessage('视频录制异常', {
                    extra: {
                        message: err
                    },
                });
                Toast.show(err.message || '视频录制异常');
            },
        })
    };

    const _clickOK = () => {
        _onFinish(data);
    };

    const _clickSwitchSide = () => {
        const target = currentSideType === 'back' ? 'front' : 'back';
        setCurrentSideType(target);
    };

    const _clickFlashMode = () => {
        const newMode = (flashModes.indexOf(currentFlashMode) + 1) % flashModes.length;
        setCurrentFlashMode(flashModes[newMode]);
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
        <SafeAreaView onLayout={(e) => setSize({ width: e.nativeEvent.layout.width, height: e.nativeEvent.layout.height })} style={styles.container}>
            <StatusBar hidden={true} />
            {!isPreview ? (
                <View style={{ flex: 1 }}>
                    <View style={{ height: topH }} />
                    <View style={{ flex: 1 }}>
                        {device &&
                            <Camera
                                ref={camera}
                                device={device}
                                format={format}
                                torch={currentFlashMode}
                                isActive={true}
                                video={isVideo}
                                enableZoomGesture={false}
                                photoHdr={true}
                                videoHdr={true}
                                photo={!isVideo}
                                style={{ flex: 1 }}
                                {...cameraProps}
                            />}
                        {waterView && (
                            <ViewShot ref={viewShot} style={styles.viewShort}>
                                {waterView()}
                            </ViewShot>
                        )}
                    </View>
                    <View style={{ height: bottomH }} />
                </View>
            ) : <View style={{ flex: 1, justifyContent: 'center', marginTop: topH, marginBottom: bottomH }}>
                {isVideo ? (
                    <Video
                        source={{ uri: data[0].uri }}
                        style={{ flex: 1 }}
                    />
                ) : (
                    <Image
                        resizeMode='contain'
                        style={{ flex: 1 }}
                        source={{ uri: data[0].uri }}
                    />
                )}
                {layerView && layerView()}
            </View>}
            {!isPreview && _renderTopView()}
            {_renderBottomView()}
        </SafeAreaView>
    );
}

const topHeight = 60;
const bottomHeight = 84;

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: 'black',
        marginTop: Platform.OS === 'ios' ? 0 : StatusBar.currentHeight,
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
    camera: {
        flex: 1,
        justifyContent: 'flex-end',
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
    viewShort: {
        flex: 1, bottom: 0, top: 0, left: 0, right: 0, justifyContent: 'flex-end', position: 'absolute', backgroundColor: 'transparent'
    }
});
