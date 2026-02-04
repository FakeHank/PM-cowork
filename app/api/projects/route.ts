import { NextRequest, NextResponse } from 'next/server';
import { getProjects, createProject, getProjectsWithVersions } from '@/lib/fs/queries';

export async function GET(request: NextRequest) {
  const includeVersions = request.nextUrl.searchParams.get('includeVersions') === 'true';

  try {
    if (includeVersions) {
      const projects = await getProjectsWithVersions();
      return NextResponse.json({ data: projects });
    }
    
    const projects = await getProjects();
    return NextResponse.json({ data: projects });
  } catch (error) {
    console.error('Failed to fetch projects:', error);
    return NextResponse.json(
      { error: 'Failed to fetch projects' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, description } = body;

    if (!name) {
      return NextResponse.json(
        { error: 'name is required' },
        { status: 400 }
      );
    }

    const project = await createProject({ name, description });
    return NextResponse.json({ data: project }, { status: 201 });
  } catch (error) {
    console.error('Failed to create project:', error);
    const message = error instanceof Error ? error.message : 'Failed to create project';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
