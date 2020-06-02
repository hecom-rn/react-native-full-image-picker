import React from 'react';
import { Modal, BackHandler, InteractionManager, Platform } from 'react-native';
import { createStackNavigator } from '@react-navigation/stack';
import { NavigationContainer } from '@react-navigation/native';
import PageKeys from './PageKeys';
import CameraView from './CameraView';
import AlbumListView from './AlbumListView';
import AlbumView from './AlbumView';
import PreviewMultiView from './PreviewMultiView';

export default class extends React.PureComponent {
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
        supportedOrientations: ['portrait', 'landscape'],
    };

    componentDidMount() {
        BackHandler.addEventListener('hardwareBackPress', this._clickBack);
    }

    componentWillUnmount() {
        BackHandler.removeEventListener('hardwareBackPress', this._clickBack);
    }

    render() {
        const callback = (data) => {
            this.props.callback && this.props.callback(data);
            InteractionManager.runAfterInteractions(() => {
                this.props.onDestroy && this.props.onDestroy();
            });
        };
        const allscenes = {
            [PageKeys.camera]: CameraView,
            [PageKeys.album_list]: AlbumListView,
            [PageKeys.album_view]: AlbumView,
            [PageKeys.preview]: PreviewMultiView,
        };
        const defaultProp = {
            ...this.props,
            callback: callback,
        }
        const withUnwrap = (WrappedComponent) => class extends React.PureComponent {
            render() {
                return (
                    <WrappedComponent
                        {...defaultProp}
                        {...this.props.route.params}
                        navigation={this.props.navigation}
                    />
                );
            }
        }
        const Stack = createStackNavigator();
        const scenes = Object.keys(allscenes)
            .reduce((prv, cur) => {
                prv.push(
                    <Stack.Screen
                        name={cur}
                        component={withUnwrap(allscenes[cur])}
                        options={()=> {
                            return { gesturesEnabled: false }
                        }}
                    />
                );
                return prv;
            }, []);

        const NavigationDoor = (
            <Stack.Navigator
                initialRouteName={this.props.initialRouteName}
                headerMode={'none'}
            >
                {scenes}
            </Stack.Navigator>
        )
        return (
            <Modal
                animationType={'slide'}
                supportedOrientations={this.props.supportedOrientations}
            >
                <NavigationContainer>
                    {NavigationDoor}
                </NavigationContainer>
            </Modal>
        );
    }

    _clickBack = () => {
        this.props.onDestroy && this.props.onDestroy();
        return true;
    };
}