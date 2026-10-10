import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Supabase Connection using environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { title, message, target_type } = body;

    if (!title || !message) {
      return NextResponse.json({ error: 'ርዕስ እና መልእክት ባዶ መሆን አይችሉም' }, { status: 400 });
    }

    // Insert notification into Supabase notifications table
    const { data, error } = await supabase
      .from('notifications')
      .insert([
        { 
          title, 
          message, 
          target_type: target_type || 'all',
          created_at: new Date().toISOString()
        }
      ]);

    if (error) {
      console.error('Supabase Insert Error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, data });
  } catch (err: any) {
    console.error('Server Error:', err);
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}