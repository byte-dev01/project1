#import <React/RCTBridgeModule.h>
#import <React/RCTEventEmitter.h>
#import <UIKit/UIKit.h>
#import <LocalAuthentication/LocalAuthentication.h>

@interface PHIProtection : RCTEventEmitter <RCTBridgeModule>
@end

@implementation PHIProtection

RCT_EXPORT_MODULE();

- (NSArray<NSString *> *)supportedEvents {
  return @[@"ScreenRecordingDetected", @"UserDidTakeScreenshot"];
}

RCT_EXPORT_METHOD(setScreenshotBlocking:(BOOL)enabled) {
  dispatch_async(dispatch_get_main_queue(), ^{
    if (enabled) {
      // Create secure text field to prevent screenshots
      UITextField *secureField = [[UITextField alloc] init];
      secureField.secureTextEntry = YES;
      secureField.userInteractionEnabled = NO;
      [[UIApplication sharedApplication].keyWindow addSubview:secureField];
      [[UIApplication sharedApplication].keyWindow.layer addSublayer:secureField.layer];
      [secureField.layer.sublayers.firstObject addToSuperlayer:[UIApplication sharedApplication].keyWindow.layer];
    }
  });
}

RCT_EXPORT_METHOD(setAppSwitcherBlurring:(BOOL)enabled) {
  dispatch_async(dispatch_get_main_queue(), ^{
    if (enabled) {
      // Add blur effect when app enters background
      [[NSNotificationCenter defaultCenter] addObserverForName:UIApplicationWillResignActiveNotification
                                                        object:nil
                                                         queue:[NSOperationQueue mainQueue]
                                                    usingBlock:^(NSNotification *note) {
        UIVisualEffectView *blurView = [[UIVisualEffectView alloc] initWithEffect:[UIBlurEffect effectWithStyle:UIBlurEffectStyleLight]];
        blurView.frame = [UIApplication sharedApplication].keyWindow.bounds;
        blurView.tag = 999;
        [[UIApplication sharedApplication].keyWindow addSubview:blurView];
      }];
      
      [[NSNotificationCenter defaultCenter] addObserverForName:UIApplicationDidBecomeActiveNotification
                                                        object:nil
                                                         queue:[NSOperationQueue mainQueue]
                                                    usingBlock:^(NSNotification *note) {
        UIView *blurView = [[UIApplication sharedApplication].keyWindow viewWithTag:999];
        [blurView removeFromSuperview];
      }];
    }
  });
}

RCT_EXPORT_METHOD(setScreenRecordingDetection:(BOOL)enabled) {
  if (enabled) {
    // Monitor screen recording
    [[NSNotificationCenter defaultCenter] addObserverForName:UIScreenCapturedDidChangeNotification
                                                      object:nil
                                                       queue:[NSOperationQueue mainQueue]
                                                  usingBlock:^(NSNotification *note) {
      if ([UIScreen mainScreen].isCaptured) {
        [self sendEventWithName:@"ScreenRecordingDetected" body:@{@"recording": @YES}];
      }
    }];
  }
}

RCT_EXPORT_METHOD(showPrivacyScreen:(BOOL)show) {
  dispatch_async(dispatch_get_main_queue(), ^{
    UIView *privacyView = [[UIApplication sharedApplication].keyWindow viewWithTag:888];
    
    if (show && !privacyView) {
      privacyView = [[UIView alloc] initWithFrame:[UIApplication sharedApplication].keyWindow.bounds];
      privacyView.backgroundColor = [UIColor systemBackgroundColor];
      privacyView.tag = 888;
      
      UILabel *label = [[UILabel alloc] init];
      label.text = @"HealthBridge";
      label.font = [UIFont systemFontOfSize:24 weight:UIFontWeightBold];
      label.textAlignment = NSTextAlignmentCenter;
      label.translatesAutoresizingMaskIntoConstraints = NO;
      [privacyView addSubview:label];
      
      [NSLayoutConstraint activateConstraints:@[
        [label.centerXAnchor constraintEqualToAnchor:privacyView.centerXAnchor],
        [label.centerYAnchor constraintEqualToAnchor:privacyView.centerYAnchor]
      ]];
      
      [[UIApplication sharedApplication].keyWindow addSubview:privacyView];
    } else if (!show && privacyView) {
      [privacyView removeFromSuperview];
    }
  });
}

RCT_EXPORT_METHOD(minimizeApp) {
  dispatch_async(dispatch_get_main_queue(), ^{
    [[UIApplication sharedApplication] performSelector:@selector(suspend)];
  });
}

@end