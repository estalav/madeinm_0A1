import { WorkspaceApp } from "@/components/workspace-app";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{
    project?: string | string[];
    task?: string | string[];
  }>;
}) {
  const params = await searchParams;
  const initialProjectId = Array.isArray(params.project)
    ? params.project[0]
    : params.project;
  const initialTaskId = Array.isArray(params.task) ? params.task[0] : params.task;

  return (
    <WorkspaceApp
      initialProjectId={initialProjectId}
      initialTaskId={initialTaskId}
    />
  );
}
