import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Download } from 'lucide-react';
import AdminLayout from '../../../components/AdminLayout';
import ConfirmDialog from '../../../components/ConfirmDialog';
import { exportData, importData, listBackups, restoreBackup } from '../../../api/data';
import styles from './AdminDataManagementPage.module.css';

// Brisbane (AEST) is UTC+10, no DST
const BRISBANE_OFFSET_MS = 10 * 60 * 60 * 1000;

function getNextBackupTime() {
  const now = new Date();
  const nowBrisbane = new Date(now.getTime() + BRISBANE_OFFSET_MS);

  for (let daysAhead = 0; daysAhead <= 7; daysAhead++) {
    const dayBrisbane = new Date(nowBrisbane);
    dayBrisbane.setUTCDate(dayBrisbane.getUTCDate() + daysAhead);

    const dow = dayBrisbane.getUTCDay(); // 0=Sun, 6=Sat
    if (dow === 0 || dow === 6) continue;

    for (const hour of [13, 19]) {
      const slotBrisbane = new Date(dayBrisbane);
      slotBrisbane.setUTCHours(hour, 0, 0, 0);
      if (slotBrisbane > nowBrisbane) {
        return new Date(slotBrisbane.getTime() - BRISBANE_OFFSET_MS);
      }
    }
  }
  return null;
}

