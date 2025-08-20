import UIKit
import React

@objc(MedicalTableViewManager)
class MedicalTableViewManager: RCTViewManager {
  
  override func view() -> UIView! {
    return MedicalTableView()
  }
  
  override static func requiresMainQueueSetup() -> Bool {
    return true
  }
  
  @objc func scrollToRecord(_ node: NSNumber, recordId: String) {
    DispatchQueue.main.async {
      let component = self.bridge.uiManager.view(forReactTag: node) as? MedicalTableView
      component?.scrollToRecord(recordId)
    }
  }
}

class MedicalTableView: UIView {
  private var tableView: UITableView!
  private var records: [MedicalRecord] = []
  private let cellCache = NSCache<NSString, MedicalRecordCell>()
  
  // Performance optimizations
  private let imageCache = NSCache<NSString, UIImage>()
  private let dateFormatter = DateFormatter()
  private let measurementFormatter = MeasurementFormatter()
  
  // React Native Props
  @objc var onRecordSelect: RCTDirectEventBlock?
  @objc var onScroll: RCTDirectEventBlock?
  @objc var data: [[String: Any]] = [] {
    didSet {
      self.updateRecords()
    }
  }
  
  override init(frame: CGRect) {
    super.init(frame: frame)
    setupTableView()
    configureOptimizations()
  }
  
  required init?(coder: NSCoder) {
    super.init(coder: coder)
    setupTableView()
  }
  
  private func setupTableView() {
    tableView = UITableView(frame: bounds, style: .plain)
    tableView.autoresizingMask = [.flexibleWidth, .flexibleHeight]
    tableView.delegate = self
    tableView.dataSource = self
    
    // Critical performance optimizations
    tableView.rowHeight = UITableView.automaticDimension
    tableView.estimatedRowHeight = 120
    tableView.cellLayoutMarginsFollowReadableWidth = false
    
    // iOS 15+ optimizations
    if #available(iOS 15.0, *) {
      tableView.prefetchDataSource = self
      tableView.isPrefetchingEnabled = true
      tableView.reconfigureRows(at: [])
    }
    
    // Register cell types
    tableView.register(LabResultCell.self, forCellReuseIdentifier: "LabResult")
    tableView.register(MedicationCell.self, forCellReuseIdentifier: "Medication")
    tableView.register(VitalSignCell.self, forCellReuseIdentifier: "VitalSign")
    tableView.register(NoteCell.self, forCellReuseIdentifier: "Note")
    tableView.register(ImagingCell.self, forCellReuseIdentifier: "Imaging")
    
    addSubview(tableView)
  }
  
  private func configureOptimizations() {
    // Configure date formatter once
    dateFormatter.dateStyle = .medium
    dateFormatter.timeStyle = .short
    
    // Set cache limits
    cellCache.countLimit = 50
    imageCache.countLimit = 100
    imageCache.totalCostLimit = 50 * 1024 * 1024 // 50MB
  }
  
  private func updateRecords() {
    // Parse React Native data into native models
    records = data.compactMap { dict in
      MedicalRecord(dictionary: dict)
    }
    
    // Reload with animation for better UX
    DispatchQueue.main.async {
      self.tableView.reloadData()
    }
  }
  
  func scrollToRecord(_ recordId: String) {
    guard let index = records.firstIndex(where: { $0.id == recordId }) else { return }
    
    let indexPath = IndexPath(row: index, section: 0)
    tableView.scrollToRow(at: indexPath, at: .middle, animated: true)
    
    // Highlight the row briefly
    if let cell = tableView.cellForRow(at: indexPath) {
      UIView.animate(withDuration: 0.3, animations: {
        cell.backgroundColor = UIColor.systemBlue.withAlphaComponent(0.3)
      }) { _ in
        UIView.animate(withDuration: 0.3) {
          cell.backgroundColor = .clear
        }
      }
    }
  }
}

// MARK: - UITableViewDataSource
extension MedicalTableView: UITableViewDataSource {
  func tableView(_ tableView: UITableView, numberOfRowsInSection section: Int) -> Int {
    return records.count
  }
  
