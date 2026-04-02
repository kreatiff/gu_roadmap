import db from './db.js';
import { v4 as uuidv4 } from 'uuid';
import slugify from 'slugify';

const seed = () => {
  console.log('🌱 Seeding database...');

  // 1. Clear existing data
  db.prepare('DELETE FROM votes').run();
  db.prepare('DELETE FROM features').run();
  db.prepare('DELETE FROM categories').run();

  // 2. Insert Categories
  const categorySeeds = [
    { id: uuidv4(), name: 'Mobile App', description: 'Griffith App for students', color: '#e8341c', order_idx: 0 },
    { id: uuidv4(), name: 'Student Portal', description: 'Web-based student dashboard', color: '#000000', order_idx: 1 },
    { id: uuidv4(), name: 'LMS (Canvas)', description: 'Learning Management System updates', color: '#721c24', order_idx: 2 },
    { id: uuidv4(), name: 'Campus Tech', description: 'Wi-Fi, Printing, and Labs', color: '#555555', order_idx: 3 },
  ];

  const insertCategory = db.prepare(`
    INSERT INTO categories (id, name, description, color, order_idx)
    VALUES (@id, @name, @description, @color, @order_idx)
  `);

  for (const cat of categorySeeds) {
    insertCategory.run(cat);
  }

  // 3. Insert Features
  const now = new Date().toISOString();
  
  const featureCategories = [
    { name: 'Mobile App', s_id: categorySeeds[0].id, items: [
      'Dark Mode', 'NFC Digital ID', 'Class Timetable Widget', 'Offline Map', 'Shuttle Notifications', 'Emergency SOS button', 'Library booking integration', 'Cafeteria Pre-order'
    ]},
    { name: 'Student Portal', s_id: categorySeeds[1].id, items: [
      'Real-time Shuttle Tracking', 'GPA Calculator', 'Enrollment Assistant', 'Financial Statement Export', 'Degree Progress Tracker', 'Direct Messaging for Tutors', 'Personalized News Feed', 'Scholarship Finder'
    ]},
    { name: 'LMS (Canvas)', s_id: categorySeeds[2].id, items: [
      'Automated Assignment Reminders', 'Voice-to-Text for Discussions', 'Enhanced Quiz Feedback', 'Mobile Grading Interface', 'Anonymous Peer Review', 'Speedy Gradebook', 'Plagiarism Checker UI', 'Reading List Integration'
    ]},
    { name: 'Campus Tech', s_id: categorySeeds[3].id, items: [
      'Campus-wide WiFi 6', 'Find my Printer', 'Lab Availability Map', 'Smart Vending Machines', 'Solar Charging Stations', 'Interactive Information Kiosks', 'Locker Booking System', 'Collaborative Room Booking'
    ]}
  ];

  const insertFeature = db.prepare(`
    INSERT INTO features (
      id, title, slug, description, status, category_id, vote_count, 
      impact, effort, owner, key_stakeholder, priority, 
      tags, pinned, created_at, updated_at
    )
    VALUES (@id, @title, @slug, @description, @status, @category_id, @vote_count, @impact, @effort, @owner, @stakeholder, @priority, @tags, @pinned, @now, @now)
  `);

  const owners = [
    'Sarah Miller (Digital ID)', 'James Chen (LMS)', 'Emma Watson (Campus Exp)', 'David Lee (Mobile)', 'Michael Brown (Portal)', 'Linda Garcia (Student Svcs)'
  ];
  const stakeholders = [
    'Prof. Smith (DVC-A)', 'Dr. Jones (Registrar)', 'IT Services Board', 'Student Guild Reps', 'LMS Steering Committee', 'Campus Facilities'
  ];
  const priorities = ['Low', 'Medium', 'High', 'Critical'];

  for (const cat of featureCategories) {
    for (const item of cat.items) {
      const id = uuidv4();
      const impact = Math.floor(Math.random() * 5) + 1;
      const effort = Math.floor(Math.random() * 5) + 1;
      const vote_count = Math.floor(Math.random() * 500);
      const isPinned = Math.random() > 0.8 ? 1 : 0;
      const statuses = ['under_review', 'planned', 'in_progress', 'launched'];
      const status = statuses[Math.floor(Math.random() * statuses.length)];
      const priority = priorities[Math.floor(Math.random() * priorities.length)];
      const owner = owners[Math.floor(Math.random() * owners.length)];
      const stakeholder = stakeholders[Math.floor(Math.random() * stakeholders.length)];

      insertFeature.run({
        id,
        title: item,
        slug: slugify(item, { lower: true, strict: true }),
        description: `This is a highly requested feature for the ${cat.name} ecosystem. Implementing this will significantly improve user experience and student engagement.`,
        status: status,
        category_id: cat.s_id,
        vote_count,
        impact,
        effort,
        owner,
        stakeholder,
        priority,
        tags: JSON.stringify([cat.name, 'Strategic']),
        pinned: isPinned,
        now
      });
    }
  }

  console.log('✅ Database seeded with 32 features successfully.');
};


try {
  seed();
} catch (error) {
  console.error('❌ Seeding failed:', error);
  process.exit(1);
}
