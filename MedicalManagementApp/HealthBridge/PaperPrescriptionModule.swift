import Foundation
import UIKit
import PDFKit

@objc(PaperPrescriptionModule)
class PaperPrescriptionModule: NSObject {
  
  @objc
  func generatePaperPrescription(
    _ prescriptionData: NSDictionary,
    resolver: @escaping RCTPromiseResolveBlock,
    rejecter: @escaping RCTPromiseRejectBlock
  ) {
    DispatchQueue.main.async {
      do {
        let pdf = self.createPrescriptionPDF(from: prescriptionData)
        let fileURL = self.savePDF(pdf)
        
        // Enable printing
        if UIPrintInteractionController.isPrintingAvailable {
          resolver([
            "success": true,
            "pdfPath": fileURL.path,
            "printable": true
          ])
        } else {
          resolver([
            "success": true,
            "pdfPath": fileURL.path,
            "printable": false,
            "message": "Printing not available, PDF saved locally"
          ])
        }
      } catch {
        rejecter("PDF_ERROR", "Failed to generate prescription", error)
      }
    }
  }
  
  private func createPrescriptionPDF(from data: NSDictionary) -> PDFDocument {
    let pdfMetaData = [
      kCGPDFContextCreator: "HealthBridge Medical",
      kCGPDFContextAuthor: data["providerName"] as? String ?? "",
      kCGPDFContextTitle: "Medical Prescription"
    ]
    
    let format = UIGraphicsPDFRendererFormat()
    format.documentInfo = pdfMetaData as [String: Any]
    
    let pageRect = CGRect(x: 0, y: 0, width: 612, height: 792) // Letter size
    let renderer = UIGraphicsPDFRenderer(bounds: pageRect, format: format)
    
    let pdfData = renderer.pdfData { (context) in
      context.beginPage()
      
      // California-required elements
      self.drawHeader(in: pageRect, data: data)
      self.drawProviderInfo(in: pageRect, data: data)
      self.drawPatientInfo(in: pageRect, data: data)
      self.drawPrescriptionDetails(in: pageRect, data: data)
      self.drawFooter(in: pageRect, data: data)
      
      // Security features
      self.addWatermark(context: context, pageRect: pageRect)
      self.addSecurityBorder(context: context, pageRect: pageRect)
    }
    
    return PDFDocument(data: pdfData)!
  }
  
  private func drawProviderInfo(in pageRect: CGRect, data: NSDictionary) {
    let provider = data["provider"] as? NSDictionary ?? [:]
    
    // DEA and NPI required on all prescriptions
    let text = """
    \(provider["name"] as? String ?? "")
    License: \(provider["licenseNumber"] as? String ?? "")
    DEA: \(provider["deaNumber"] as? String ?? "N/A")
    NPI: \(provider["npi"] as? String ?? "")
    \(provider["practiceAddress"] as? String ?? "")
    Phone: \(provider["phone"] as? String ?? "")
    """
    
    let attributes: [NSAttributedString.Key: Any] = [
      .font: UIFont.systemFont(ofSize: 10),
      .foregroundColor: UIColor.black
    ]
    
    text.draw(in: CGRect(x: 50, y: 100, width: 250, height: 100),
              withAttributes: attributes)
  }
  
  @objc
  func printPrescription(_ pdfPath: String, resolver: @escaping RCTPromiseResolveBlock, rejecter: @escaping RCTPromiseRejectBlock) {
    let printController = UIPrintInteractionController.shared
    
    guard let pdfURL = URL(string: pdfPath),
          let printData = try? Data(contentsOf: pdfURL) else {
      rejecter("PRINT_ERROR", "Invalid PDF path", nil)
      return
    }
    
    let printInfo = UIPrintInfo(dictionary: nil)
    printInfo.outputType = .general
    printInfo.jobName = "Medical Prescription"
    
    printController.printInfo = printInfo
    printController.printingItem = printData
    
    printController.present(animated: true) { (controller, completed, error) in
      if completed {
        resolver(["printed": true])
      } else if let error = error {
        rejecter("PRINT_ERROR", error.localizedDescription, error)
      } else {
        resolver(["printed": false, "cancelled": true])
      }
    }
  }
  
  @objc
  static func requiresMainQueueSetup() -> Bool {
    return true
  }
}