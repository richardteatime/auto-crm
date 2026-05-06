import { notFound } from "next/navigation";
import { getProject, listProjectLogs } from "@/lib/db";
import { ProjectDetailClient } from "@/components/timeline/ProjectDetailClient";

export default async function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [project, logs] = await Promise.all([
    getProject(id),
    listProjectLogs(id),
  ]);
  if (!project) notFound();
  return <ProjectDetailClient project={project} logs={logs} />;
}
