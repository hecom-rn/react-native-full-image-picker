
package com.syanpicker;

import android.app.Activity;
import android.content.Intent;
import android.graphics.Bitmap;
import android.media.MediaMetadataRetriever;
import android.text.TextUtils;
import android.util.Base64;

import androidx.core.content.ContextCompat;

import com.facebook.react.bridge.ActivityEventListener;
import com.facebook.react.bridge.BaseActivityEventListener;
import com.facebook.react.bridge.Callback;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.ReadableMap;
import com.facebook.react.bridge.WritableArray;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.bridge.WritableNativeArray;
import com.facebook.react.bridge.WritableNativeMap;
import com.luck.picture.lib.basic.PictureSelector;
import com.luck.picture.lib.config.PictureConfig;
import com.luck.picture.lib.config.PictureMimeType;
import com.luck.picture.lib.config.SelectMimeType;
import com.luck.picture.lib.entity.LocalMedia;
import com.luck.picture.lib.style.BottomNavBarStyle;
import com.luck.picture.lib.style.PictureSelectorStyle;
import com.luck.picture.lib.style.SelectMainStyle;
import com.luck.picture.lib.style.TitleBarStyle;
import com.luck.picture.lib.utils.DensityUtil;
import com.luck.picture.lib.utils.PictureFileUtils;
import com.luck.picture.lib.utils.SdkVersionUtils;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileNotFoundException;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

public class RNSyanImagePickerModule extends ReactContextBaseJavaModule {

    private static String SY_SELECT_IMAGE_FAILED_CODE = "0"; // 失败时，Promise用到的code

    private final ReactApplicationContext reactContext;

    private List<LocalMedia> selectList = new ArrayList<>();

    private Callback mPickerCallback; // 保存回调

    private Promise mPickerPromise; // 保存Promise

    private ReadableMap cameraOptions; // 保存图片选择/相机选项

    private PictureSelectorStyle selectorStyle;

    public RNSyanImagePickerModule(ReactApplicationContext reactContext) {
        super(reactContext);
        this.reactContext = reactContext;
        initSelectorStyle(reactContext);
        reactContext.addActivityEventListener(mActivityEventListener);
    }

