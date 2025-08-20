// ios/HealthBridge/SecurityModule.swift

import Foundation
import UIKit
import Security
import CryptoKit
import LocalAuthentication
import React

@objc(SecurityModule)
class SecurityModule: RCTEventEmitter {
    
    // MARK: - Properties
    private var isJailbroken = false
    private var screenshotObserver: NSObjectProtocol?
    private var recordingObserver: NSObjectProtocol?
    private var backgroundObserver: NSObjectProtocol?
    private var blurView: UIVisualEffectView?
    
    // MARK: - Initialization
    override init() {
        super.init()
        performSecurityChecks()
        setupSecurityMonitoring()
    }
    
    override static func requiresMainQueueSetup() -> Bool {
        return true
    }
    
    override func supportedEvents() -> [String]! {
        return ["SecurityAlert", "BiometricResult", "PHIAccess"]
    }
    
    // MARK: - Jailbreak Detection (Pragmatic)
    @objc func checkJailbreak(_ callback: @escaping RCTResponseSenderBlock) {
        // Quick jailbreak check - don't overdo it
        let suspiciousPaths = [
            "/Applications/Cydia.app",
            "/Library/MobileSubstrate/MobileSubstrate.dylib",
            "/bin/bash",
            "/usr/sbin/sshd"
        ]
        
        for path in suspiciousPaths {
            if FileManager.default.fileExists(atPath: path) {
                isJailbroken = true
                callback([["jailbroken": true, "reason": "Suspicious files detected"]])
                return
            }
        }
        
        // Check if we can write outside sandbox
        let testString = "test"
        do {
            try testString.write(toFile: "/private/test.txt", atomically: true, encoding: .utf8)
            isJailbroken = true
            callback([["jailbroken": true, "reason": "Sandbox violation"]])
        } catch {
            callback([["jailbroken": false]])
        }
    }
    
    // MARK: - Biometric Authentication
    @objc func authenticateWithBiometrics(
        _ reason: String,
        callback: @escaping RCTResponseSenderBlock
    ) {
        let context = LAContext()
        var error: NSError?
        
        // Check if biometric authentication is available
        guard context.canEvaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, error: &error) else {
            callback([["success": false, "error": error?.localizedDescription ?? "Biometrics not available"]])
            return
        }
        
