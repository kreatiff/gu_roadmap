import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import AdminLayout from '../../../components/AdminLayout';
import PriorityMatrix from '../../../components/PriorityMatrix';
import FeatureSidebarCard from '../../../components/FeatureSidebarCard';
import { getFeatures } from '../../../api/features';
import { getCategories } from '../../../api/categories';
import { getStages } from '../../../api/stages';
import styles from './AdminMatrixPage.module.css';

const AdminMatrixPage = () => {
  const navigate = useNavigate();
  const [features, setFeatures] = useState([]);
  const [categories, setCategories] = useState([]);
  const [stages, setStages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState('');
  const [selectedFeatureId, setSelectedFeatureId] = useState(null);

  const fetchData = async () => {
    try {
      const [fData, cData, stData] = await Promise.all([
        getFeatures({ limit: 1000 }),
        getCategories(),
        getStages()
      ]);
      setFeatures(fData.data || []);
      setCategories(cData);
      setStages(stData);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const selectedFeature = useMemo(() => {
    return features.find(f => f.id === selectedFeatureId);
  }, [features, selectedFeatureId]);

  const filteredFeatures = useMemo(() => {
    return features.filter(f => {
      // Must have impact and effort to be on the matrix
      if (!f.impact || !f.effort) return false;

      const matchesSearch = 
        !searchTerm || 
        (f.title && f.title.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (f.category_name && f.category_name.toLowerCase().includes(searchTerm.toLowerCase()));
      
      const matchesCategory = !selectedCategoryId || f.category_id === selectedCategoryId;

      return matchesSearch && matchesCategory;
    });
  }, [features, searchTerm, selectedCategoryId]);

  const handleFeatureClick = (feature) => {
    setSelectedFeatureId(feature.id);
  };

  return (
    <AdminLayout>
      <div className={styles.pageContainer}>
        <div className={styles.mainContent}>
          <header className={styles.header}>
            <div>
              <div className={styles.breadcrumb}>PROJECT › STRATEGY</div>
              <h1 className={styles.h1}>Impact vs Effort</h1>
            </div>
            
            <div className={styles.headerActions}>
              <div className={styles.searchWrapper}>
                 <svg className={styles.searchIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                   <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
                 </svg>
                  <input 
                    type="text" 
                    placeholder="Find an idea..." 
                    className={styles.searchInput} 
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
              </div>

              <select 
                className={styles.select} 
                value={selectedCategoryId}
                onChange={(e) => setSelectedCategoryId(e.target.value)}
              >
                <option value="">All Categories</option>
                {categories.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          </header>

          <div className={styles.matrixContainer}>
            {loading ? (
              <div className={styles.loadingMessage}>Loading strategic insights...</div>
            ) : (
              <PriorityMatrix 
                features={filteredFeatures} 
                selectedFeatureId={selectedFeatureId}
                onFeatureClick={handleFeatureClick} 
              />
            )}
          </div>
        </div>

        {/* Sidebar Container */}
        <aside className={styles.sidebar}>
          {selectedFeature ? (
            <div className={styles.detailView}>
              <div className={styles.detailHeader}>
                <button 
                  className={styles.backBtn}
                  onClick={() => setSelectedFeatureId(null)}
                >
                  ← Back to list
                </button>
                <button 
                  className={styles.editBtn}
                  onClick={() => navigate(`/admin/features/${selectedFeatureId}/edit`)}
                >
                  Edit Item
                </button>
              </div>

              <div className={styles.detailBody}>
                <div 
                  className={styles.detailCategory}
                  style={{ backgroundColor: `${selectedFeature.category_color}1A`, color: selectedFeature.category_color }}
                >
                  {selectedFeature.category_name || 'General'}
                </div>
                <h2 className={styles.detailTitle}>{selectedFeature.title}</h2>
                
                <div className={styles.detailMetaGrid}>
                  <div className={styles.metaItem}>
                    <span className={styles.metaLabel}>Impact</span>
                    <span className={styles.metaValue}>{selectedFeature.impact} / 5</span>
                  </div>
                  <div className={styles.metaItem}>
                    <span className={styles.metaLabel}>Effort</span>
                    <span className={styles.metaValue}>{selectedFeature.effort} / 5</span>
                  </div>
                  <div className={styles.metaItem}>
                    <span className={styles.metaLabel}>Owner</span>
                    <span className={styles.metaValue}>{selectedFeature.owner || 'Unassigned'}</span>
                  </div>
                  <div className={styles.metaItem}>
                    <span className={styles.metaLabel}>Stage</span>
                    <span className={styles.metaValue}>{selectedFeature.stage_name || 'N/A'}</span>
                  </div>
                </div>

                <div className={styles.detailSection}>
                  <h4 className={styles.sectionTitle}>Description</h4>
                  <p className={styles.sectionText}>
                    {selectedFeature.description || 'No description provided.'}
                  </p>
                </div>

                {selectedFeature.tags && selectedFeature.tags.length > 0 && (
                  <div className={styles.detailSection}>
                    <h4 className={styles.sectionTitle}>Tags</h4>
                    <div className={styles.tagList}>
                      {selectedFeature.tags.map(tag => (
                        <span key={tag} className={styles.tag}>{tag}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className={styles.listView}>
              <h3 className={styles.sidebarTitle}>All Ideas ({filteredFeatures.length})</h3>
              <div className={styles.sidebarList}>
                {filteredFeatures.map(f => (
                  <FeatureSidebarCard 
                    key={f.id}
                    feature={f}
                    isSelected={selectedFeatureId === f.id}
                    onClick={() => handleFeatureClick(f)}
                  />
                ))}
                
                {filteredFeatures.length === 0 && (
                  <div className={styles.emptyResults}>
                    No features match these filters.
                  </div>
                )}
              </div>
            </div>
          )}
        </aside>
      </div>
    </AdminLayout>
  );
};

export default AdminMatrixPage;