    private void initSelectorStyle(ReactApplicationContext context) {
        selectorStyle = new PictureSelectorStyle();
        SelectMainStyle numberSelectMainStyle = new SelectMainStyle();
        numberSelectMainStyle.setSelectNumberStyle(true);
        numberSelectMainStyle.setPreviewDisplaySelectGallery(true);
        numberSelectMainStyle.setSelectBackground(R.drawable.ps_default_num_selector);
        numberSelectMainStyle.setPreviewSelectBackground(R.drawable.ps_preview_checkbox_selector);
        numberSelectMainStyle.setSelectNormalBackgroundResources(R.drawable.ps_select_complete_normal_bg);
        numberSelectMainStyle.setSelectNormalTextColor(ContextCompat.getColor(context, R.color.ps_color_53575e));
        numberSelectMainStyle.setSelectNormalText(context.getString(R.string.ps_send));
        numberSelectMainStyle.setAdapterPreviewGalleryBackgroundResource(R.drawable.ps_preview_gallery_bg);
        numberSelectMainStyle.setAdapterPreviewGalleryItemSize(DensityUtil.dip2px(context, 52));
        numberSelectMainStyle.setPreviewSelectText(context.getString(R.string.ps_select));
        numberSelectMainStyle.setPreviewSelectTextSize(14);
        numberSelectMainStyle.setPreviewSelectTextColor(ContextCompat.getColor(context, R.color.ps_color_white));
        numberSelectMainStyle.setPreviewSelectMarginRight(DensityUtil.dip2px(context, 6));
        numberSelectMainStyle.setSelectBackgroundResources(R.drawable.ps_select_complete_bg);
        numberSelectMainStyle.setSelectText(context.getString(R.string.ps_send_num));
        numberSelectMainStyle.setSelectTextColor(ContextCompat.getColor(context, R.color.ps_color_white));
        numberSelectMainStyle.setMainListBackgroundColor(ContextCompat.getColor(context, R.color.ps_color_black));

        // 头部TitleBar 风格
        TitleBarStyle numberTitleBarStyle = new TitleBarStyle();
//        numberTitleBarStyle.setHideCancelButton(false);
//        numberTitleBarStyle.setAlbumTitleRelativeLeft(true);
//        numberTitleBarStyle.setTitleAlbumBackgroundResource(R.drawable.ps_album_bg);
//        numberTitleBarStyle.setTitleDrawableRightResource(R.drawable.ps_ic_grey_arrow);
        numberTitleBarStyle.setPreviewTitleLeftBackResource(R.drawable.ps_ic_normal_back);

        // 底部NavBar 风格
        BottomNavBarStyle numberBottomNavBarStyle = new BottomNavBarStyle();
        numberBottomNavBarStyle.setBottomPreviewNarBarBackgroundColor(ContextCompat.getColor(context, R.color.ps_color_half_grey));
        numberBottomNavBarStyle.setBottomPreviewNormalText(context.getString(R.string.ps_preview));
        numberBottomNavBarStyle.setBottomPreviewNormalTextColor(ContextCompat.getColor(context, R.color.ps_color_9b));
        numberBottomNavBarStyle.setBottomPreviewNormalTextSize(16);
        numberBottomNavBarStyle.setCompleteCountTips(false);
        numberBottomNavBarStyle.setBottomPreviewSelectText(context.getString(R.string.ps_preview_num));
        numberBottomNavBarStyle.setBottomPreviewSelectTextColor(ContextCompat.getColor(context, R.color.ps_color_white));


        selectorStyle.setTitleBarStyle(numberTitleBarStyle);
        selectorStyle.setBottomBarStyle(numberBottomNavBarStyle);
        selectorStyle.setSelectMainStyle(numberSelectMainStyle);
    }

    @Override
    public String getName() {
        return "RNSyanImagePicker";
    }

    @ReactMethod
    public void showImagePicker(ReadableMap options, Callback callback) {
        this.cameraOptions = options;
        this.mPickerPromise = null;
        this.mPickerCallback = callback;
        this.openImagePicker();
    }

    @ReactMethod
    public void asyncShowImagePicker(ReadableMap options, Promise promise) {
        this.cameraOptions = options;
        this.mPickerCallback = null;
        this.mPickerPromise = promise;
        this.openImagePicker();
    }

    @ReactMethod
    public void openCamera(ReadableMap options, Callback callback) {
        this.cameraOptions = options;
        this.mPickerPromise = null;
        this.mPickerCallback = callback;
        this.openCamera();
    }

    @ReactMethod
    public void asyncOpenCamera(ReadableMap options, Promise promise) {
        this.cameraOptions = options;
        this.mPickerCallback = null;
        this.mPickerPromise = promise;
        this.openCamera();
    }

    /**
     * 缓存清除
     * 包括裁剪和压缩后的缓存，要在上传成功后调用，注意：需要系统sd卡权限
     */
    @ReactMethod
    public void deleteCache() {
        Activity currentActivity = getCurrentActivity();
        PictureFileUtils.deleteAllCacheDirFile(currentActivity);
    }

    /**
     * 移除选中的图片
     * index 要移除的图片下标
     */
    @ReactMethod
    public void removePhotoAtIndex(int index) {
        if (selectList != null && selectList.size() > index) {
            selectList.remove(index);
        }
    }

    /**
     * 移除所有选中的图片
     */
    @ReactMethod
    public void removeAllPhoto() {
        if (selectList != null) {
            //selectList.clear();
            selectList = null;
        }
    }

    @ReactMethod
    public void openVideo(ReadableMap options, Callback callback) {
        this.cameraOptions = options;
        this.mPickerPromise = null;
        this.mPickerCallback = callback;
        this.openVideo();
    }

