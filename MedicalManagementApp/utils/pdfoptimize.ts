import { Image } from 'react-native';
import FastImage from 'react-native-fast-image';
import Pdf from 'react-native-pdf';
import RNFS from 'react-native-fs';
import ImageResizer from 'react-native-image-resizer';

class MedicalDocumentOptimizer {
  private readonly MAX_CACHE_SIZE = 500 * 1024 * 1024; // 500MB
  private readonly THUMBNAIL_SIZE = { width: 200, height: 200 };
  
  /**
   * Progressive PDF loading for large medical documents
   */
  async loadMedicalPDF(url: string, options: PDFOptions = {}) {
    // Check cache first
    const cached = await this.getCachedDocument(url);
    if (cached) return cached;
    
    // Download progressively
    const downloadOptions = {
      fromUrl: url,
      toFile: `${RNFS.CachesDirectoryPath}/${this.hashURL(url)}.pdf`,
      background: true,
      discretionary: true,
      progressDivider: 10,
      begin: (res) => {
        console.log('Download started:', res);
      },
      progress: (res) => {
        const percentage = (res.bytesWritten / res.contentLength) * 100;
        this.onProgress?.(percentage);
      },
    };
    
    const download = RNFS.downloadFile(downloadOptions);
    const result = await download.promise;
    
    // Generate thumbnail for quick preview
    if (options.generateThumbnail) {
      await this.generatePDFThumbnail(result.path);
    }
    
    return result;
  }
  
  /**
   * Optimize medical images (X-rays, MRIs, etc.)
   */
  async optimizeMedicalImage(imageUri: string, type: 'thumbnail' | 'view' | 'full') {
    const qualities = {
      thumbnail: { width: 200, height: 200, quality: 60 },
      view: { width: 800, height: 800, quality: 75 },
      full: { width: 2048, height: 2048, quality: 85 },
    };
    
    const config = qualities[type];
    
    try {
      // Resize based on use case
      const resized = await ImageResizer.createResizedImage(
        imageUri,
        config.width,
        config.height,
        'JPEG',
        config.quality,
        0,
        undefined,
        false,
        { mode: 'contain' }
      );
      
      // Cache the optimized version
      await this.cacheImage(resized.uri, type);
      
      return resized.uri;
    } catch (error) {
      console.error('Image optimization failed:', error);
      return imageUri; // Return original if optimization fails
    }
  }
  
  /**
   * Smart cache management
   */
  async manageCacheSize() {
    const cacheDir = RNFS.CachesDirectoryPath;
    const files = await RNFS.readDir(cacheDir);
    
    // Sort by last modified
    files.sort((a, b) => b.mtime.getTime() - a.mtime.getTime());
    
    let totalSize = 0;
    const toDelete = [];
    
    for (const file of files) {
      totalSize += parseInt(file.size);
      
      if (totalSize > this.MAX_CACHE_SIZE) {
        toDelete.push(file.path);
      }
    }
    
    // Delete oldest files if over limit
    for (const path of toDelete) {
      await RNFS.unlink(path);
    }
  }
}
