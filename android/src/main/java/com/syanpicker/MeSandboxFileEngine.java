package com.syanpicker;

import android.content.Context;

import com.luck.picture.lib.engine.UriToFileTransformEngine;
import com.luck.picture.lib.interfaces.OnKeyValueResultCallbackListener;
import com.luck.picture.lib.utils.SandboxTransformUtils;

/**
 * Description :
 * Created on 2023/11/2.
 */
public class MeSandboxFileEngine implements UriToFileTransformEngine {

    @Override
    public void onUriToFileAsyncTransform(Context context, String srcPath, String mineType, OnKeyValueResultCallbackListener call) {
        if (call != null) {
            call.onCallback(srcPath, SandboxTransformUtils.copyPathToSandbox(context, srcPath, mineType));
        }
    }
}
