"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { TopBar } from "@/components/TopBar";
import { Footer } from "@/components/Footer";
import {
  adminListUsers,
  adminPatchUser,
  fetchMe,
  type PlanId,
  type PublicUser,
} from "@/lib/auth";

const PLANS: PlanId[] = ["free", "pro", "mega", "max", "ultra"];

export default function AdminPage() {
  const router = useRouter();
  const [me, setMe] = useState<PublicUser | null>(null);
  const [users, setUsers] = useState<PublicUser[]>([]);
  const [q, setQ] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function load(query = q) {
    const session = await fetchMe();
    if (!session) {
      router.replace("/login/");
      return;
    }
    if (session.user.role !== "admin") {
      router.replace("/account/");
      return;
    }
    setMe(session.user);
    const data = await adminListUsers(query);
    setUsers(data.users);
  }

  useEffect(() => {
    load().catch((err) => setError(err.message));
  }, []);

  async function patch(id: string, body: Parameters<typeof adminPatchUser>[1]) {
    setBusy(true);
    setError(null);
    try {
      await adminPatchUser(id, body);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <TopBar active="account" />
      <main className="wrap admin-page">
        <header className="sec-head">
          <p className="kicker">Admin</p>
          <h1>Users</h1>
          <p className="measure">
            Signed in as {me?.email}. Change plan, role, or disable accounts.
          </p>
        </header>

        {error ? (
          <div className="form-banner" data-tone="error">
            {error}
          </div>
        ) : null}

        <form
          className="admin-search"
          onSubmit={(e) => {
            e.preventDefault();
            load(q).catch((err) => setError(err.message));
          }}
        >
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search email or name"
            aria-label="Search users"
          />
          <button className="btn btn-ghost" type="submit">
            Search
          </button>
        </form>

        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Email</th>
                <th>Plan</th>
                <th>Role</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td>
                    <div>{u.email}</div>
                    <div className="muted">{u.name || "—"}</div>
                  </td>
                  <td>
                    <select
                      value={u.plan}
                      disabled={busy}
                      onChange={(e) =>
                        patch(u.id, { plan: e.target.value as PlanId })
                      }
                    >
                      {PLANS.map((p) => (
                        <option key={p} value={p}>
                          {p}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <select
                      value={u.role}
                      disabled={busy || u.id === me?.id}
                      onChange={(e) =>
                        patch(u.id, { role: e.target.value })
                      }
                    >
                      <option value="user">user</option>
                      <option value="admin">admin</option>
                    </select>
                  </td>
                  <td>{u.disabled ? "disabled" : "active"}</td>
                  <td>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      disabled={busy || u.id === me?.id}
                      onClick={() => patch(u.id, { disabled: !u.disabled })}
                    >
                      {u.disabled ? "Enable" : "Disable"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
      <Footer />
    </>
  );
}
