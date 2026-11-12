import NaviBar from '@hecom/react-native-pure-navigation-bar';
import { withSafeAreaInsets } from 'react-native-safe-area-context';
import React from 'react';
import { Dimensions, Image, ScrollView, StatusBar, StyleSheet, View } from 'react-native';

class PreviewMultiView extends React.PureComponent {
    constructor(props) {
        super(props);
        this.state = {
            images: this.props.images,
            index: 0,
            // 图片容器尺寸用 ScrollView 实测值（onLayout），不用「窗口 − 导航条/安全区」
            // 推算：横屏下推算值偏大时元素整体高出可视区，图片底部被裁在可视区外
            //（实测三折叠/Pura 横看横图底部缺一截；竖屏因 contain 上下留黑边而未暴露）
            contentWidth: 0,
            contentHeight: 0,
        };
    }

    componentDidMount() {
        this.changeEmitter = Dimensions.addEventListener('change', this._onWindowChanged);
    }

    componentWillUnmount() {
        this.changeEmitter?.remove();
    }

    render() {
        const title = '' + (this.state.index + 1) + '/' + this.state.images.length;
        const safeArea = this.props.insets;
        const style = {
            paddingLeft: safeArea.left,
            paddingRight: safeArea.right,
            paddingBottom: safeArea.bottom,
            backgroundColor: 'black',
        };
        return (
            <View style={styles.view}>
                <StatusBar hidden={false} />
                <NaviBar
                    title={title}
                    onLeft={() => this._clickLeft(this.state.images)}
                    rightElement={this.props.deleteLabel}
                    onRight={this._clickDelete}
                />
                <ScrollView
                    style={[styles.scrollView, style]}
                    automaticallyAdjustContentInsets={false}
                    pagingEnabled={true}
                    horizontal={true}
                    showsHorizontalScrollIndicator={false}
                    onScroll={this._onScroll}
                    onLayout={this._onScrollViewLayout}
                >
                    {this.state.images.map(this._renderItem)}
                </ScrollView>
            </View>
        );
    }

    _renderItem = ({uri: path}, index) => {
        const safeArea = this.props.insets;
        // 容器可视区 = ScrollView 实测尺寸减去其自身 padding（left/right/bottom），
        // 不再推算导航条高度——图片 contain 等比缩放、完整可见（留黑边不裁剪）
        const width = this.state.contentWidth - safeArea.left - safeArea.right;
        const height = this.state.contentHeight - safeArea.bottom;
        if (width <= 0 || height <= 0) {
            return <View key={index} />;
        }
        return (
            <View key={index} style={{width, height}}>
                <Image
                    resizeMode='contain'
                    style={{width, height}}
                    source={{uri: path}}
                />
            </View>
        );
    };

    _onScrollViewLayout = (e) => {
        const {width, height} = e.nativeEvent.layout;
        if (width !== this.state.contentWidth || height !== this.state.contentHeight) {
            this.setState({contentWidth: width, contentHeight: height});
        }
    };

    _onScroll = ({nativeEvent: {contentOffset: {x}}}) => {
        const safeArea = this.props.insets;
        const width = this.state.contentWidth - safeArea.left - safeArea.right;
        if (width <= 0) {
            return;
        }
        const index = Math.round(x / width);
        if (index < 0 || index >= this.state.images.length) {
            return;
        }
        if (index !== this.state.index) {
            this.setState({index});
        }
    };

    _clickLeft = (images) => {
        this.props.callback && this.props.callback(images);
    };

    _clickDelete = () => {
        const newImages = [...this.state.images];
        newImages.splice(this.state.index, 1);
        if (newImages.length > 0) {
            const newIndex = this.state.index >= newImages.length ? newImages.length - 1 : this.state.index;
            this.setState({
                images: newImages,
                index: newIndex,
            });
        } else {
            this._clickLeft([]);
            this.props.navigation.goBack();
        }
    };

    _onWindowChanged = () => {
        this.forceUpdate();
    };
}

const styles = StyleSheet.create({
    view: {
        flex: 1,
    },
    safeView: {
        flex: 1,
        backgroundColor: 'black',
    },
    scrollView: {
        flex: 1,
        flexDirection: 'row',
    },
});

export default withSafeAreaInsets(PreviewMultiView);
