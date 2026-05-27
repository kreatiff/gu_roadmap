import React, { useState, useEffect } from 'react';
import { X, ExternalLink, CheckCircle, Plus, Trash2, Loader2 } from 'lucide-react';
import { generateJiraPreview, fetchJiraEpics, pushToJira } from '../../api/jira';
import { useToast } from '../../contexts/ToastContext';
import styles from './PushToJiraModal.module.css';

const PushToJiraModal = ({ feature, featureId, jiraBaseUrl, onClose, onPushSuccess }) => {
  const { addToast } = useToast();
  
  const [step, setStep] = useState(1); // 1: Config, 2: Review, 3: Success
  const [isLoading, setIsLoading] = useState(false);
  
  // Step 1 State
  const [jiraType, setJiraType] = useState('epic');
  const [generateChildTasks, setGenerateChildTasks] = useState(true);
  const [parentEpicKey, setParentEpicKey] = useState('');
  const [availableEpics, setAvailableEpics] = useState([]);
  
  // Step 2 State (Review/Edit)
  const [epicData, setEpicData] = useState({
    summary: '',
    description: '',
    labels: [],
    priority: 'Medium'
  });
  const [childTasks, setChildTasks] = useState([]);
  const [newLabel, setNewLabel] = useState('');
  
  // Step 3 State
  const [resultKeys, setResultKeys] = useState({ issueKey: '', childKeys: [] });

  useEffect(() => {
    // Only block scrolling
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = 'unset'; };
  }, []);

  useEffect(() => {
    if (jiraType === 'task') {
      setIsLoading(true);
      fetchJiraEpics()
        .then(epics => {
          setAvailableEpics(epics);
          if (epics.length > 0) setParentEpicKey(epics[0].key);
        })
        .catch(() => {
          addToast('Failed to fetch Jira epics. Is Jira configured?', 'error');
        })
        .finally(() => setIsLoading(false));
    }
  }, [jiraType, addToast]);

  const handleGenerate = async () => {
    setIsLoading(true);
    try {
      const result = await generateJiraPreview({
        featureId,
        jiraType,
        generateChildTasks: jiraType === 'epic' ? generateChildTasks : false
      });
      
      setEpicData({
        summary: result.epic.summary || feature.title,
        description: result.epic.description || '',
        labels: result.epic.labels || [],
        priority: result.epic.priority || 'Medium'
      });
      setChildTasks(result.childTasks || []);
      setStep(2);
    } catch (err) {
      addToast(err.error || 'Failed to generate Jira preview. Check server configuration.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePush = async () => {
    setIsLoading(true);
    try {
      const payload = {
        featureId,
        jiraType,
        parentEpicKey: jiraType === 'task' ? parentEpicKey : undefined,
        epic: epicData,
        childTasks: childTasks
      };
      
      const res = await pushToJira(payload);
      setResultKeys(res);
      setStep(3);
      if (onPushSuccess) onPushSuccess(res.issueKey, res.childKeys);
    } catch (err) {
      addToast(err.error || 'Failed to push to Jira.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const addLabel = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const val = newLabel.trim();
      if (val && !epicData.labels.includes(val)) {
        setEpicData({ ...epicData, labels: [...epicData.labels, val] });
      }
      setNewLabel('');
    }
  };

  const removeLabel = (label) => {
    setEpicData({ ...epicData, labels: epicData.labels.filter(l => l !== label) });
  };

  const handleTaskChange = (idx, field, value) => {
    const updated = [...childTasks];
    updated[idx][field] = value;
    setChildTasks(updated);
  };

  const removeTask = (idx) => {
    setChildTasks(childTasks.filter((_, i) => i !== idx));
  };

  const addTask = () => {
    setChildTasks([...childTasks, { summary: '', description: '' }]);
  };

  const renderStep1 = () => (
    <>
      <div className={styles.body}>
        <div className={styles.field}>
          <label className={styles.label}>Create this feature in Jira as:</label>
          <div className={styles.radioGroup}>
            <label className={styles.radioLabel}>
              <input 
                type="radio" 
                name="jiraType" 
                value="epic" 
                checked={jiraType === 'epic'} 
                onChange={() => setJiraType('epic')}
              /> Epic
            </label>
            <label className={styles.radioLabel}>
              <input 
                type="radio" 
                name="jiraType" 
                value="task" 
                checked={jiraType === 'task'} 
                onChange={() => setJiraType('task')}
              /> Task
            </label>
          </div>
        </div>

        {jiraType === 'epic' && (
          <label className={styles.checkboxLabel}>
            <input 
              type="checkbox" 
              checked={generateChildTasks} 
              onChange={(e) => setGenerateChildTasks(e.target.checked)} 
            />
            Generate child Tasks using AI Foundry
          </label>
        )}

        {jiraType === 'task' && (
          <div className={styles.field} style={{ marginTop: '1.5rem' }}>
            <label className={styles.label}>Parent Epic</label>
            {isLoading && availableEpics.length === 0 ? (
              <div className={styles.input} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Loader2 size={16} className="spin" /> Loading Epics...
              </div>
            ) : (
              <select 
                className={styles.select} 
                value={parentEpicKey} 
                onChange={e => setParentEpicKey(e.target.value)}
              >
                {availableEpics.map(epic => (
                  <option key={epic.key} value={epic.key}>[{epic.key}] {epic.summary}</option>
                ))}
              </select>
            )}
          </div>
        )}
      </div>
      <div className={styles.actions}>
        <button className={styles.cancelBtn} onClick={onClose} disabled={isLoading}>Cancel</button>
        <button className={styles.primaryBtn} onClick={handleGenerate} disabled={isLoading || (jiraType === 'task' && !parentEpicKey)}>
          {isLoading ? <Loader2 size={16} className="spin" /> : 'Generate with AI'} →
        </button>
      </div>
    </>
  );

  const renderStep2 = () => (
    <>
      <div className={styles.body}>
        <div className={styles.field}>
          <label className={styles.label}>{jiraType === 'epic' ? 'Epic' : 'Task'} Summary</label>
          <input 
            className={styles.input} 
            value={epicData.summary} 
            onChange={e => setEpicData({ ...epicData, summary: e.target.value })} 
          />
        </div>
        
        <div className={styles.field}>
          <label className={styles.label}>Description</label>
          <textarea 
            className={styles.textarea} 
            value={epicData.description} 
            onChange={e => setEpicData({ ...epicData, description: e.target.value })} 
          />
        </div>

        <div className={styles.twoCols}>
          <div className={styles.field}>
            <label className={styles.label}>Priority</label>
            <select 
              className={styles.select} 
              value={epicData.priority} 
              onChange={e => setEpicData({ ...epicData, priority: e.target.value })}
            >
              <option value="Highest">Highest</option>
              <option value="High">High</option>
              <option value="Medium">Medium</option>
              <option value="Low">Low</option>
              <option value="Lowest">Lowest</option>
            </select>
          </div>
          <div className={styles.field}>
            <label className={styles.label}>Labels</label>
            <div className={styles.input} style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', minHeight: '38px', padding: '0.25rem 0.5rem' }}>
              {epicData.labels.map(lbl => (
                <span key={lbl} className={styles.labelBadge}>
                  {lbl} <button className={styles.removeLabelBtn} onClick={() => removeLabel(lbl)}><X size={12} /></button>
                </span>
              ))}
              <input 
                type="text" 
                style={{ border: 'none', outline: 'none', flex: 1, minWidth: '80px', background: 'transparent' }} 
                placeholder="Type and press Enter..." 
                value={newLabel}
                onChange={e => setNewLabel(e.target.value)}
                onKeyDown={addLabel}
              />
            </div>
          </div>
        </div>

        {jiraType === 'epic' && generateChildTasks && (
          <>
            <div className={styles.tasksHeader}>
              <h4 style={{ margin: 0 }}>Child Tasks ({childTasks.length})</h4>
              <button className={styles.addTaskBtn} onClick={addTask}><Plus size={14} /> Add Task</button>
            </div>
            
            {childTasks.map((task, idx) => (
              <div key={idx} className={styles.taskCard}>
                <div className={styles.taskHeader}>
                  <div className={styles.taskSummary}>
                    <input 
                      className={styles.input} 
                      value={task.summary} 
                      onChange={e => handleTaskChange(idx, 'summary', e.target.value)} 
                      placeholder="Task Summary"
                    />
                  </div>
                  <button className={styles.removeTaskBtn} onClick={() => removeTask(idx)} title="Remove task"><Trash2 size={16} /></button>
                </div>
                <textarea 
                  className={styles.textarea} 
                  style={{ minHeight: '60px' }}
                  value={task.description} 
                  onChange={e => handleTaskChange(idx, 'description', e.target.value)} 
                  placeholder="Task Description"
                />
              </div>
            ))}
          </>
        )}
      </div>
      <div className={styles.actions}>
        <button className={styles.cancelBtn} onClick={() => setStep(1)} disabled={isLoading}>← Back</button>
        <button className={styles.primaryBtn} onClick={handlePush} disabled={isLoading || !epicData.summary}>
          {isLoading ? <><Loader2 size={16} className="spin" /> Pushing...</> : 'Push to Jira ↗'}
        </button>
      </div>
    </>
  );

  const renderStep3 = () => (
    <div className={styles.body} style={{ marginBottom: 0 }}>
      <div className={styles.successStep}>
        <CheckCircle size={48} className={styles.successIcon} />
        <h3 className={styles.successTitle}>Pushed to Jira</h3>
        <p className={styles.successMessage}>Successfully created Jira issues for this feature.</p>
        
        <div className={styles.jiraLinks}>
          <div className={styles.jiraLinkItem}>
            <strong>{jiraType === 'epic' ? 'Epic' : 'Task'}:</strong>{' '}
            <a href={jiraBaseUrl ? `${jiraBaseUrl.replace(/\/$/, '')}/browse/${resultKeys.issueKey}` : `/browse/${resultKeys.issueKey}`} target="_blank" rel="noreferrer" title="View issue in Jira.">{resultKeys.issueKey}</a>
          </div>
          {resultKeys.childKeys.length > 0 && (
            <div className={styles.jiraLinkItem} style={{ marginTop: '0.75rem' }}>
              <strong>Child Tasks:</strong>{' '}
              {resultKeys.childKeys.map((k, i) => (
                <span key={k}>
                  <a href={jiraBaseUrl ? `${jiraBaseUrl.replace(/\/$/, '')}/browse/${k}` : `/browse/${k}`} target="_blank" rel="noreferrer">{k}</a>
                  {i < resultKeys.childKeys.length - 1 ? ', ' : ''}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
      <div className={styles.actions} style={{ borderTop: 'none', paddingTop: 0 }}>
        <button className={styles.cancelBtn} onClick={onClose}>Close</button>
      </div>
    </div>
  );

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.dialog} onClick={e => e.stopPropagation()}>
        <div className={styles.header}>
          <h3 className={styles.title}>
            {step === 1 && <><ExternalLink size={20} /> Push to Jira</>}
            {step === 2 && '✏️ Review Generated Content'}
            {step === 3 && '✅ Success'}
          </h3>
          {step !== 3 && (
            <button className={styles.closeBtn} onClick={onClose}>
              <X size={20} />
            </button>
          )}
        </div>
        
        {step === 1 && renderStep1()}
        {step === 2 && renderStep2()}
        {step === 3 && renderStep3()}
      </div>
    </div>
  );
};

export default PushToJiraModal;
