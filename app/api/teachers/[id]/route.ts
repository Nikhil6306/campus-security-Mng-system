import { ADMIN_ROLES, STAFF_ROLES, authedRoute, mutationRoute, readBody } from "@/lib/server/http";
import { notFound } from "@/lib/server/errors";
import { findTeacher } from "@/lib/server/repo";
import { deleteTeacher, updateTeacher } from "@/lib/server/services/teachers";
import { parse, teacherSchema } from "@/lib/server/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  const { id } = await params;
  return authedRoute(STAFF_ROLES, () => {
    const teacher = findTeacher(id);
    if (!teacher) throw notFound("That staff member is no longer listed.");
    return teacher;
  });
}

export async function PATCH(request: Request, { params }: Params) {
  const { id } = await params;
  return mutationRoute(ADMIN_ROLES, async (session) =>
    updateTeacher(id, parse(teacherSchema, await readBody(request)), session),
  );
}

export async function DELETE(_request: Request, { params }: Params) {
  const { id } = await params;
  return mutationRoute(ADMIN_ROLES, (session) => {
    deleteTeacher(id, session);
    return { id };
  });
}