        // Perform authentication
        context.evaluatePolicy(
            .deviceOwnerAuthenticationWithBiometrics,
            localizedReason: reason
        ) { success, error in
            DispatchQueue.main.async {
                if success {
                    // Log successful authentication
                    self.logSecurityEvent(type: "BIOMETRIC_SUCCESS")
                    callback([["success": true]])
                } else {
                    // Log failed authentication
                    self.logSecurityEvent(type: "BIOMETRIC_FAILED")
                    callback([["success": false, "error": error?.localizedDescription ?? "Authentication failed"]])
                }
            }
        }
    }
    
    // MARK: - PHI Protection
    @objc func enablePHIProtection() {
        DispatchQueue.main.async {
            self.setupScreenshotPrevention()
            self.setupScreenRecordingDetection()
            self.setupBackgroundBlurring()
        }
    }
    
    private func setupScreenshotPrevention() {
        // Monitor for screenshots
        screenshotObserver = NotificationCenter.default.addObserver(
            forName: UIApplication.userDidTakeScreenshotNotification,
            object: nil,
            queue: .main
        ) { _ in
            self.handleScreenshot()
        }
    }
    
    private func setupScreenRecordingDetection() {
        // Monitor for screen recording
        recordingObserver = NotificationCenter.default.addObserver(
            forName: UIScreen.capturedDidChangeNotification,
            object: nil,
            queue: .main
        ) { _ in
            self.handleScreenRecording()
        }
    }
    
    private func setupBackgroundBlurring() {
        // Blur content when app goes to background
        backgroundObserver = NotificationCenter.default.addObserver(
            forName: UIApplication.willResignActiveNotification,
            object: nil,
            queue: .main
        ) { _ in
            self.blurSensitiveContent()
        }
        
        // Remove blur when app becomes active
        NotificationCenter.default.addObserver(
            forName: UIApplication.didBecomeActiveNotification,
            object: nil,
            queue: .main
        ) { _ in
            self.unblurContent()
        }
    }
    
    private func handleScreenshot() {
        // Alert about screenshot
        sendEvent(withName: "SecurityAlert", body: [
            "type": "screenshot",
            "message": "Screenshot detected - PHI may have been captured",
            "severity": "medium"
        ])
        
        // Log event
        logSecurityEvent(type: "SCREENSHOT_TAKEN")
        
        // Show warning (optional)
        DispatchQueue.main.async {
            if let window = UIApplication.shared.keyWindow {
                let alert = UIAlertController(
                    title: "Security Notice",
                    message: "Screenshots may contain protected health information",
                    preferredStyle: .alert
                )
                alert.addAction(UIAlertAction(title: "OK", style: .default))
                window.rootViewController?.present(alert, animated: true)
            }
        }
    }
    
    private func handleScreenRecording() {
        if UIScreen.main.isCaptured {
            // Screen recording started
            sendEvent(withName: "SecurityAlert", body: [
                "type": "screen_recording",
                "message": "Screen recording detected",
                "severity": "high"
            ])
            
            logSecurityEvent(type: "SCREEN_RECORDING_STARTED")
            
            // Optionally blur sensitive content
            blurSensitiveContent()
        } else {
            // Screen recording stopped
            logSecurityEvent(type: "SCREEN_RECORDING_STOPPED")
            unblurContent()
        }
    }
    
    private func blurSensitiveContent() {
        guard blurView == nil else { return }
        
        DispatchQueue.main.async {
            if let window = UIApplication.shared.keyWindow {
                let blur = UIBlurEffect(style: .light)
                self.blurView = UIVisualEffectView(effect: blur)
                self.blurView?.frame = window.bounds
                self.blurView?.autoresizingMask = [.flexibleWidth, .flexibleHeight]
                
                // Add app logo or message
                let label = UILabel()
                label.text = "HealthBridge"
                label.font = UIFont.systemFont(ofSize: 30, weight: .bold)
                label.textColor = .systemBlue
                label.translatesAutoresizingMaskIntoConstraints = false
                self.blurView?.contentView.addSubview(label)
                
                NSLayoutConstraint.activate([
                    label.centerXAnchor.constraint(equalTo: self.blurView!.contentView.centerXAnchor),
                    label.centerYAnchor.constraint(equalTo: self.blurView!.contentView.centerYAnchor)
                ])
                
                window.addSubview(self.blurView!)
            }
        }
    }
    
    private func unblurContent() {
        DispatchQueue.main.async {
            self.blurView?.removeFromSuperview()
            self.blurView = nil
        }
    }
    
    // MARK: - Keychain Operations
    @objc func secureStore(
        _ key: String,
        value: String,
        callback: @escaping RCTResponseSenderBlock
    ) {
        let data = value.data(using: .utf8)!
        
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrAccount as String: key,
            kSecValueData as String: data,
            kSecAttrAccessible as String: kSecAttrAccessibleWhenUnlockedThisDeviceOnly
        ]
        
        // Delete existing item
        SecItemDelete(query as CFDictionary)
        
        // Add new item
        let status = SecItemAdd(query as CFDictionary, nil)
        
        if status == errSecSuccess {
            callback([["success": true]])
        } else {
            callback([["success": false, "error": "Failed to store in keychain"]])
        }
    }
    
    @objc func secureRetrieve(
        _ key: String,
        callback: @escaping RCTResponseSenderBlock
    ) {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrAccount as String: key,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne
        ]
        
        var dataTypeRef: AnyObject?
        let status = SecItemCopyMatching(query as CFDictionary, &dataTypeRef)
        
        if status == errSecSuccess {
            if let data = dataTypeRef as? Data,
               let value = String(data: data, encoding: .utf8) {
                callback([["success": true, "value": value]])
            } else {
                callback([["success": false, "error": "Failed to decode value"]])
            }
        } else {
            callback([["success": false, "error": "Item not found"]])
        }
    }
    
    // MARK: - Certificate Pinning
    @objc func validateServerCertificate(
        _ hostname: String,
        certData: String,
        callback: @escaping RCTResponseSenderBlock
    ) {
        // Expected certificate hashes for your servers
        let expectedHashes = [
            "sha256/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=", // Replace with actual hash
            "sha256/BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB="  // Backup pin
        ]
        
        // In production, properly validate the certificate chain
        // This is a simplified example
        guard let data = Data(base64Encoded: certData) else {
            callback([["valid": false, "error": "Invalid certificate data"]])
            return
        }
        
        // Calculate hash (simplified)
        let hash = SHA256.hash(data: data)
        let hashString = "sha256/" + Data(hash).base64EncodedString()
        
        if expectedHashes.contains(hashString) {
            callback([["valid": true]])
        } else {
            logSecurityEvent(type: "CERTIFICATE_MISMATCH")
            callback([["valid": false, "error": "Certificate validation failed"]])
        }
    }
    
    // MARK: - Helper Methods
    private func performSecurityChecks() {
        // Perform initial security checks
        checkJailbreak { result in
            if let dict = result.first as? [String: Any],
               let jailbroken = dict["jailbroken"] as? Bool,
               jailbroken {
                // Disable sensitive features
                self.disableSensitiveFeatures()
            }
        }
    }
    
    private func setupSecurityMonitoring() {
        // Monitor for debugger
        Timer.scheduledTimer(withTimeInterval: 10.0, repeats: true) { _ in
            self.checkForDebugger()
        }
    }
    
    private func checkForDebugger() {
        var info = kinfo_proc()
        var mib: [Int32] = [CTL_KERN, KERN_PROC, KERN_PROC_PID, getpid()]
        var size = MemoryLayout<kinfo_proc>.stride
        
        let result = sysctl(&mib, UInt32(mib.count), &info, &size, nil, 0)
        
        if result == 0 && (info.kp_proc.p_flag & P_TRACED) != 0 {
            // Debugger detected
            logSecurityEvent(type: "DEBUGGER_DETECTED")
            disableSensitiveFeatures()
        }
    }
    
    private func disableSensitiveFeatures() {
        sendEvent(withName: "SecurityAlert", body: [
            "type": "security_violation",
            "message": "Security check failed - some features disabled",
            "severity": "critical"
        ])
    }
    
    private func logSecurityEvent(type: String) {
        // Log to secure audit trail
        let event = [
            "type": type,
            "timestamp": Date().timeIntervalSince1970,
            "deviceId": UIDevice.current.identifierForVendor?.uuidString ?? "unknown"
        ] as [String : Any]
        
        sendEvent(withName: "PHIAccess", body: event)
    }
    
    // MARK: - Cleanup
    deinit {
        if let observer = screenshotObserver {
            NotificationCenter.default.removeObserver(observer)
        }
        if let observer = recordingObserver {
            NotificationCenter.default.removeObserver(observer)
        }
        if let observer = backgroundObserver {
            NotificationCenter.default.removeObserver(observer)
        }
    }
}