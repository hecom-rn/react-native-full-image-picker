import React from 'react';
import { Alert, Dimensions, Image, Platform, StatusBar, SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { RNCamera } from 'react-native-camera';
import { getSafeAreaInset } from '@hecom/react-native-pure-navigation-bar';
import ImageResizer from 'react-native-image-resizer';
import ImageMarker, { Position } from 'react-native-image-marker';
import Orientation from 'react-native-orientation-locker';
import ViewShot from 'react-native-view-shot';
import Video from 'react-native-video';
import PageKeys from './PageKeys';
import * as Sentry from '@sentry/react-native';
import Toast from 'react-native-root-toast';

export default class extends React.PureComponent {
    static defaultProps = {
        maxSize: 1,
        sideType: RNCamera.Constants.Type.back,
        flashMode: 0,
        videoQuality: RNCamera.Constants.VideoQuality["480p"],
        pictureOptions: {},
        recordingOptions: {},
    };

    constructor(props) {
        super(props);
        this.flashModes = [
            RNCamera.Constants.FlashMode.auto,
            RNCamera.Constants.FlashMode.off,
            RNCamera.Constants.FlashMode.on,
        ];
        this.state = {
            data: [],
            isPreview: false,
            sideType: this.props.sideType,
            flashMode: this.props.flashMode,
            isRecording: false,
        };
        this.takePictureing = false;
        const ratio = 4 / 3;
        const { width, height } = Dimensions.get('window');
        const { top, bottom } = getSafeAreaInset();
        let otherH = this.props.isVideo ? bottomHeight : height - top - bottom - ratio * width;
        this.bottomH =  otherH > bottomHeight ? otherH * 0.75 > bottomHeight ? otherH * 0.75 : otherH : otherH;
        this.topH = otherH - this.bottomH;
    }

    componentDidMount() {
        Orientation.lockToPortrait();
    }

    componentWillUnmount() {
        Orientation.unlockAllOrientations();
    }

    render() {
        return (
            <SafeAreaView style={styles.container}>
                <StatusBar hidden={true} />
                {!this.state.isPreview ? this._renderCameraView() : this._renderPreviewView()}
                {!this.state.isPreview && this._renderTopView()}
                {this._renderBottomView()}
            </SafeAreaView>
        );
    }

    _renderTopView = () => {
        const safeArea = getSafeAreaInset();
        const style = {
            top: topHeight > this.topH ? this.topH + safeArea.top : safeArea.top,
            left: safeArea.left,
            right: safeArea.right,
        };
        const { flashMode } = this.state;
        let image;
        switch (flashMode) {
            case 1:
                image = require('./images/flash_close.png');
                break;
            case 2:
                image = require('./images/flash_open.png');
                break;
            default:
                image = require('./images/flash_auto.png');
        }
        return (
            <View style={[styles.top, style]}>
                {!this.props.isVideo && this._renderTopButton(image, this._clickFlashMode)}
                {this._renderTopButton(require('./images/switch_camera.png'), this._clickSwitchSide)}
            </View>
        );
    };

    _renderTopButton = (image, onPress) => {
        return (
            <TouchableOpacity onPress={onPress}>
                <Image style={styles.topImage} source={image} />
            </TouchableOpacity>
        );
    };

    _renderCameraView = () => {
        return (
            <View style={{ flex: 1 }}>
                <View style={{ height: this.topH }} />
                <RNCamera
                    ref={cam => this.camera = cam}
                    type={this.state.sideType}
                    defaultVideoQuality={this.props.videoQuality}
                    flashMode={this.flashModes[this.state.flashMode]}
                    style={styles.camera}
                    captureAudio={this.props.isVideo}
                    fixOrientation={true}
                >
                    {this.props.waterView && (
                        <ViewShot ref={ref => this.viewShot = ref} style={{ flex: 1, backgroundColor: 'transparent', marginBottom: -2 }}>
                            {this.props.waterView?.()}
                        </ViewShot>
                    )}
                </RNCamera>
                <View style={{ height: this.bottomH }} />
            </View>
        );
    };

    _renderPreviewView = () => {
        return (
            <View style={{flex: 1, justifyContent: 'center', marginTop: this.topH, marginBottom: this.bottomH}}>
                {this.props.isVideo ? (
                    <Video
                        source={{ uri: this.state.data[0].uri }}
                        ref={(ref) => this.player = ref}
                        style={{flex: 1}}
                    />
                ) : (
                        <Image
                            resizeMode='contain'
                            style={{flex: 1}}
                            source={{ uri: this.state.data[0].uri }}
                        />
                )}
                {this.props.layerView && this.props.layerView()}
            </View>
        );
    };

    _renderBottomView = () => {
        const safeArea = getSafeAreaInset();
        const style = {
            bottom: safeArea.bottom,
            left: safeArea.left,
            right: safeArea.right,
            height: this.bottomH
        };
        const isMulti = this.props.maxSize > 1;
        const hasPhoto = this.state.data.length > 0;
        const inPreview = this.state.isPreview;
        const isRecording = this.state.isRecording;
        const buttonName = this.props.isVideo ? this.props.useVideoLabel : this.props.usePhotoLabel;
        return (
            <View style={[styles.bottom, style]}>
                {isMulti && hasPhoto ? this._renderPreviewButton() : !isRecording && this._renderBottomButton(this.props.cancelLabel, this._clickCancel)}
                {!inPreview && this._renderTakePhotoButton()}
                {isMulti ? hasPhoto && this._renderBottomButton(this.props.okLabel, this._clickOK) : inPreview && this._renderBottomButton(buttonName, this._clickOK)}
            </View>
        );
    };

    _renderPreviewButton = () => {
        const text = '' + this.state.data.length + '/' + this.props.maxSize;
        return (
            <TouchableOpacity onPress={this._clickPreview} style={styles.previewTouch}>
                <View style={styles.previewView}>
                    <Image
                        style={styles.previewImage}
                        source={{ uri: this.state.data[this.state.data.length - 1].uri }}
                    />
                    <Text style={styles.previewText}>
                        {text}
                    </Text>
                </View>
            </TouchableOpacity>
        );
    };

    _renderBottomButton = (text, onPress) => {
        return (
            <TouchableOpacity onPress={onPress} style={styles.buttonTouch}>
                <Text style={styles.buttonText}>
                    {text}
                </Text>
            </TouchableOpacity>
        );
    };

    _renderTakePhotoButton = () => {
        const safeArea = getSafeAreaInset();
        const left = (Dimensions.get('window').width - safeArea.left - safeArea.right - bottomHeight) / 2;
        const icon = this.state.isRecording ?
            require('./images/video_recording.png') :
            require('./images/shutter.png');
        return (
            <TouchableOpacity
                onPress={this.props.isVideo ? this._clickRecordVideo : this._clickTakePicture}
                style={[styles.takeView, { left }]}
            >
                <Image style={styles.takeImage} source={icon} />
            </TouchableOpacity>
        );
    };

    _onFinish = (data) => {
        this.props.callback && this.props.callback(data);
    };

    _onDeletePageFinish = (data) => {
        this.setState({
            data: [...data],
        });
    };

    _getImageSize = (path) => {
        return new Promise((resolve, reject) => {
            Image.getSize(path, (width, height) => resolve({ width, height }), () => reject());
        });
    }

    _clickTakePicture = async () => {
        if(this.takePictureing) return;
        if (this.camera) {
            try {
                this.takePictureing = true;
                let item = await this.camera.takePictureAsync({
                    mirrorImage: this.state.sideType === RNCamera.Constants.Type.front,
                    fixOrientation: true,
                    forceUpOrientation: true,
                    ...this.props.pictureOptions
                });
                if (Platform.OS === 'ios') {
                    if (item.uri.startsWith('file://')) {
                        item.uri = item.uri.substring(7);
                    }
                }
                if (this.viewShot) {
                    const watermarkImage = await this.viewShot.capture();
                    const { width, height } = await this._getImageSize(watermarkImage);
                    const resizedImage = await ImageResizer.createResizedImage(
                        item.uri,
                        width,
                        height,
                        'PNG',
                        100,
                    )
                    const url = await ImageMarker.markImage({
                        src: {uri: resizedImage.uri},
                        markerSrc: { uri: watermarkImage },
                        position: Position.center,
                        scale: 1,
                        quality: 100,
                        markerScale: 1,
                    })
                    item = {
                        ...item,
                        uri: (Platform.OS === "android" ? "file://" : "") + url,
                        width,
                        height,
                    };
                }
                this.takePictureing = false;
                if (this.props.maxSize > 1) {
                    if (this.state.data.length >= this.props.maxSize) {
                        Alert.alert('', this.props.maxSizeTakeAlert(this.props.maxSize));
                    } else {
                        this.setState({
                            data: [...this.state.data, item],
                        });
                    }
                } else {
                    this.setState({
                        data: [item],
                        isPreview: true,
                    });
                }
            } catch (err) {
                Sentry.captureMessage('相机拍照异常', {
                    extra: {
                        message: err
                    },
                });
                Toast.show(err.message || '相机拍照异常');
                
                this.takePictureing = false;
                this.camera.pausePreview();
                this.camera.resumePreview();
            }
        }
    };

    _clickRecordVideo = () => {
        if (this.camera) {
            if (this.state.isRecording) {
                this.camera.stopRecording();
            } else {
                this.setState({
                    isRecording: true,
                }, this._startRecording);
            }
        }
    };

    _startRecording = () => {
        this.camera.recordAsync(this.props.recordingOptions)
            .then((item) => {
                if (Platform.OS === 'ios') {
                    if (item.uri.startsWith('file://')) {
                        item.uri = item.uri.substring(7);
                    }
                }
                this.setState({
                    data: [item],
                    isRecording: false,
                    isPreview: true,
                });
            });
    };

    _clickOK = () => {
        this._onFinish(this.state.data);
    };

    _clickSwitchSide = () => {
        const target = this.state.sideType === RNCamera.Constants.Type.back
            ? RNCamera.Constants.Type.front : RNCamera.Constants.Type.back;
        this.setState({ sideType: target });
    };

    _clickFlashMode = () => {
        const newMode = (this.state.flashMode + 1) % this.flashModes.length;
        this.setState({ flashMode: newMode });
    };

    _clickPreview = () => {
        this.props.navigation.navigate(PageKeys.preview, {
            ...this.props,
            images: this.state.data,
            callback: this._onDeletePageFinish,
        });
    };

    _clickCancel = () => {
        if (this.props.maxSize <= 1 && this.state.isPreview) {
            this.setState({
                data: [],
                isPreview: false,
            });
        } else {
            this._onFinish([]);
        }
    };
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
});