function formatNextRun(utcDate) {
  const now = new Date();
  const fmtDate = (d) =>
    new Intl.DateTimeFormat('en-AU', {
      timeZone: 'Australia/Brisbane',
      day: 'numeric',
      month: 'numeric',
      year: 'numeric',
    }).format(d);

  const timeStr = new Intl.DateTimeFormat('en-AU', {
    timeZone: 'Australia/Brisbane',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(utcDate);

  if (fmtDate(utcDate) === fmtDate(now)) return `Today at ${timeStr} AEST`;

  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (fmtDate(utcDate) === fmtDate(tomorrow)) return `Tomorrow at ${timeStr} AEST`;

  const weekday = new Intl.DateTimeFormat('en-AU', {
    timeZone: 'Australia/Brisbane',
    weekday: 'long',
  }).format(utcDate);
  return `${weekday} at ${timeStr} AEST`;
}

function formatRelativeTime(utcDate) {
  const diffMs = utcDate - new Date();
  if (diffMs <= 0) return 'soon';
  const diffMins = Math.floor(diffMs / 60000);
  const hours = Math.floor(diffMins / 60);
  const mins = diffMins % 60;
  if (hours > 0) return `in ${hours}h ${mins}m`;
  return `in ${mins}m`;
}

function formatBackupTime(isoString) {
  if (!isoString) return '—';
  return new Intl.DateTimeFormat('en-AU', {
    timeZone: 'Australia/Brisbane',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(new Date(isoString));
}

function formatFileSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function AdminDataManagementPage() {
  const [file, setFile] = useState(null);
  const [strategy, setStrategy] = useState('append');
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [error, setError] = useState('');
  const [showConfirm, setShowConfirm] = useState(false);

  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState('');

  const [backups, setBackups] = useState([]);
  const [backupsLoading, setBackupsLoading] = useState(true);

  const [pendingRestore, setPendingRestore] = useState(null); // filename awaiting confirmation
  const [isRestoring, setIsRestoring] = useState(false);
  const [restoreResult, setRestoreResult] = useState(null);
  const [restoreError, setRestoreError] = useState('');

  const fileInputRef = useRef(null);
  const nextBackup = getNextBackupTime();

  const fetchBackups = useCallback(async () => {
    try {
      const data = await listBackups();
      setBackups(data);
    } catch {
      // Non-fatal — list just stays empty
    } finally {
      setBackupsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBackups();
  }, [fetchBackups]);

  const handleExport = async () => {
    setIsExporting(true);
    setExportError('');
    try {
      await exportData();
      await fetchBackups(); // refresh list to show the new manual backup
    } catch (err) {
      setExportError(err?.error || 'Export failed. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  const handleRestoreConfirm = async () => {
    if (!pendingRestore) return;
    setIsRestoring(true);
    setRestoreError('');
    setRestoreResult(null);
    try {
      const res = await restoreBackup(pendingRestore);
      setRestoreResult({ filename: pendingRestore, ...res });
    } catch (err) {
      setRestoreError(err?.error || 'Restore failed. Please try again.');
    } finally {
      setIsRestoring(false);
      setPendingRestore(null);
    }
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
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (err) {
      setError(err?.error || err?.message || 'Failed to import data');
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
                Download a complete backup of the database in JSON format. This includes all Features, Categories, Stages, Tags, and system metadata. The backup is also saved to the server and will appear in the list below.
              </p>
              {exportError && <div className={styles.errorBanner}>{exportError}</div>}
              <button className={styles.exportBtn} onClick={handleExport} disabled={isExporting}>
                <Download size={16} strokeWidth={2} />
                {isExporting ? 'Exporting…' : 'Download Full Backup'}
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

          {/* BACKUPS SECTION */}
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <h2 className={styles.h2}>Backups</h2>
            </div>
            <div className={styles.cardBody}>
              {nextBackup && (
                <div className={styles.nextRunBanner}>
                  <span className={styles.nextRunDot} />
                  <span>
                    Next scheduled backup: <strong>{formatNextRun(nextBackup)}</strong>
                    <span className={styles.nextRunEta}> ({formatRelativeTime(nextBackup)})</span>
                  </span>
                </div>
              )}

              {restoreResult && (
                <div className={styles.successBanner}>
                  <p><strong>{restoreResult.message}</strong> — {formatBackupTime(backups.find(b => b.filename === restoreResult.filename)?.createdAt)}</p>
                  <ul className={styles.statsList}>
                    <li>Imported: {restoreResult.stats.imported}</li>
                    <li>Failed: {restoreResult.stats.failed}</li>
                  </ul>
                </div>
              )}

              {restoreError && <div className={styles.errorBanner}>{restoreError}</div>}

              {backupsLoading ? (
                <p className={styles.description}>Loading backups…</p>
              ) : backups.length === 0 ? (
                <p className={styles.description}>
                  No backups yet. Scheduled backups run automatically Mon–Fri at 1 PM and 7 PM AEST. Manual backups appear here too after using "Download Full Backup" above.
                </p>
              ) : (
                <div className={styles.backupList}>
                  {backups.map((backup, index) => (
                    <div
                      key={backup.filename}
                      className={`${styles.backupRow} ${index === 0 ? styles.backupRowLatest : ''}`}
                    >
                      <div className={styles.backupMeta}>
                        <span className={styles.backupTime}>{formatBackupTime(backup.createdAt)}</span>
                        <span className={styles.backupSize}>{formatFileSize(backup.sizeBytes)}</span>
                      </div>
                      <div className={styles.backupBadges}>
                        <span className={`${styles.triggerBadge} ${backup.trigger === 'manual' ? styles.triggerManual : styles.triggerScheduled}`}>
                          {backup.trigger}
                        </span>
                        {index === 0 && <span className={styles.latestBadge}>latest</span>}
                      </div>
                      <div className={styles.backupActions}>
                        <button
                          className={styles.restoreBtn}
                          onClick={() => setPendingRestore(backup.filename)}
                          disabled={isRestoring}
                          title="Restore database to this backup"
                        >
                          Restore
                        </button>
                        <a
                          href={`/api/admin/data/backups/${backup.filename}`}
                          download={backup.filename}
                          className={styles.downloadLink}
                          title="Download backup"
                        >
                          <Download size={14} strokeWidth={2.5} />
                        </a>
                      </div>
                    </div>
                  ))}
                  <p className={styles.retentionNote}>
                    Keeping {backups.length} of 10 backups. Oldest are deleted automatically when the limit is reached.
                  </p>
                </div>
              )}
            </div>
          </div>

        </div>
      </div>

      {showConfirm && (
        <ConfirmDialog
          title="DANGER: Wipe and Replace Database?"
          message="You have selected the 'Hard Reset' strategy. This will permanently delete ALL data in the database before importing the new file. This action cannot be undone."
          confirmText="Yes, Wipe Database"
          confirmWord="WIPE"
          onConfirm={handleImportSubmit}
          onCancel={() => setShowConfirm(false)}
        />
      )}

      {pendingRestore && (
        <ConfirmDialog
          title="Restore Database from Backup?"
          message={`This will wipe all current data and replace it with the contents of:\n\n${formatBackupTime(backups.find(b => b.filename === pendingRestore)?.createdAt)}\n\nThis action cannot be undone.`}
          confirmText="Yes, Restore"
          confirmWord="RESTORE"
          onConfirm={handleRestoreConfirm}
          onCancel={() => setPendingRestore(null)}
          isLoading={isRestoring}
        />
      )}
    </AdminLayout>
  );
}
