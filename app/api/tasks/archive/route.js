import { sql } from '@/lib/db';
import { NextResponse } from 'next/server';

// POST /api/tasks/archive - Archive a task
export async function POST(request) {
  try {
    const { id } = await request.json();
    
    if (!id) {
      return NextResponse.json({ error: 'Task ID is required' }, { status: 400 });
    }
    
    const result = await sql`
      UPDATE tasks 
      SET archived_at = NOW(), updated_at = NOW()
      WHERE id = ${id}
      RETURNING id
    `;
    
    if (result.length === 0) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }
    
    return NextResponse.json({ success: true, id });
  } catch (error) {
    console.error('POST /api/tasks/archive error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE /api/tasks/archive - Restore a task from archive
export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    
    if (!id) {
      return NextResponse.json({ error: 'Task ID is required' }, { status: 400 });
    }
    
    const result = await sql`
      UPDATE tasks 
      SET archived_at = NULL, updated_at = NOW()
      WHERE id = ${id}
      RETURNING id
    `;
    
    if (result.length === 0) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }
    
    return NextResponse.json({ success: true, id });
  } catch (error) {
    console.error('DELETE /api/tasks/archive error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
