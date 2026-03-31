import db from './db.js';
import { v4 as uuidv4 } from 'uuid';
import slugify from 'slugify';

const seed = () => {
  console.log('🌱 Seeding database...');

  // 1. Clear existing data
  db.prepare('DELETE FROM votes').run();
  db.prepare('DELETE FROM features').run();
  db.prepare('DELETE FROM sections').run();

  // 2. Insert Sections
  const sections = [
    { id: uuidv4(), name: 'Mobile App', description: 'Griffith App for students', color: '#e8341c', order_idx: 0 },
    { id: uuidv4(), name: 'Student Portal', description: 'Web-based student dashboard', color: '#000000', order_idx: 1 },
    { id: uuidv4(), name: 'LMS (Canvas)', description: 'Learning Management System updates', color: '#721c24', order_idx: 2 },
    { id: uuidv4(), name: 'Campus Tech', description: 'Wi-Fi, Printing, and Labs', color: '#555555', order_idx: 3 },
  ];

  const insertSection = db.prepare(`
    INSERT INTO sections (id, name, description, color, order_idx)
    VALUES (@id, @name, @description, @color, @order_idx)
  `);

  for (const section of sections) {
    insertSection.run(section);
  }

  // 3. Insert Features
  const now = new Date().toISOString();
  const features = [
    {
      id: uuidv4(),
      title: 'Dark Mode for Mobile App',
      description: 'Add a high-contrast dark theme to the official Griffith App to reduce eye strain at night.',
      status: 'in_progress',
      section_id: sections[0].id,
      vote_count: 42,
      tags: JSON.stringify(['UI/UX', 'Accessibility']),
      pinned: 1
    },
    {
      id: uuidv4(),
      title: 'Real-time Shuttle Bus Tracking',
      description: 'Integrate live GPS data from campus shuttles directly into the student portal.',
      status: 'planned',
      section_id: sections[1].id,
      vote_count: 156,
      tags: JSON.stringify(['Transport', 'Real-time']),
      pinned: 0
    },
    {
      id: uuidv4(),
      title: 'Simplified Timetable View',
      description: 'A more intuitive way to view weekly classes and export them to Google/Outlook calendars.',
      status: 'under_review',
      section_id: sections[1].id,
      vote_count: 89,
      tags: JSON.stringify(['Calendar', 'Utility']),
      pinned: 1
    },
    {
      id: uuidv4(),
      title: 'Automated Assignment Reminders',
      description: 'Push notifications for upcoming Canvas deadlines 24 hours before they are due.',
      status: 'launched',
      section_id: sections[2].id,
      vote_count: 210,
      tags: JSON.stringify(['Productivity', 'Canvas']),
      pinned: 0
    },
    {
      id: uuidv4(),
      title: 'Campus-wide WiFi 6 Upgrade',
      description: 'Roll out faster, more reliable Wi-Fi 6 across all study areas and libraries.',
      status: 'in_progress',
      section_id: sections[3].id,
      vote_count: 312,
      tags: JSON.stringify(['Infrastructure']),
      pinned: 0
    }
  ];

  const insertFeature = db.prepare(`
    INSERT INTO features (id, title, slug, description, status, section_id, vote_count, tags, pinned, created_at, updated_at)
    VALUES (@id, @title, @slug, @description, @status, @section_id, @vote_count, @tags, @pinned, @now, @now)
  `);

  for (const feature of features) {
    feature.slug = slugify(feature.title, { lower: true, strict: true });
    feature.now = now;
    insertFeature.run(feature);
  }

  console.log('✅ Database seeded successfully.');
};

try {
  seed();
} catch (error) {
  console.error('❌ Seeding failed:', error);
  process.exit(1);
}
