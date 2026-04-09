import { v4 as uuidv4 } from 'uuid';
import slugify from 'slugify';
import { initDb, categoriesContainer, stagesContainer, featuresContainer, votesContainer, revisionsContainer } from './db.js';

/**
 * Upsert helper — creates the document or silently ignores a 409 Conflict
 * (document with that id already exists).  Makes seeding idempotent.
 */
async function upsert(container, doc) {
  try {
    await container.items.create(doc);
  } catch (err) {
    if (err.code !== 409) throw err; // 409 = already exists, that's fine
  }
}

const seed = async () => {
  console.log('🌱 Seeding database...');

  // Ensure DB + containers exist before writing
  await initDb();

  // 1. Clear existing data (delete all items in each container)
  for (const container of [votesContainer, revisionsContainer, featuresContainer, categoriesContainer]) {
    const { resources } = await container.items
      .query('SELECT c.id, c.featureId FROM c', { enableCrossPartitionQuery: true })
      .fetchAll();

    // Each container has a different partition key — extract it correctly
    const containerDef = await container.read();
    const pkPath = containerDef.resource.partitionKey.paths[0].replace('/', '');

    await Promise.all(
      resources.map((item) =>
        container.item(item.id, item[pkPath] ?? item.id).delete().catch(() => {})
      )
    );
  }
  // Clear stages separately (different pk handling)
  const { resources: stages } = await stagesContainer.items
    .query('SELECT c.id FROM c', { enableCrossPartitionQuery: true })
    .fetchAll();
  await Promise.all(stages.map((s) => stagesContainer.item(s.id, s.id).delete().catch(() => {})));

  // 2. Seed Stages
  const stageSeeds = [
    { id: 'stg_1', name: 'Under Consideration', color: '#64748b', slug: 'under_review', order_idx: 0, is_visible: true },
    { id: 'stg_2', name: 'Planned',             color: '#e8341c', slug: 'planned',      order_idx: 1, is_visible: true },
    { id: 'stg_3', name: 'In Progress',         color: '#ea580c', slug: 'in_progress',  order_idx: 2, is_visible: true },
    { id: 'stg_4', name: 'Launched',            color: '#059669', slug: 'launched',     order_idx: 3, is_visible: true },
    { id: 'stg_5', name: 'Declined',            color: '#94a3b8', slug: 'declined',     order_idx: 4, is_visible: true },
  ];
  for (const stage of stageSeeds) {
    await upsert(stagesContainer, stage);
  }

  // 3. Seed Categories
  const categorySeeds = [
    { id: 'abde51fa-fe8b-4af2-a5ca-7afa3e35fe30', name: 'Mobile App',     description: 'Griffith App for students',          color: '#e8341c', order_idx: 0, icon: 'smartphone' },
    { id: '0aad4204-7b24-40ce-a33b-9fb9ab563be4', name: 'Student Portal', description: 'Web-based student dashboard',          color: '#000000', order_idx: 1, icon: 'layout' },
    { id: 'd0f22614-7474-43da-bad0-14ccb4ea75c6', name: 'LMS (Canvas)',   description: 'Learning Management System updates',   color: '#721c24', order_idx: 2, icon: 'graduation-cap' },
    { id: 'b4948206-5385-4044-87ab-dd2ad8bede93', name: 'Campus Tech',    description: 'Wi-Fi, Printing, and Labs',            color: '#555555', order_idx: 3, icon: 'wifi' },
    { id: '2c507bc5-a3bc-4b37-a728-e9aeb9b4e108', name: 'ServiceNow',     description: 'Institutional service management',     color: '#58644a', order_idx: 4, icon: 'briefcase' },
  ];
  for (const cat of categorySeeds) {
    await upsert(categoriesContainer, cat);
  }

  // Build lookup maps for denormalization
  const stageMap = Object.fromEntries(stageSeeds.map((s) => [s.id, s]));
  const catMap   = Object.fromEntries(categorySeeds.map((c) => [c.id, c]));

  // 4. Seed Features
  const featureSeeds = [
    // Mobile App
    { title: 'Dark Mode',                  status: 'planned',      stage_id: 'stg_2', cat_id: categorySeeds[0].id, votes: 269, impact: 3, effort: 2, priority: 'Low',      score: 5 },
    { title: 'NFC Digital ID',             status: 'planned',      stage_id: 'stg_2', cat_id: categorySeeds[0].id, votes: 259, impact: 4, effort: 5, priority: 'High',     score: 7 },
    { title: 'Class Timetable Widget',     status: 'under_review', stage_id: 'stg_1', cat_id: categorySeeds[0].id, votes: 142, impact: 3, effort: 3, priority: 'Medium',   score: 3 },
    { title: 'Offline Map',                status: 'planned',      stage_id: 'stg_2', cat_id: categorySeeds[0].id, votes: 210, impact: 5, effort: 4, priority: 'Medium',   score: 3 },
    { title: 'Shuttle Notifications',      status: 'launched',     stage_id: 'stg_4', cat_id: categorySeeds[0].id, votes: 282, impact: 4, effort: 3, priority: 'High',     score: 4 },
    { title: 'Emergency SOS button',       status: 'in_progress',  stage_id: 'stg_3', cat_id: categorySeeds[0].id, votes: 450, impact: 5, effort: 5, priority: 'Critical', score: 20 },
    { title: 'Library booking integration',status: 'in_progress',  stage_id: 'stg_3', cat_id: categorySeeds[0].id, votes: 110, impact: 3, effort: 2, priority: 'Medium',   score: 3 },
    { title: 'Cafeteria Pre-order',        status: 'under_review', stage_id: 'stg_1', cat_id: categorySeeds[0].id, votes: 340, impact: 4, effort: 3, priority: 'High',     score: 18 },
    // Student Portal
    { title: 'Real-time Shuttle Tracking', status: 'under_review', stage_id: 'stg_1', cat_id: categorySeeds[1].id, votes: 80,  impact: 2, effort: 1, priority: 'Low',      score: 2 },
    { title: 'GPA Calculator',             status: 'under_review', stage_id: 'stg_1', cat_id: categorySeeds[1].id, votes: 95,  impact: 2, effort: 1, priority: 'Low',      score: 2 },
    { title: 'Enrollment Assistant',       status: 'in_progress',  stage_id: 'stg_3', cat_id: categorySeeds[1].id, votes: 410, impact: 5, effort: 4, priority: 'High',     score: 37 },
    { title: 'Financial Statement Export', status: 'launched',     stage_id: 'stg_4', cat_id: categorySeeds[1].id, votes: 120, impact: 3, effort: 2, priority: 'Medium',   score: 3 },
    { title: 'Degree Progress Tracker',    status: 'launched',     stage_id: 'stg_4', cat_id: categorySeeds[1].id, votes: 390, impact: 4, effort: 3, priority: 'High',     score: 10 },
    { title: 'Direct Messaging for Tutors',status: 'launched',     stage_id: 'stg_4', cat_id: categorySeeds[1].id, votes: 480, impact: 5, effort: 2, priority: 'High',     score: 89 },
    { title: 'Personalized News Feed',     status: 'launched',     stage_id: 'stg_4', cat_id: categorySeeds[1].id, votes: 150, impact: 3, effort: 4, priority: 'Medium',   score: 6 },
    { title: 'Scholarship Finder',         status: 'planned',      stage_id: 'stg_2', cat_id: categorySeeds[1].id, votes: 110, impact: 3, effort: 3, priority: 'Medium',   score: 3 },
    // LMS (Canvas)
    { title: 'Automated Assignment Reminders', status: 'planned',  stage_id: 'stg_2', cat_id: categorySeeds[2].id, votes: 310, impact: 4, effort: 2, priority: 'High',     score: 10 },
    { title: 'Voice-to-Text for Discussions',  status: 'launched', stage_id: 'stg_4', cat_id: categorySeeds[2].id, votes: 180, impact: 2, effort: 3, priority: 'Low',      score: 7 },
    { title: 'Enhanced Quiz Feedback',    status: 'in_progress',   stage_id: 'stg_3', cat_id: categorySeeds[2].id, votes: 240, impact: 3, effort: 2, priority: 'Medium',   score: 5 },
    { title: 'Mobile Grading Interface',  status: 'under_review',  stage_id: 'stg_1', cat_id: categorySeeds[2].id, votes: 380, impact: 4, effort: 3, priority: 'High',     score: 10 },
    { title: 'Anonymous Peer Review',     status: 'launched',      stage_id: 'stg_4', cat_id: categorySeeds[2].id, votes: 105, impact: 2, effort: 1, priority: 'Low',      score: 2 },
    { title: 'Speedy Gradebook',          status: 'planned',       stage_id: 'stg_2', cat_id: categorySeeds[2].id, votes: 420, impact: 5, effort: 4, priority: 'Critical', score: 10 },
    { title: 'Plagiarism Checker UI',     status: 'under_review',  stage_id: 'stg_1', cat_id: categorySeeds[2].id, votes: 130, impact: 4, effort: 3, priority: 'Medium',   score: 8 },
    { title: 'Reading List Integration',  status: 'planned',       stage_id: 'stg_2', cat_id: categorySeeds[2].id, votes: 160, impact: 3, effort: 2, priority: 'Medium',   score: 6 },
    // Campus Tech
    { title: 'Campus-wide WiFi 6',           status: 'launched',     stage_id: 'stg_4', cat_id: categorySeeds[3].id, votes: 495, impact: 5, effort: 5, priority: 'Critical', score: 6 },
    { title: 'Find my Printer',              status: 'under_review', stage_id: 'stg_1', cat_id: categorySeeds[3].id, votes: 220, impact: 3, effort: 2, priority: 'High',     score: 15 },
    { title: 'Lab Availability Map',         status: 'under_review', stage_id: 'stg_1', cat_id: categorySeeds[3].id, votes: 135, impact: 3, effort: 3, priority: 'Medium',   score: 6 },
    { title: 'Smart Vending Machines',       status: 'planned',      stage_id: 'stg_2', cat_id: categorySeeds[3].id, votes: 360, impact: 4, effort: 1, priority: 'High',     score: 78 },
    { title: 'Solar Charging Stations',      status: 'planned',      stage_id: 'stg_2', cat_id: categorySeeds[3].id, votes: 115, impact: 2, effort: 4, priority: 'Low',      score: 2 },
    { title: 'Interactive Information Kiosks',status: 'launched',    stage_id: 'stg_4', cat_id: categorySeeds[3].id, votes: 140, impact: 2, effort: 2, priority: 'Low',      score: 2 },
    { title: 'Locker Booking System',        status: 'planned',      stage_id: 'stg_2', cat_id: categorySeeds[3].id, votes: 125, impact: 2, effort: 3, priority: 'Low',      score: 3 },
    { title: 'Collaborative Room Booking',   status: 'launched',     stage_id: 'stg_4', cat_id: categorySeeds[3].id, votes: 410, impact: 4, effort: 2, priority: 'High',     score: 12 },
    // ServiceNow
    { title: 'ServiceNow Virtual Agent',          status: 'planned',     stage_id: 'stg_2', cat_id: categorySeeds[4].id, votes: 85,  impact: 4, effort: 3, priority: 'Medium', score: 11 },
    { title: 'Automated Ticket Workflow',          status: 'launched',    stage_id: 'stg_4', cat_id: categorySeeds[4].id, votes: 120, impact: 5, effort: 2, priority: 'High',   score: 25 },
    { title: 'Knowledge Base Portal Integration', status: 'in_progress', stage_id: 'stg_3', cat_id: categorySeeds[4].id, votes: 210, impact: 3, effort: 4, priority: 'Medium', score: 9 },
    { title: 'Staff Onboarding Automation',       status: 'under_review',stage_id: 'stg_1', cat_id: categorySeeds[4].id, votes: 55,  impact: 4, effort: 5, priority: 'High',   score: 12 },
    { title: 'Asset Management Dashboard',        status: 'planned',     stage_id: 'stg_2', cat_id: categorySeeds[4].id, votes: 90,  impact: 3, effort: 2, priority: 'Medium', score: 8 },
  ];

  const owners = [
    'Sarah Miller (Digital ID)', 'James Chen (LMS)', 'Emma Watson (Campus Exp)',
    'David Lee (Mobile)', 'Michael Brown (Portal)', 'Linda Garcia (Student Svcs)',
  ];
  const stakeholders = [
    'Prof. Smith (DVC-A)', 'Dr. Jones (Registrar)', 'IT Services Board',
    'Student Guild Reps', 'LMS Steering Committee', 'Campus Facilities',
  ];

  const now = new Date().toISOString();

  for (const f of featureSeeds) {
    const cat   = catMap[f.cat_id];
    const stage = stageMap[f.stage_id];
    const owner       = owners[Math.floor(Math.random() * owners.length)];
    const stakeholder = stakeholders[Math.floor(Math.random() * stakeholders.length)];

    const doc = {
      id: uuidv4(),
      title: f.title,
      slug: slugify(f.title, { lower: true, strict: true }),
      description: `This is a highly requested feature for the ${cat.name} ecosystem. Implementing this will significantly improve institutional efficiency and student engagement.`,
      status: f.status,
      category_id:    cat.id,
      category_name:  cat.name,
      category_color: cat.color,
      category_icon:  cat.icon,
      stage_id:    stage.id,
      stage_name:  stage.name,
      stage_color: stage.color,
      stage_slug:  stage.slug,
      vote_count:  f.votes,
      impact:      f.impact,
      effort:      f.effort,
      owner,
      key_stakeholder: stakeholder,
      priority:    f.priority,
      tags:        [cat.name, 'Strategic'],
      pinned:      Math.random() > 0.8,
      is_published: true,
      gravity_score: f.score,
      created_at: now,
      updated_at: now,
    };

    await upsert(featuresContainer, doc);
  }

  console.log(`✅ Seeded ${featureSeeds.length} features across ${categorySeeds.length} categories.`);
};

seed().catch((error) => {
  console.error('❌ Seeding failed:', error);
  process.exit(1);
});
