
#if __has_include("RCTBridgeModule.h")
#import "RCTBridgeModule.h"
#else
#import <React/RCTBridgeModule.h>
#endif
#import <UIKit/UIKit.h>
#import "TZImagePickerController.h"
#import <React/RCTEventEmitter.h>
@interface RNSyanImagePicker : RCTEventEmitter <RCTBridgeModule, TZImagePickerControllerDelegate, UINavigationControllerDelegate, UIImagePickerControllerDelegate, UIActionSheetDelegate>

@end

