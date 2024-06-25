import React from "react";
import { BackHandler } from "react-native";
import CameraView from './CameraView';


export default class CameraPage extends React.PureComponent {
    static defaultProps = {
        okLabel: 'OK',
        cancelLabel: 'Cancel',
        deleteLabel: 'Delete',
        useVideoLabel: 'Use Video',
        usePhotoLabel: 'Use Photo',
        previewLabel: 'Preview',
        choosePhotoTitle: 'Choose Photo',
        maxSizeChooseAlert: (number) => 'You can only choose ' + number + ' photos at most',
        maxSizeTakeAlert: (number) => 'You can only take ' + number + ' photos at most',
        maxVideoFileSizeAlert: (number) => 'you can only choose video smaller than ' + number + 'MB',
        supportedOrientations: ['portrait', 'landscape'],
    };

    // componentDidMount() {
    //     BackHandler.addEventListener('hardwareBackPress', this._clickBack);
    // }

    // componentWillUnmount() {
    //     BackHandler.removeEventListener('hardwareBackPress', this._clickBack);
    // }

    // _clickBack = () => {
    //     this.props.onDestroy && this.props.onDestroy();
    //     return true;
    // };

    render() {
        return <CameraView {...this.props} />
    }
}