  func tableView(_ tableView: UITableView, cellForRowAt indexPath: IndexPath) -> UITableViewCell {
    let record = records[indexPath.row]
    
    // Use different cell types for different record types
    switch record.type {
    case .labResult:
      let cell = tableView.dequeueReusableCell(withIdentifier: "LabResult", for: indexPath) as! LabResultCell
      cell.configure(with: record, dateFormatter: dateFormatter)
      return cell
      
    case .medication:
      let cell = tableView.dequeueReusableCell(withIdentifier: "Medication", for: indexPath) as! MedicationCell
      cell.configure(with: record)
      highlightIfControlled(cell, medication: record)
      return cell
      
    case .vitalSign:
      let cell = tableView.dequeueReusableCell(withIdentifier: "VitalSign", for: indexPath) as! VitalSignCell
      cell.configure(with: record, formatter: measurementFormatter)
      highlightIfAbnormal(cell, vital: record)
      return cell
      
    case .note:
      let cell = tableView.dequeueReusableCell(withIdentifier: "Note", for: indexPath) as! NoteCell
      cell.configure(with: record)
      return cell
      
    case .imaging:
      let cell = tableView.dequeueReusableCell(withIdentifier: "Imaging", for: indexPath) as! ImagingCell
      cell.configure(with: record, imageCache: imageCache)
      return cell
      
    default:
      let cell = UITableViewCell(style: .subtitle, reuseIdentifier: "Default")
      cell.textLabel?.text = record.title
      cell.detailTextLabel?.text = dateFormatter.string(from: record.date)
      return cell
    }
  }
  
  private func highlightIfControlled(_ cell: MedicationCell, medication: MedicalRecord) {
    // California CURES requirements - highlight controlled substances
    let controlledSubstances = ["oxycodone", "hydrocodone", "alprazolam", "lorazepam"]
    if controlledSubstances.contains(where: medication.title.lowercased().contains) {
      cell.setControlledSubstanceIndicator(true)
    }
  }
  
  private func highlightIfAbnormal(_ cell: VitalSignCell, vital: MedicalRecord) {
    // Highlight abnormal vitals for quick identification
    if let value = vital.numericValue {
      switch vital.subtype {
      case "blood_pressure_systolic":
        if value > 140 || value < 90 { cell.setAbnormal(true) }
      case "heart_rate":
        if value > 100 || value < 60 { cell.setAbnormal(true) }
      case "temperature":
        if value > 38.0 || value < 36.0 { cell.setAbnormal(true) }
      default:
        break
      }
    }
  }
}

// MARK: - UITableViewDelegate
extension MedicalTableView: UITableViewDelegate {
  func tableView(_ tableView: UITableView, didSelectRowAt indexPath: IndexPath) {
    tableView.deselectRow(at: indexPath, animated: true)
    
    let record = records[indexPath.row]
    
    // Send event to React Native
    onRecordSelect?([
      "id": record.id,
      "type": record.type.rawValue,
      "title": record.title,
      "date": record.date.timeIntervalSince1970,
      "index": indexPath.row
    ])
  }
  
  func scrollViewDidScroll(_ scrollView: UIScrollView) {
    // Throttle scroll events to React Native
    NSObject.cancelPreviousPerformRequests(withTarget: self, selector: #selector(sendScrollEvent), object: nil)
    perform(#selector(sendScrollEvent), with: nil, afterDelay: 0.1)
  }
  
  @objc private func sendScrollEvent() {
    let visibleIndexPaths = tableView.indexPathsForVisibleRows ?? []
    let firstVisible = visibleIndexPaths.first?.row ?? 0
    let lastVisible = visibleIndexPaths.last?.row ?? 0
    
    onScroll?([
      "firstVisibleIndex": firstVisible,
      "lastVisibleIndex": lastVisible,
      "contentOffset": tableView.contentOffset.y
    ])
  }
}

// MARK: - UITableViewDataSourcePrefetching
extension MedicalTableView: UITableViewDataSourcePrefetching {
  func tableView(_ tableView: UITableView, prefetchRowsAt indexPaths: [IndexPath]) {
    // Prefetch images for upcoming cells
    for indexPath in indexPaths {
      let record = records[indexPath.row]
      if record.type == .imaging, let imageUrl = record.imageUrl {
        // Start downloading image in background
        preloadImage(from: imageUrl)
      }
    }
  }
  
  private func preloadImage(from url: String) {
    // Implementation for background image loading
    guard let imageUrl = URL(string: url) else { return }
    
    URLSession.shared.dataTask(with: imageUrl) { [weak self] data, _, _ in
      guard let data = data, let image = UIImage(data: data) else { return }
      self?.imageCache.setObject(image, forKey: url as NSString, cost: data.count)
    }.resume()
  }
}
