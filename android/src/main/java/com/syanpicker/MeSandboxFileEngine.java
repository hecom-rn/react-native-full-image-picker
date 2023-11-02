package com.syanpicker;

import android.content.Context;
import android.text.TextUtils;
import com.luck.picture.lib.engine.SandboxFileEngine;
import com.luck.picture.lib.config.PictureMimeType;
import com.luck.picture.lib.entity.LocalMedia;
import com.luck.picture.lib.utils.SandboxTransformUtils;
import com.luck.picture.lib.interfaces.OnCallbackIndexListener;

/**
 * Description :
 * Created on 2023/11/2.
 */
public class MeSandboxFileEngine implements SandboxFileEngine {

   @Override
   public void onStartSandboxFileTransform(Context context, boolean isOriginalImage,
                                           int index, LocalMedia media,
                                           OnCallbackIndexListener<LocalMedia> listener) {
      if (PictureMimeType.isContent(media.getAvailablePath())) {
         String sandboxPath = SandboxTransformUtils.copyPathToSandbox(context, media.getPath(),
                 media.getMimeType());
         media.setSandboxPath(sandboxPath);
      }
      if (isOriginalImage) {
         String originalPath = SandboxTransformUtils.copyPathToSandbox(context, media.getPath(),
                 media.getMimeType());
         media.setOriginalPath(originalPath);
         media.setOriginal(!TextUtils.isEmpty(originalPath));
      }
      listener.onCall(media, index);
   }
}
