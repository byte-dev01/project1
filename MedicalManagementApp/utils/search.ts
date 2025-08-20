import Fuse from 'fuse.js';
import { metaphone } from 'metaphone';
import SQLite from 'react-native-sqlite-storage';

class OptimizedPatientSearch {
  private searchIndex: Fuse;
  private phoneticIndex = new Map();
  
  /**
   * Initialize search indices
   */
  async initializeSearchIndex(patients: Patient[]) {
    // Create Fuse.js index for fuzzy search
    this.searchIndex = new Fuse(patients, {
      keys: [
        { name: 'firstName', weight: 0.3 },
        { name: 'lastName', weight: 0.3 },
        { name: 'mrn', weight: 0.2 },
        { name: 'dateOfBirth', weight: 0.1 },
        { name: 'phone', weight: 0.1 },
      ],
      threshold: 0.3, // Allow typos
      includeScore: true,
      minMatchCharLength: 2,
    });
    
    // Build phonetic index for name matching
    patients.forEach(patient => {
      const firstNameSound = metaphone(patient.firstName);
      const lastNameSound = metaphone(patient.lastName);
      
      this.phoneticIndex.set(`${firstNameSound}_${lastNameSound}`, patient.id);
    });
  }
  
  /**
   * Multi-strategy search
   */
  async searchPatients(query: string): Promise<SearchResult[]> {
    const results = [];
    
    // Strategy 1: Direct MRN match (fastest)
    if (/^\d{6,}$/.test(query)) {
      const mrnMatch = await this.searchByMRN(query);
      if (mrnMatch) results.push(...mrnMatch);
    }
    
    // Strategy 2: Fuzzy name search
    const fuzzyResults = this.searchIndex.search(query).slice(0, 20);
    results.push(...fuzzyResults);
    
    // Strategy 3: Phonetic matching (for misspellings)
    const phoneticResults = await this.searchPhonetic(query);
    results.push(...phoneticResults);
    
    // Dedupe and sort by relevance
    return this.dedupeAndSort(results);
  }
  
  /**
   * Optimized SQL search for large datasets
   */
  async searchByMRN(mrn: string): Promise<Patient[]> {
    const db = await SQLite.openDatabase({ name: 'patients.db' });
    
    const query = `
      SELECT * FROM patients 
      WHERE mrn LIKE ? 
      OR mrn = ?
      LIMIT 10
    `;
    
    const [results] = await db.executeSql(query, [`%${mrn}%`, mrn]);
    return this.parseResults(results);
  }
}

