import React, { useState, useRef } from 'react';
import { Download } from 'lucide-react';
import AdminLayout from '../../../components/AdminLayout';
import ConfirmDialog from '../../../components/ConfirmDialog';
import { importData } from '../../../api/data';
import styles from './AdminDataManagementPage.module.css';

export default function AdminDataManagementPage() {
  const [file, setFile] = useState(null);
  const [strategy, setStrategy] = useState('append');
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [error, setError] = useState('');
  
  // Wipe confirm dialog state
  const [showConfirm, setShowConfirm] = useState(false);
  
  const fileInputRef = useRef(null);

  const handleExport = () => {
    // Use a relative path — Vite's dev proxy forwards /api/* to the backend.
    // In production the Fastify server serves the frontend too, so /api/* resolves directly.
    window.location.href = '/api/admin/data/export';
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setError('');
      setImportResult(null);
    }
  };

  const handleImportSubmit = async () => {
    if (!file) {
      setError('Please select a JSON file to import.');
      return;
    }
    
    if (strategy === 'wipe' && !showConfirm) {
      setShowConfirm(true);
      return;
    }

    setShowConfirm(false);
    setIsImporting(true);
    setError('');
    setImportResult(null);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('strategy', strategy);

    try {
      const res = await importData(formData);
      setImportResult(res);
      setFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || err.message || 'Failed to import data');
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <AdminLayout title="Data Management">
      <div className={styles.container}>
        <div className={styles.grid}>
          {/* EXPORT SECTION */}
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <h2 className={styles.h2}>Export Database</h2>
            </div>
            <div className={styles.cardBody}>
              <p className={styles.description}>
                Download a complete backup of the database in JSON format. This includes all Features, Categories, Stages, Tags, and system metadata.
              </p>
              <button className={styles.exportBtn} onClick={handleExport}>
                <Download size={16} strokeWidth={2} />
                Download Full Backup
              </button>
            </div>
          </div>

          {/* IMPORT SECTION */}
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <h2 className={styles.h2}>Import Data</h2>
            </div>
            <div className={styles.cardBody}>
              <p className={styles.description}>
                Upload a previously exported JSON backup to restore or migrate data into the system.
              </p>

              {error && <div className={styles.errorBanner}>{error}</div>}
              
              {importResult && (
                <div className={styles.successBanner}>
                  <p><strong>{importResult.message}</strong></p>
                  <ul className={styles.statsList}>
                    <li>Imported: {importResult.stats.imported}</li>
                    <li>Skipped: {importResult.stats.skipped}</li>
                    <li>Failed: {importResult.stats.failed}</li>
                  </ul>
                </div>
              )}

              <div className={styles.formGroup}>
                <label className={styles.label}>Select Backup File (.json)</label>
                <input 
                  type="file" 
                  accept=".json,application/json" 
                  onChange={handleFileChange}
                  ref={fileInputRef}
                  className={styles.fileInput}
                  disabled={isImporting}
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.label}>Import Strategy</label>
                <select 
                  className={styles.select} 
                  value={strategy}
                  onChange={(e) => setStrategy(e.target.value)}
                  disabled={isImporting}
                >
                  <option value="append">Safe Import (Skip duplicates)</option>
                  <option value="upsert">Merge (Update existing records)</option>
                  <option value="wipe">Hard Reset (Wipe and replace all data)</option>
                </select>
                <p className={styles.helpText}>
                  {strategy === 'append' && 'New records will be created. If a record with the same ID already exists, it will be skipped.'}
                  {strategy === 'upsert' && 'Existing records with matching IDs will be overwritten. New records will be created.'}
                  {strategy === 'wipe' && <span className={styles.dangerText}>DANGER: ALL existing data in the database will be deleted before importing.</span>}
                </p>
              </div>

              <button 
                className={`${styles.importBtn} ${strategy === 'wipe' ? styles.dangerBtn : ''}`}
                onClick={handleImportSubmit}
                disabled={isImporting || !file}
              >
                {isImporting ? 'Importing...' : 'Run Import'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {showConfirm && (
        <ConfirmDialog
          title="DANGER: Wipe and Replace Database?"
          message="You have selected the 'Hard Reset' strategy. This will permanently delete ALL data in the database before importing the new file. This action cannot be undone."
          confirmLabel="Yes, Wipe Database"
          confirmWord="WIPE"
          onConfirm={handleImportSubmit}
          onCancel={() => setShowConfirm(false)}
        />
      )}
    </AdminLayout>
  );
}