    @ReactMethod
    public void openVideoPicker(ReadableMap options, Callback callback) {
        this.cameraOptions = options;
        this.mPickerPromise = null;
        this.mPickerCallback = callback;
        this.openVideoPicker();
    }

    /**
     * 打开相册选择
     */
    private void openImagePicker() {
        int imageCount = this.cameraOptions.getInt("imageCount");
        boolean isCamera = this.cameraOptions.getBoolean("isCamera");
        boolean isCrop = this.cameraOptions.getBoolean("isCrop");
        int CropW = this.cameraOptions.getInt("CropW");
        int CropH = this.cameraOptions.getInt("CropH");
        boolean isGif = this.cameraOptions.getBoolean("isGif");
        boolean showCropCircle = this.cameraOptions.getBoolean("showCropCircle");
        boolean showCropFrame = this.cameraOptions.getBoolean("showCropFrame");
        boolean showCropGrid = this.cameraOptions.getBoolean("showCropGrid");
        boolean compress = this.cameraOptions.getBoolean("compress");
        boolean freeStyleCropEnabled = this.cameraOptions.getBoolean("freeStyleCropEnabled");
        boolean rotateEnabled = this.cameraOptions.getBoolean("rotateEnabled");
        boolean scaleEnabled = this.cameraOptions.getBoolean("scaleEnabled");
        int minimumCompressSize = this.cameraOptions.getInt("minimumCompressSize");
        int quality = this.cameraOptions.getInt("quality");
        boolean isWeChatStyle = this.cameraOptions.getBoolean("isWeChatStyle");
        boolean showSelectedIndex = this.cameraOptions.getBoolean("showSelectedIndex");
        boolean compressFocusAlpha = this.cameraOptions.getBoolean("compressFocusAlpha");
        boolean allowPickingVideo = this.cameraOptions.getBoolean("allowPickingVideo");

        int modeValue;
        if (imageCount == 1) {
            modeValue = 1;
        } else {
            modeValue = 2;
        }

        Boolean isAndroidQ = SdkVersionUtils.isQ();

        Activity currentActivity = getCurrentActivity();

        currentActivity.runOnUiThread(new Runnable() {
            @Override
            public void run() {
                PictureSelector.create(currentActivity)
                        .openGallery(allowPickingVideo ? SelectMimeType.ofAll() : SelectMimeType.ofImage())//全部.PictureMimeType.ofAll()、图片.ofImage()、视频.ofVideo()、音频.ofAudio()
                        .setImageEngine(GlideEngine.createGlideEngine())
                        .setCompressEngine( new ImageFileCompressEngine())
                        .setSandboxFileEngine(new MeSandboxFileEngine())
                        .isOriginalControl(true)
                        .setSelectorUIStyle(selectorStyle)
                        .setMaxSelectNum(imageCount)// 最大图片选择数量 int
                        .setMaxVideoSelectNum(allowPickingVideo ? imageCount : 1)
                        .isWithSelectVideoImage(allowPickingVideo)
                        .setMinSelectNum(0)// 最小选择数量 int
                        .setImageSpanCount(4)// 每行显示个数 int
                        .setSelectionMode(modeValue)// 多选 or 单选 PictureConfig.MULTIPLE or PictureConfig.SINGLE
                        .isPreviewImage(true)// 是否可预览图片 true or false
                        .isPreviewVideo(false)// 是否可预览视频 true or false
                        .isPreviewAudio(false) // 是否可播放音频 true or false
                        .isDisplayCamera(isCamera)// 是否显示拍照按钮 true or false
                        .setCameraImageFormat(PictureMimeType.PNG)// 拍照保存图片格式后缀,默认jpeg
                        .setCameraImageFormatForQ(PictureMimeType.PNG_Q)// 拍照保存图片格式后缀,默认jpeg
                        .isPreviewZoomEffect(true)// 图片列表点击 缩放效果 默认true
                        .isGif(isGif)// 是否显示gif图片 true or false
                        .isOpenClickSound(false)// 是否开启点击声音 true or false
                        .isFastSlidingSelect(true)//滑动选择
                        .forResult(PictureConfig.CHOOSE_REQUEST); //结果回调onActivityResult code
            }
        });
    }

