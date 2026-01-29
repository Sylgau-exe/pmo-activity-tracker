import { getDb } from '@/lib/db';
import { NextResponse } from 'next/server';

// GET /api/tasks - Fetch all tasks (excluding archived by default)
export async function GET(request) {
  try {
    const sql = getDb();
    const { searchParams } = new URL(request.url);
    const includeArchived = searchParams.get('archived') === 'true';
    
    let tasks;
    if (includeArchived) {
      tasks = await sql`
        SELECT * FROM tasks 
        WHERE archived_at IS NOT NULL 
        ORDER BY archived_at DESC
      `;
    } else {
      tasks = await sql`
        SELECT * FROM tasks 
        WHERE archived_at IS NULL 
        ORDER BY created_at DESC
      `;
    }
    
    // Transform snake_case to camelCase for frontend
    const transformedTasks = tasks.map(transformTask);
    
    return NextResponse.json({ tasks: transformedTasks });
  } catch (error) {
    console.error('GET /api/tasks error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST /api/tasks - Create a new task
export async function POST(request) {
  try {
    const sql = getDb();
    const body = await request.json();
    const id = `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const result = await sql`
      INSERT INTO tasks (
        id, title, description, status, portfolio, project,
        effort, impact, blocked, blocker_reason,
        due_date, start_date, completed_date,
        last_session_date, session_notes, next_action,
        repo_url, tech_stack
      ) VALUES (
        ${id},
        ${body.title},
        ${body.description || null},
        ${body.status || 'backlog'},
        ${body.portfolio},
        ${body.project || null},
        ${body.effort || null},
        ${body.impact || null},
        ${body.blocked || false},
        ${body.blockerReason || null},
        ${body.dueDate || null},
        ${body.startDate || null},
        ${body.completedDate || null},
        ${body.lastSessionDate || new Date().toISOString().split('T')[0]},
        ${body.sessionNotes || null},
        ${body.nextAction || null},
        ${body.repoUrl || null},
        ${body.techStack || []}
      )
      RETURNING *
    `;
    
    return NextResponse.json({ task: transformTask(result[0]) }, { status: 201 });
  } catch (error) {
    console.error('POST /api/tasks error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PUT /api/tasks - Update a task
export async function PUT(request) {
  try {
    const sql = getDb();
    const body = await request.json();
    
    if (!body.id) {
      return NextResponse.json({ error: 'Task ID is required' }, { status: 400 });
    }
    
    const result = await sql`
      UPDATE tasks SET
        title = ${body.title},
        description = ${body.description || null},
        status = ${body.status},
        portfolio = ${body.portfolio},
        project = ${body.project || null},
        effort = ${body.effort || null},
        impact = ${body.impact || null},
        blocked = ${body.blocked || false},
        blocker_reason = ${body.blockerReason || null},
        due_date = ${body.dueDate || null},
        start_date = ${body.startDate || null},
        completed_date = ${body.completedDate || null},
        last_session_date = ${body.lastSessionDate || new Date().toISOString().split('T')[0]},
        session_notes = ${body.sessionNotes || null},
        next_action = ${body.nextAction || null},
        repo_url = ${body.repoUrl || null},
        tech_stack = ${body.techStack || []},
        updated_at = NOW()
      WHERE id = ${body.id}
      RETURNING *
    `;
    
    if (result.length === 0) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }
    
    return NextResponse.json({ task: transformTask(result[0]) });
  } catch (error) {
    console.error('PUT /api/tasks error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE /api/tasks - Delete a task permanently
export async function DELETE(request) {
  try {
    const sql = getDb();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    
    if (!id) {
      return NextResponse.json({ error: 'Task ID is required' }, { status: 400 });
    }
    
    await sql`DELETE FROM tasks WHERE id = ${id}`;
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('DELETE /api/tasks error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// Helper to transform snake_case DB columns to camelCase
function transformTask(task) {
  return {
    id: task.id,
    title: task.title,
    description: task.description,
    status: task.status,
    portfolio: task.portfolio,
    project: task.project,
    effort: task.effort,
    impact: task.impact,
    blocked: task.blocked,
    blockerReason: task.blocker_reason,
    dueDate: task.due_date ? task.due_date.toISOString().split('T')[0] : null,
    startDate: task.start_date ? task.start_date.toISOString().split('T')[0] : null,
    completedDate: task.completed_date ? task.completed_date.toISOString().split('T')[0] : null,
    lastSessionDate: task.last_session_date ? task.last_session_date.toISOString().split('T')[0] : null,
    sessionNotes: task.session_notes,
    nextAction: task.next_action,
    repoUrl: task.repo_url,
    techStack: task.tech_stack || [],
    createdAt: task.created_at,
    updatedAt: task.updated_at,
    archivedAt: task.archived_at,
  };
}
