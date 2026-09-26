import { ADMIN_ROLES, mutationRoute, readBody } from "@/lib/server/http";
import { deleteDepartment, updateDepartment } from "@/lib/server/services/departments";
import { departmentSchema, parse } from "@/lib/server/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Params) {
  const { id } = await params;
  return mutationRoute(ADMIN_ROLES, async (session) =>
    updateDepartment(id, parse(departmentSchema, await readBody(request)), session),
  );
}

export async function DELETE(_request: Request, { params }: Params) {
  const { id } = await params;
  return mutationRoute(ADMIN_ROLES, (session) => {
    deleteDepartment(id, session);
    return { id };
  });
}