    /**
     * 打开相机
     */
    private void openCamera() {
        boolean isCrop = this.cameraOptions.getBoolean("isCrop");
        int CropW = this.cameraOptions.getInt("CropW");
        int CropH = this.cameraOptions.getInt("CropH");
        boolean showCropCircle = this.cameraOptions.getBoolean("showCropCircle");
        boolean showCropFrame = this.cameraOptions.getBoolean("showCropFrame");
        boolean showCropGrid = this.cameraOptions.getBoolean("showCropGrid");
        boolean compress = this.cameraOptions.getBoolean("compress");
        boolean freeStyleCropEnabled = this.cameraOptions.getBoolean("freeStyleCropEnabled");
        boolean rotateEnabled = this.cameraOptions.getBoolean("rotateEnabled");
        boolean scaleEnabled = this.cameraOptions.getBoolean("scaleEnabled");
        int minimumCompressSize = this.cameraOptions.getInt("minimumCompressSize");
        int quality = this.cameraOptions.getInt("quality");
        boolean isWeChatStyle = this.cameraOptions.getBoolean("isWeChatStyle");
        boolean showSelectedIndex = this.cameraOptions.getBoolean("showSelectedIndex");
        boolean compressFocusAlpha = this.cameraOptions.getBoolean("compressFocusAlpha");

        Boolean isAndroidQ = SdkVersionUtils.isQ();

        Activity currentActivity = getCurrentActivity();
        PictureSelector.create(currentActivity)
                .openCamera(SelectMimeType.ofImage())
//                .setCameraInterceptListener(getCustomCameraEvent())
//                .setCropEngine(getCropEngine())
//                .setCompressEngine(getCompressEngine())
//                .setSandboxFileEngine(new MeSandboxFileEngine())
//                .isOriginalControl(cb_original.isChecked())
                .forResultActivity(PictureConfig.CHOOSE_REQUEST);//结果回调onActivityResult code

//        PictureSelector.create(currentActivity)
//                .openCamera(PictureMimeType.ofImage())
//                .loadImageEngine(GlideEngine.createGlideEngine())
//                .imageFormat(isAndroidQ ? PictureMimeType.PNG_Q : PictureMimeType.PNG)// 拍照保存图片格式后缀,默认jpeg
//                .enableCrop(isCrop)// 是否裁剪 true or false
//                .compress(compress)// 是否压缩 true or false
//                .glideOverride(160, 160)// int glide 加载宽高，越小图片列表越流畅，但会影响列表图片浏览的清晰度
//                .withAspectRatio(CropW, CropH)// int 裁剪比例 如16:9 3:2 3:4 1:1 可自定义
//                .hideBottomControls(isCrop)// 是否显示uCrop工具栏，默认不显示 true or false
//                .freeStyleCropEnabled(freeStyleCropEnabled)// 裁剪框是否可拖拽 true or false
//                .circleDimmedLayer(showCropCircle)// 是否圆形裁剪 true or false
//                .showCropFrame(showCropFrame)// 是否显示裁剪矩形边框 圆形裁剪时建议设为false   true or false
//                .showCropGrid(showCropGrid)// 是否显示裁剪矩形网格 圆形裁剪时建议设为false    true or false
//                .openClickSound(false)// 是否开启点击声音 true or false
//                .cropCompressQuality(quality)// 裁剪压缩质量 默认90 int
//                .minimumCompressSize(minimumCompressSize)// 小于100kb的图片不压缩
//                .synOrAsy(true)//同步true或异步false 压缩 默认同步
//                .rotateEnabled(rotateEnabled) // 裁剪是否可旋转图片 true or false
//                .scaleEnabled(scaleEnabled)// 裁剪是否可放大缩小图片 true or false
//                .isWeChatStyle(isWeChatStyle)
//                .theme(showSelectedIndex ? R.style.picture_WeChat_style : 0)
//                .compressFocusAlpha(compressFocusAlpha)
//                .forResult(PictureConfig.CHOOSE_REQUEST);//结果回调onActivityResult code
    }

