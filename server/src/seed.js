import db from './db.js';
import { v4 as uuidv4 } from 'uuid';
import slugify from 'slugify';

const seed = () => {
  console.log('🌱 Seeding database...');

  // 1. Clear existing data
  db.pragma('foreign_keys = OFF');
  db.prepare('DELETE FROM votes').run();
  db.prepare('DELETE FROM features').run();
  db.prepare('DELETE FROM categories').run();
  db.pragma('foreign_keys = ON');

  // 2. Insert Categories
  const categorySeeds = [
    { id: 'abde51fa-fe8b-4af2-a5ca-7afa3e35fe30', name: 'Mobile App', description: 'Griffith App for students', color: '#e8341c', order_idx: 0, icon: 'smartphone' },
    { id: '0aad4204-7b24-40ce-a33b-9fb9ab563be4', name: 'Student Portal', description: 'Web-based student dashboard', color: '#000000', order_idx: 1, icon: 'layout' },
    { id: 'd0f22614-7474-43da-bad0-14ccb4ea75c6', name: 'LMS (Canvas)', description: 'Learning Management System updates', color: '#721c24', order_idx: 2, icon: 'graduation-cap' },
    { id: 'b4948206-5385-4044-87ab-dd2ad8bede93', name: 'Campus Tech', description: 'Wi-Fi, Printing, and Labs', color: '#555555', order_idx: 3, icon: 'wifi' },
    { id: '2c507bc5-a3bc-4b37-a728-e9aeb9b4e108', name: 'ServiceNow', description: 'Institutional service management', color: '#58644a', order_idx: 4, icon: 'briefcase' },
  ];

  const insertCategory = db.prepare(`
    INSERT INTO categories (id, name, description, color, order_idx, icon)
    VALUES (@id, @name, @description, @color, @order_idx, @icon)
  `);

  for (const cat of categorySeeds) {
    insertCategory.run(cat);
  }

  // 3. Insert Features
  const now = new Date().toISOString();
  
  const featureSeeds = [
    // Mobile App
    { title: 'Dark Mode', status: 'planned', stage_id: 'stg_2', cat_id: categorySeeds[0].id, votes: 269, impact: 3, effort: 2, priority: 'Low', score: 5 },
    { title: 'NFC Digital ID', status: 'planned', stage_id: 'stg_2', cat_id: categorySeeds[0].id, votes: 259, impact: 4, effort: 5, priority: 'High', score: 7 },
    { title: 'Class Timetable Widget', status: 'under_review', stage_id: 'stg_1', cat_id: categorySeeds[0].id, votes: 142, impact: 3, effort: 3, priority: 'Medium', score: 3 },
    { title: 'Offline Map', status: 'planned', stage_id: 'stg_2', cat_id: categorySeeds[0].id, votes: 210, impact: 5, effort: 4, priority: 'Medium', score: 3 },
    { title: 'Shuttle Notifications', status: 'launched', stage_id: 'stg_4', cat_id: categorySeeds[0].id, votes: 282, impact: 4, effort: 3, priority: 'High', score: 4 },
    { title: 'Emergency SOS button', status: 'in_progress', stage_id: 'stg_3', cat_id: categorySeeds[0].id, votes: 450, impact: 5, effort: 5, priority: 'Critical', score: 20 },
    { title: 'Library booking integration', status: 'in_progress', stage_id: 'stg_3', cat_id: categorySeeds[0].id, votes: 110, impact: 3, effort: 2, priority: 'Medium', score: 3 },
    { title: 'Cafeteria Pre-order', status: 'under_review', stage_id: 'stg_1', cat_id: categorySeeds[0].id, votes: 340, impact: 4, effort: 3, priority: 'High', score: 18 },

    // Student Portal
    { title: 'Real-time Shuttle Tracking', status: 'under_review', stage_id: 'stg_1', cat_id: categorySeeds[1].id, votes: 80, impact: 2, effort: 1, priority: 'Low', score: 2 },
    { title: 'GPA Calculator', status: 'under_review', stage_id: 'stg_1', cat_id: categorySeeds[1].id, votes: 95, impact: 2, effort: 1, priority: 'Low', score: 2 },
    { title: 'Enrollment Assistant', status: 'in_progress', stage_id: 'stg_3', cat_id: categorySeeds[1].id, votes: 410, impact: 5, effort: 4, priority: 'High', score: 37 },
    { title: 'Financial Statement Export', status: 'launched', stage_id: 'stg_4', cat_id: categorySeeds[1].id, votes: 120, impact: 3, effort: 2, priority: 'Medium', score: 3 },
    { title: 'Degree Progress Tracker', status: 'launched', stage_id: 'stg_4', cat_id: categorySeeds[1].id, votes: 390, impact: 4, effort: 3, priority: 'High', score: 10 },
    { title: 'Direct Messaging for Tutors', status: 'launched', stage_id: 'stg_4', cat_id: categorySeeds[1].id, votes: 480, impact: 5, effort: 2, priority: 'High', score: 89 },
    { title: 'Personalized News Feed', status: 'launched', stage_id: 'stg_4', cat_id: categorySeeds[1].id, votes: 150, impact: 3, effort: 4, priority: 'Medium', score: 6 },
    { title: 'Scholarship Finder', status: 'planned', stage_id: 'stg_2', cat_id: categorySeeds[1].id, votes: 110, impact: 3, effort: 3, priority: 'Medium', score: 3 },

    // LMS (Canvas)
    { title: 'Automated Assignment Reminders', status: 'planned', stage_id: 'stg_2', cat_id: categorySeeds[2].id, votes: 310, impact: 4, effort: 2, priority: 'High', score: 10 },
    { title: 'Voice-to-Text for Discussions', status: 'launched', stage_id: 'stg_4', cat_id: categorySeeds[2].id, votes: 180, impact: 2, effort: 3, priority: 'Low', score: 7 },
    { title: 'Enhanced Quiz Feedback', status: 'in_progress', stage_id: 'stg_3', cat_id: categorySeeds[2].id, votes: 240, impact: 3, effort: 2, priority: 'Medium', score: 5 },
    { title: 'Mobile Grading Interface', status: 'under_review', stage_id: 'stg_1', cat_id: categorySeeds[2].id, votes: 380, impact: 4, effort: 3, priority: 'High', score: 10 },
    { title: 'Anonymous Peer Review', status: 'launched', stage_id: 'stg_4', cat_id: categorySeeds[2].id, votes: 105, impact: 2, effort: 1, priority: 'Low', score: 2 },
    { title: 'Speedy Gradebook', status: 'planned', stage_id: 'stg_2', cat_id: categorySeeds[2].id, votes: 420, impact: 5, effort: 4, priority: 'Critical', score: 10 },
    { title: 'Plagiarism Checker UI', status: 'under_review', stage_id: 'stg_1', cat_id: categorySeeds[2].id, votes: 130, impact: 4, effort: 3, priority: 'Medium', score: 8 },
    { title: 'Reading List Integration', status: 'planned', stage_id: 'stg_2', cat_id: categorySeeds[2].id, votes: 160, impact: 3, effort: 2, priority: 'Medium', score: 6 },

    // Campus Tech
    { title: 'Campus-wide WiFi 6', status: 'launched', stage_id: 'stg_4', cat_id: categorySeeds[3].id, votes: 495, impact: 5, effort: 5, priority: 'Critical', score: 6 },
    { title: 'Find my Printer', status: 'under_review', stage_id: 'stg_1', cat_id: categorySeeds[3].id, votes: 220, impact: 3, effort: 2, priority: 'High', score: 15 },
    { title: 'Lab Availability Map', status: 'under_review', stage_id: 'stg_1', cat_id: categorySeeds[3].id, votes: 135, impact: 3, effort: 3, priority: 'Medium', score: 6 },
    { title: 'Smart Vending Machines', status: 'planned', stage_id: 'stg_2', cat_id: categorySeeds[3].id, votes: 360, impact: 4, effort: 1, priority: 'High', score: 78 },
    { title: 'Solar Charging Stations', status: 'planned', stage_id: 'stg_2', cat_id: categorySeeds[3].id, votes: 115, impact: 2, effort: 4, priority: 'Low', score: 2 },
    { title: 'Interactive Information Kiosks', status: 'launched', stage_id: 'stg_4', cat_id: categorySeeds[3].id, votes: 140, impact: 2, effort: 2, priority: 'Low', score: 2 },
    { title: 'Locker Booking System', status: 'planned', stage_id: 'stg_2', cat_id: categorySeeds[3].id, votes: 125, impact: 2, effort: 3, priority: 'Low', score: 3 },
    { title: 'Collaborative Room Booking', status: 'launched', stage_id: 'stg_4', cat_id: categorySeeds[3].id, votes: 410, impact: 4, effort: 2, priority: 'High', score: 12 },

    // ServiceNow (NEW)
    { title: 'ServiceNow Virtual Agent', status: 'planned', stage_id: 'stg_2', cat_id: categorySeeds[4].id, votes: 85, impact: 4, effort: 3, priority: 'Medium', score: 11 },
    { title: 'Automated Ticket Workflow', status: 'launched', stage_id: 'stg_4', cat_id: categorySeeds[4].id, votes: 120, impact: 5, effort: 2, priority: 'High', score: 25 },
    { title: 'Knowledge Base Portal Integration', status: 'in_progress', stage_id: 'stg_3', cat_id: categorySeeds[4].id, votes: 210, impact: 3, effort: 4, priority: 'Medium', score: 9 },
    { title: 'Staff Onboarding Automation', status: 'under_review', stage_id: 'stg_1', cat_id: categorySeeds[4].id, votes: 55, impact: 4, effort: 5, priority: 'High', score: 12 },
    { title: 'Asset Management Dashboard', status: 'planned', stage_id: 'stg_2', cat_id: categorySeeds[4].id, votes: 90, impact: 3, effort: 2, priority: 'Medium', score: 8 }
  ];

  const insertFeature = db.prepare(`
    INSERT INTO features (
      id, title, slug, description, status, stage_id, category_id, vote_count, 
      impact, effort, owner, key_stakeholder, priority, 
      tags, pinned, gravity_score, created_at, updated_at
    )
    VALUES (@id, @title, @slug, @description, @status, @stage_id, @category_id, @votes, @impact, @effort, @owner, @stakeholder, @priority, @tags, @pinned, @score, @now, @now)
  `);

  const owners = [ 'Sarah Miller (Digital ID)', 'James Chen (LMS)', 'Emma Watson (Campus Exp)', 'David Lee (Mobile)', 'Michael Brown (Portal)', 'Linda Garcia (Student Svcs)' ];
  const stakeholders = [ 'Prof. Smith (DVC-A)', 'Dr. Jones (Registrar)', 'IT Services Board', 'Student Guild Reps', 'LMS Steering Committee', 'Campus Facilities' ];

  for (const f of featureSeeds) {
    const owner = owners[Math.floor(Math.random() * owners.length)];
    const stakeholder = stakeholders[Math.floor(Math.random() * stakeholders.length)];
    const catName = categorySeeds.find(c => c.id === f.cat_id).name;

    insertFeature.run({
      id: uuidv4(),
      title: f.title,
      slug: slugify(f.title, { lower: true, strict: true }),
      description: `This is a highly requested feature for the ${catName} ecosystem. Implementing this will significantly improve institutional efficiency and student engagement.`,
      status: f.status,
      stage_id: f.stage_id,
      category_id: f.cat_id,
      votes: f.votes,
      impact: f.impact,
      effort: f.effort,
      owner: owner,
      stakeholder: stakeholder,
      priority: f.priority,
      tags: JSON.stringify([catName, 'Strategic']),
      pinned: Math.random() > 0.8 ? 1 : 0,
      score: f.score,
      now
    });
  }

  console.log(`✅ Database seeded with ${featureSeeds.length} features across ${categorySeeds.length} categories successfully.`);
};

try {
  seed();
} catch (error) {
  console.error('❌ Seeding failed:', error);
  process.exit(1);
}
