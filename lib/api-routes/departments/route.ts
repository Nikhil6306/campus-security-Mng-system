import { ADMIN_ROLES, authedRoute, mutationRoute, readBody } from "@/lib/server/http";
import { listDepartments } from "@/lib/server/repo";
import { createDepartment } from "@/lib/server/services/departments";
import { departmentSchema, parse } from "@/lib/server/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return authedRoute(ADMIN_ROLES, () => listDepartments());
}

export async function POST(request: Request) {
  return mutationRoute(ADMIN_ROLES, async (session) =>
    createDepartment(parse(departmentSchema, await readBody(request)), session),
  );
}