    /**
     * 拍摄视频
     */
    private void openVideo() {
        int quality = this.cameraOptions.getInt("quality");
        int MaxSecond = this.cameraOptions.getInt("MaxSecond");
        int MinSecond = this.cameraOptions.getInt("MinSecond");
        int recordVideoSecond = this.cameraOptions.getInt("recordVideoSecond");
        int imageCount = this.cameraOptions.getInt("imageCount");
//        Activity currentActivity = getCurrentActivity();
//        PictureSelector.create(currentActivity)
//                .openCamera(PictureMimeType.ofVideo())//全部.PictureMimeType.ofAll()、图片.ofImage()、视频.ofVideo()、音频.ofAudio()
//                .loadImageEngine(GlideEngine.createGlideEngine())
//                .selectionMedia(selectList) // 当前已选中的图片 List
//                .openClickSound(false)// 是否开启点击声音 true or false
//                .maxSelectNum(imageCount)// 最大图片选择数量 int
//                .minSelectNum(0)// 最小选择数量 int
//                .imageSpanCount(4)// 每行显示个数 int
//                .selectionMode(PictureConfig.MULTIPLE)// 多选 or 单选 PictureConfig.MULTIPLE or PictureConfig.SINGLE
//                .previewVideo(true)// 是否可预览视频 true or false
//                .videoQuality(quality)// 视频录制质量 0 or 1 int
//                .videoMaxSecond(MaxSecond)// 显示多少秒以内的视频or音频也可适用 int
//                .videoMinSecond(MinSecond)// 显示多少秒以内的视频or音频也可适用 int
//                .recordVideoSecond(recordVideoSecond)//视频秒数录制 默认60s int
//                .forResult(PictureConfig.REQUEST_CAMERA);//结果回调onActivityResult code
    }

    /**
     * 选择视频
     */
    private void openVideoPicker() {
        int quality = this.cameraOptions.getInt("quality");
        int MaxSecond = this.cameraOptions.getInt("MaxSecond");
        int MinSecond = this.cameraOptions.getInt("MinSecond");
        int recordVideoSecond = this.cameraOptions.getInt("recordVideoSecond");
        int videoCount = this.cameraOptions.getInt("imageCount");
        boolean isCamera = this.cameraOptions.getBoolean("allowTakeVideo");

        Activity currentActivity = getCurrentActivity();
//        PictureSelector.create(currentActivity)
//                .openGallery(PictureMimeType.ofVideo())//全部.PictureMimeType.ofAll()、图片.ofImage()、视频.ofVideo()、音频.ofAudio()
//                .loadImageEngine(GlideEngine.createGlideEngine())
//                .selectionMedia(selectList) // 当前已选中的视频 List
//                .openClickSound(false)// 是否开启点击声音 true or false
//                .isCamera(isCamera)// 是否显示拍照按钮 true or false
//                .maxSelectNum(videoCount)// 最大视频选择数量 int
//                .minSelectNum(1)// 最小选择数量 int
//                .imageSpanCount(4)// 每行显示个数 int
//                .selectionMode(PictureConfig.MULTIPLE)// 多选 or 单选 PictureConfig.MULTIPLE or PictureConfig.SINGLE
//                .previewVideo(true)// 是否可预览视频 true or false
//                .videoQuality(quality)// 视频录制质量 0 or 1 int
//                .videoMaxSecond(MaxSecond)// 显示多少秒以内的视频or音频也可适用 int
//                .videoMinSecond(MinSecond)// 显示多少秒以内的视频or音频也可适用 int
//                .recordVideoSecond(recordVideoSecond)//视频秒数录制 默认60s int
//                .forResult(PictureConfig.REQUEST_CAMERA);//结果回调onActivityResult code
    }

