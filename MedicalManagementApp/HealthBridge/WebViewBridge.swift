import Foundation
import WebKit

@objc(WebViewBridge)
class WebViewBridge: RCTEventEmitter {
  
  @objc
  func clearCache(_ resolve: @escaping RCTPromiseResolveBlock,
                  rejecter reject: @escaping RCTPromiseRejectBlock) {
    DispatchQueue.main.async {
      // Clear WebView cache
      WKWebsiteDataStore.default().removeData(
        ofTypes: WKWebsiteDataStore.allWebsiteDataTypes(),
        modifiedSince: Date(timeIntervalSince1970: 0),
        completionHandler: {
          resolve(["success": true])
        }
      )
      
      // Clear URL cache
      URLCache.shared.removeAllCachedResponses()
      
      // Clear cookies
      HTTPCookieStorage.shared.cookies?.forEach { cookie in
        HTTPCookieStorage.shared.deleteCookie(cookie)
      }
    }
  }
  
  @objc
  func getCookies(_ url: String,
                  resolver resolve: @escaping RCTPromiseResolveBlock,
                  rejecter reject: @escaping RCTPromiseRejectBlock) {
    guard let url = URL(string: url) else {
      reject("INVALID_URL", "Invalid URL provided", nil)
      return
    }
    
    DispatchQueue.main.async {
      WKWebsiteDataStore.default().httpCookieStore.getAllCookies { cookies in
        let relevantCookies = cookies.filter { cookie in
          return url.host?.contains(cookie.domain) ?? false
        }
        
        let cookieData = relevantCookies.map { cookie in
          return [
            "name": cookie.name,
            "value": cookie.value,
            "domain": cookie.domain,
            "path": cookie.path,
            "secure": cookie.isSecure,
            "httpOnly": cookie.isHTTPOnly
          ]
        }
        
        resolve(cookieData)
      }
    }
  }
  
  @objc
  func setCookie(_ url: String,
                 name: String,
                 value: String,
                 resolver resolve: @escaping RCTPromiseResolveBlock,
                 rejecter reject: @escaping RCTPromiseRejectBlock) {
    guard let url = URL(string: url) else {
      reject("INVALID_URL", "Invalid URL provided", nil)
      return
    }
    
    DispatchQueue.main.async {
      let cookie = HTTPCookie(properties: [
        .domain: url.host ?? "",
        .path: "/",
        .name: name,
        .value: value,
        .secure: "TRUE",
        .expires: NSDate(timeIntervalSinceNow: 31536000) // 1 year
      ])
      
      if let cookie = cookie {
        WKWebsiteDataStore.default().httpCookieStore.setCookie(cookie) {
          resolve(["success": true])
        }
      } else {
        reject("COOKIE_ERROR", "Failed to create cookie", nil)
      }
    }
  }
  
  @objc
  func handleDeepLink(_ url: String,
                      resolver resolve: @escaping RCTPromiseResolveBlock,
                      rejecter reject: @escaping RCTPromiseRejectBlock) {
    // Parse deep link
    guard let url = URL(string: url) else {
      reject("INVALID_URL", "Invalid deep link", nil)
      return
    }
    
    // Extract path and parameters
    let path = url.path
    let queryItems = URLComponents(url: url, resolvingAgainstBaseURL: false)?.queryItems
    
    var params: [String: String] = [:]
    queryItems?.forEach { item in
      params[item.name] = item.value
    }
    
    // Send event to React Native
    self.sendEvent(withName: "DeepLinkReceived", body: [
      "path": path,
      "params": params
    ])
    
    resolve([
      "handled": true,
      "path": path,
      "params": params
    ])
  }
  
  override func supportedEvents() -> [String]! {
    return ["DeepLinkReceived", "CookieChanged", "CacheCleared"]
  }
  
  override static func requiresMainQueueSetup() -> Bool {
    return true
  }
}