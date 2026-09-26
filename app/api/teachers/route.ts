import { ADMIN_ROLES, STAFF_ROLES, authedRoute, mutationRoute, readBody } from "@/lib/server/http";
import { listTeachers } from "@/lib/server/repo";
import { createTeacher } from "@/lib/server/services/teachers";
import { parse, teacherSchema } from "@/lib/server/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return authedRoute(STAFF_ROLES, () => listTeachers());
}

export async function POST(request: Request) {
  return mutationRoute(ADMIN_ROLES, async (session) =>
    createTeacher(parse(teacherSchema, await readBody(request)), session),
  );
}