    private final ActivityEventListener mActivityEventListener = new BaseActivityEventListener() {
        @Override
        public void onActivityResult(Activity activity, int requestCode, int resultCode, final Intent data) {
            if (resultCode == -1) {
                if (requestCode == PictureConfig.CHOOSE_REQUEST) {
//                     new Thread(new Runnable() {
//                         @Override
//                         public void run() {
                            onGetResult(data);
//                         }
//                     }).run();
                } else if (requestCode == PictureConfig.REQUEST_CAMERA) {
                    onGetVideoResult(data);
                }
            } else {
                invokeError(resultCode);
            }

        }
    };

    private void onGetVideoResult(Intent data) {
        List<LocalMedia> mVideoSelectList = PictureSelector.obtainSelectorList(data);
        if (cameraOptions != null) {
            boolean isRecordSelected = cameraOptions.getBoolean("isRecordSelected");
            if (!mVideoSelectList.isEmpty() && isRecordSelected) {
                selectList = mVideoSelectList;
            }
            WritableArray videoList = new WritableNativeArray();

            for (LocalMedia media : mVideoSelectList) {
                if (TextUtils.isEmpty(media.getPath())) {
                    continue;
                }

                WritableMap videoMap = new WritableNativeMap();

                String filePath = SdkVersionUtils.isQ() ? media.getPath() : media.getRealPath();

                videoMap.putString("uri", "file://" + filePath);
                videoMap.putString("coverUri", "file://" + this.getVideoCover(filePath));
                videoMap.putString("fileName", new File(media.getPath()).getName());
                videoMap.putDouble("size", new File(media.getPath()).length());
                videoMap.putDouble("duration", media.getDuration() / 1000.00);
                videoMap.putInt("width", media.getWidth());
                videoMap.putInt("height", media.getHeight());
                videoMap.putString("type", "video");
                videoMap.putString("mime", media.getMimeType());
                videoList.pushMap(videoMap);
            }

            invokeSuccessWithResult(videoList);
        }
    }

    private void onGetResult(Intent data) {
        List<LocalMedia> tmpSelectList = PictureSelector.obtainSelectorList(data);
        if (cameraOptions != null) {
            boolean isRecordSelected = cameraOptions.getBoolean("isRecordSelected");
            if (!tmpSelectList.isEmpty() && isRecordSelected) {
                selectList = tmpSelectList;
            }

            WritableArray mediaList = new WritableNativeArray();
            boolean enableBase64 = cameraOptions.getBoolean("enableBase64");

            for (LocalMedia media : tmpSelectList) {
                String mimeType = media.getMimeType();
                if(PictureMimeType.isHasImage(mimeType)){
                    mediaList.pushMap(getImageResult(media, enableBase64));
                }else if(PictureMimeType.isHasVideo(mimeType)) {
                    mediaList.pushMap(getVideoResult(media, enableBase64));
                }
            }
            invokeSuccessWithResult(mediaList);
        }
    }

    private WritableMap getImageResult(LocalMedia media, Boolean enableBase64) {
        WritableMap imageMap = new WritableNativeMap();
//         String originalPath = media.getOriginalPath();
//         String compressPath = media.getCompressPath();
        int width = media.getWidth();
        int height = media.getHeight();
//        compressPath = media.getCompressPath();
//         String path = TextUtils.isEmpty(originalPath)?compressPath:originalPath;
        String path = media.getAvailablePath();

//        if (width <= 0 && height <= 0) {
//            BitmapFactory.Options options = new BitmapFactory.Options();
//            options.inJustDecodeBounds = true;
//            BitmapFactory.decodeFile(media.getOriginalPath(), options);
//        }
        imageMap.putDouble("width", width);
        imageMap.putDouble("height", height);
        imageMap.putString("type", "image");
        imageMap.putString("uri", "file://" +path);
        imageMap.putString("path", "file://" +path);
        imageMap.putString("name", media.getFileName());
//         imageMap.putString("compressPath", "file://" +compressPath);
//         imageMap.putString("original_uri", "file://" + path);
        imageMap.putInt("size", (int) new File(path).length());

        if (enableBase64) {
            String encodeString = getBase64StringFromFile(path);
            imageMap.putString("base64", encodeString);
        }

        return imageMap;
    }

