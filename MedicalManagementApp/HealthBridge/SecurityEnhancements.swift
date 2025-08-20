import UIKit
import LocalAuthentication

@objc(SecurityEnhancements)
class SecurityEnhancements: NSObject {
  
  // Prevent screenshots of sensitive screens
  @objc
  static func preventScreenshot() {
    if let window = UIApplication.shared.keyWindow {
      let secureTextField = UITextField()
      secureTextField.isSecureTextEntry = true
      window.layer.superlayer?.addSublayer(secureTextField.layer)
      secureTextField.layer.sublayers?.first?.addSublayer(window.layer)
    }
  }
  
  // Blur app content when backgrounded
  @objc
  static func addPrivacyBlur() {
    NotificationCenter.default.addObserver(
      self,
      selector: #selector(applicationWillResignActive),
      name: UIApplication.willResignActiveNotification,
      object: nil
    )
  }
  
  @objc
  private static func applicationWillResignActive() {
    if let window = UIApplication.shared.keyWindow {
      let blurEffect = UIBlurEffect(style: .light)
      let blurEffectView = UIVisualEffectView(effect: blurEffect)
      blurEffectView.frame = window.bounds
      blurEffectView.tag = 999
      window.addSubview(blurEffectView)
    }
  }
}

