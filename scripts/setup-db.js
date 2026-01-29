// Database setup script
// Run with: npm run db:setup
// Requires DATABASE_URL environment variable

const { neon } = require('@neondatabase/serverless');

async function setupDatabase() {
  if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL environment variable is required');
    console.log('   Set it in .env.local or run: export DATABASE_URL="your-neon-connection-string"');
    process.exit(1);
  }

  const sql = neon(process.env.DATABASE_URL);

  console.log('🚀 Setting up PMO Activity Tracker database...\n');

  try {
    // Create tasks table
    console.log('📋 Creating tasks table...');
    await sql`
      CREATE TABLE IF NOT EXISTS tasks (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT,
        status TEXT NOT NULL DEFAULT 'backlog',
        portfolio TEXT NOT NULL,
        project TEXT,
        effort TEXT,
        impact TEXT,
        blocked BOOLEAN DEFAULT FALSE,
        blocker_reason TEXT,
        due_date DATE,
        start_date DATE,
        completed_date DATE,
        last_session_date DATE,
        session_notes TEXT,
        next_action TEXT,
        repo_url TEXT,
        tech_stack TEXT[],
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        archived_at TIMESTAMP WITH TIME ZONE
      )
    `;
    console.log('   ✅ Tasks table created\n');

    // Create index for common queries
    console.log('📇 Creating indexes...');
    await sql`CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_tasks_portfolio ON tasks(portfolio)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_tasks_archived ON tasks(archived_at)`;
    console.log('   ✅ Indexes created\n');

    // Insert sample tasks
    console.log('📝 Inserting sample tasks...');
    
    const sampleTasks = [
      {
        id: 'task-1',
        title: 'Wire Admin Dashboard to Neon DB',
        description: 'Connect the admin panel UI to the Neon PostgreSQL database',
        status: 'ready',
        portfolio: 'pmo-eco',
        project: 'BizSimHub',
        effort: 'M',
        impact: 'High',
        blocked: false,
        session_notes: 'Admin dashboard UI complete with Gantt mascot and CSS animations',
        next_action: 'Create API routes for CRUD operations',
        repo_url: 'https://github.com/Sylgau-exe/simulations',
        tech_stack: ['Next.js', 'Neon', 'React']
      },
      {
        id: 'task-2',
        title: 'Implement Forgot Password Flow',
        description: 'Add password reset functionality with email verification',
        status: 'backlog',
        portfolio: 'pmo-eco',
        project: 'BizSimHub',
        effort: 'S',
        impact: 'Medium',
        blocked: false,
        next_action: 'Choose email service (Resend vs SendGrid)',
        repo_url: 'https://github.com/Sylgau-exe/simulations',
        tech_stack: ['Next.js', 'Resend']
      },
      {
        id: 'task-3',
        title: 'Email Confirmation on Registration',
        description: 'Require email verification before account activation',
        status: 'backlog',
        portfolio: 'pmo-eco',
        project: 'BizSimHub',
        effort: 'S',
        impact: 'Medium',
        blocked: true,
        blocker_reason: 'Depends on email service integration',
        next_action: 'Implement after forgot password flow',
        repo_url: 'https://github.com/Sylgau-exe/simulations',
        tech_stack: ['Next.js', 'Resend']
      },
      {
        id: 'task-4',
        title: 'Skills Assessment Integration',
        description: 'Integrate PM Skills Assessment with dynamic targets into Advisor',
        status: 'done',
        portfolio: 'pmo-eco',
        project: 'PMO Advisor',
        effort: 'L',
        impact: 'High',
        blocked: false,
        start_date: '2025-01-15',
        completed_date: '2025-01-27',
        session_notes: 'Completed comprehensive assessment with personalized roadmap generation',
        tech_stack: ['React', 'Tailwind']
      },
      {
        id: 'task-5',
        title: 'Market Risk Indicators Dashboard',
        description: 'Financial monitoring with yen carry trade dynamics',
        status: 'in-progress',
        portfolio: 'tools',
        project: 'Financial Dashboard',
        effort: 'L',
        impact: 'High',
        blocked: false,
        start_date: '2025-01-20',
        session_notes: 'Core indicators implemented, need to add alert thresholds',
        next_action: 'Add configurable alert thresholds',
        tech_stack: ['React', 'Recharts']
      },
      {
        id: 'task-6',
        title: 'Scaling Up Implementation',
        description: 'Implement Scaling Up and Metronomics methodologies',
        status: 'in-progress',
        portfolio: 'consulting',
        project: 'BL Camions',
        effort: 'XL',
        impact: 'High',
        blocked: false,
        start_date: '2025-01-10',
        session_notes: 'Capacity planning tools delivered, working on resource allocation',
        next_action: 'Review department capacity analysis',
        tech_stack: ['Excel', 'Process']
      },
      {
        id: 'task-7',
        title: 'PMO Ecosystem Hub Design',
        description: 'Central hub connecting all pillars: Learn, Practice, Apply, Execute',
        status: 'backlog',
        portfolio: 'pmo-eco',
        project: 'PMO Ecosystem Hub',
        effort: 'XL',
        impact: 'High',
        blocked: false,
        next_action: 'Define integration architecture between platforms',
        tech_stack: ['Next.js', 'API']
      }
    ];

    for (const task of sampleTasks) {
      await sql`
        INSERT INTO tasks (
          id, title, description, status, portfolio, project, 
          effort, impact, blocked, blocker_reason,
          start_date, completed_date, session_notes, next_action,
          repo_url, tech_stack, last_session_date
        ) VALUES (
          ${task.id}, ${task.title}, ${task.description}, ${task.status}, 
          ${task.portfolio}, ${task.project}, ${task.effort}, ${task.impact},
          ${task.blocked}, ${task.blocker_reason || null},
          ${task.start_date || null}, ${task.completed_date || null},
          ${task.session_notes || null}, ${task.next_action || null},
          ${task.repo_url || null}, ${task.tech_stack || []},
          CURRENT_DATE
        )
        ON CONFLICT (id) DO NOTHING
      `;
    }
    console.log(`   ✅ ${sampleTasks.length} sample tasks inserted\n`);

    console.log('🎉 Database setup complete!');
    console.log('   Run "npm run dev" to start the application\n');

  } catch (error) {
    console.error('❌ Setup failed:', error.message);
    process.exit(1);
  }
}

setupDatabase();