    private WritableMap getVideoResult(LocalMedia media, Boolean enableBase64) {
        WritableMap imageMap = new WritableNativeMap();
        int width = media.getWidth();
        int height = media.getHeight();
        String path =  media.getRealPath();

        imageMap.putDouble("width", width);
        imageMap.putDouble("height", height);
        imageMap.putString("type", media.getMimeType());
        imageMap.putString("uri", "file://" +path);
        imageMap.putString("path", "file://" +path);
        imageMap.putString("original_uri", "file://" + path);
        imageMap.putInt("size", (int) new File(path).length());
        imageMap.putString("name", media.getFileName());
        if (enableBase64) {
            String encodeString = getBase64StringFromFile(path);
            imageMap.putString("base64", encodeString);
        }

        return imageMap;
    }
    /**
     * 获取图片base64编码字符串
     *
     * @param absoluteFilePath 文件路径
     * @return base64字符串
     */
    private String getBase64StringFromFile(String absoluteFilePath) {
        InputStream inputStream;
        try {
            inputStream = new FileInputStream(new File(absoluteFilePath));
        } catch (FileNotFoundException e) {
            e.printStackTrace();
            return null;
        }

        byte[] bytes;
        byte[] buffer = new byte[8192];
        int bytesRead;
        ByteArrayOutputStream output = new ByteArrayOutputStream();
        try {
            while ((bytesRead = inputStream.read(buffer)) != -1) {
                output.write(buffer, 0, bytesRead);
            }
        } catch (IOException e) {
            e.printStackTrace();
        }
        bytes = output.toByteArray();
        if (absoluteFilePath.toLowerCase().endsWith("png")) {
            return "data:image/png;base64," + Base64.encodeToString(bytes, Base64.NO_WRAP);
        }
        return "data:image/jpeg;base64," + Base64.encodeToString(bytes, Base64.NO_WRAP);
    }


    /**
     * 获取视频封面图片
     *
     * @param videoPath 视频地址
     */
    private String getVideoCover(String videoPath) {
        try {
            MediaMetadataRetriever retriever = new MediaMetadataRetriever();
            retriever.setDataSource(videoPath);
            Bitmap bitmap = retriever.getFrameAtTime();
            FileOutputStream outStream = null;
            final String uuid = "thumb-" + UUID.randomUUID().toString();
            final String localThumb = reactContext.getExternalCacheDir().getAbsolutePath() + "/" + uuid + ".jpg";
            outStream = new FileOutputStream(new File(localThumb));
            bitmap.compress(Bitmap.CompressFormat.JPEG, 30, outStream);
            outStream.close();
            retriever.release();

            return localThumb;
        } catch (FileNotFoundException e) {
            e.printStackTrace();
        } catch (IOException e) {
            e.printStackTrace();
        } catch (Exception err) {
            err.printStackTrace();
        }

        return null;
    }

    /**
     * 选择照片成功时触发
     *
     * @param imageList 图片数组
     */
    private void invokeSuccessWithResult(WritableArray imageList) {
        if (this.mPickerCallback != null) {
            this.mPickerCallback.invoke(null, imageList);
            this.mPickerCallback = null;
        } else if (this.mPickerPromise != null) {
            this.mPickerPromise.resolve(imageList);
        }
    }

    /**
     * 取消选择时触发
     */
    private void invokeError(int resultCode) {
        String message = "取消";
        if (resultCode != 0) {
            message = String.valueOf(resultCode);
        }
        if (this.mPickerCallback != null) {
            this.mPickerCallback.invoke(message);
            this.mPickerCallback = null;
        } else if (this.mPickerPromise != null) {
            this.mPickerPromise.reject(SY_SELECT_IMAGE_FAILED_CODE, message);
        }
    }
}
