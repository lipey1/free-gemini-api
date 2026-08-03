const {
  listUsers,
  countUsers,
  findUserById,
  updateUserFields,
  publicUser,
  revokeAllUserSessions,
} = require("../services/user-store");
const { requireUser } = require("./auth.routes");
const { getPlan, PLAN_ORDER } = require("../config/plans");
const { validateName } = require("../utils/credentials");

async function requireAdmin(request, set) {
  const gate = await requireUser(request, set, {});
  if (gate.error) return gate;
  if (gate.caller.user.role !== "admin") {
    set.status = 403;
    return {
      error: {
        ok: false,
        code: "ADMIN_REQUIRED",
        error: "Acesso restrito a administradores.",
      },
    };
  }
  return gate;
}

function registerAdminRoutes(app) {
  return app.group("/admin", (admin) =>
    admin
      .get("/stats", async ({ request, set }) => {
        const gate = await requireAdmin(request, set);
        if (gate.error) return gate.error;
        const totalUsers = await countUsers();
        return {
          ok: true,
          stats: {
            totalUsers,
            plans: PLAN_ORDER.map((id) => ({ id, rpm: getPlan(id).rpm })),
          },
        };
      })
      .get("/users", async ({ request, set, query }) => {
        const gate = await requireAdmin(request, set);
        if (gate.error) return gate.error;
        const users = await listUsers({
          q: query?.q,
          limit: query?.limit,
          offset: query?.offset,
        });
        return { ok: true, users, total: await countUsers() };
      })
      .get("/users/:id", async ({ request, set, params }) => {
        const gate = await requireAdmin(request, set);
        if (gate.error) return gate.error;
        const user = await findUserById(params.id);
        if (!user) {
          set.status = 404;
          return { ok: false, code: "NOT_FOUND", error: "Usuário não encontrado." };
        }
        return { ok: true, user: publicUser(user) };
      })
      .patch("/users/:id", async ({ request, set, params, body }) => {
        const gate = await requireAdmin(request, set);
        if (gate.error) return gate.error;

        const existing = await findUserById(params.id);
        if (!existing) {
          set.status = 404;
          return { ok: false, code: "NOT_FOUND", error: "Usuário não encontrado." };
        }

        const patch = {};
        if (body?.name !== undefined) {
          const nameResult = validateName(body.name);
          if (!nameResult.ok) {
            set.status = 400;
            return {
              ok: false,
              code: "VALIDATION_ERROR",
              errors: { name: nameResult.error },
              error: nameResult.error,
            };
          }
          patch.name = nameResult.value;
        }
        if (body?.role !== undefined) {
          if (!["user", "admin"].includes(body.role)) {
            set.status = 400;
            return { ok: false, code: "INVALID_ROLE", error: "Role inválida." };
          }
          patch.role = body.role;
        }
        if (body?.plan !== undefined) {
          if (!PLAN_ORDER.includes(body.plan)) {
            set.status = 400;
            return { ok: false, code: "INVALID_PLAN", error: "Plano inválido." };
          }
          patch.plan = body.plan;
        }
        if (body?.disabled !== undefined) patch.disabled = Boolean(body.disabled);

        const updated = await updateUserFields(params.id, patch);
        if (patch.disabled) await revokeAllUserSessions(params.id);

        return { ok: true, user: publicUser(updated) };
      }),
  );
}

module.exports = {
  registerAdminRoutes,
};
