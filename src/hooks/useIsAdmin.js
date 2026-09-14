import { useState, useEffect } from "react";
import { supabase } from "../config/supabase";

// Keep this in sync with ADMIN_EMAILS in AdminPanel.jsx and
// ROOT_ADMIN_EMAILS in api/manage-admin.js.
const ADMIN_EMAILS = ["laxminarayan.rajbhar@gmail.com"];

// ── useIsAdmin ───────────────────────────────────────────────────────────
// Lightweight admin check meant for UI decisions elsewhere in the app —
// e.g. "should I show an Admin Panel link in the navbar?" — as opposed
// to AdminPanel.jsx's own gate, which is the authoritative check that
// actually protects the /admin route itself.
//
// Checks, in order: (1) hardcoded root email, (2) the admin_users table
// via api/manage-admin.js's "check" action (can't query that table
// directly from the client — it has no RLS policies by design).
const useIsAdmin = (currentUser) => {
  const [isAdmin, setIsAdmin] = useState(false);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    let active = true;

    const check = async () => {
      if (!currentUser) {
        if (active) { setIsAdmin(false); setChecked(true); }
        return;
      }

      const { data: { session } } = await supabase.auth.getSession();
      const email = (session?.user?.email || localStorage.getItem("email") || "")
        .trim()
        .toLowerCase();

      if (ADMIN_EMAILS.includes(email)) {
        if (active) { setIsAdmin(true); setChecked(true); }
        return;
      }

      if (!email) {
        if (active) { setIsAdmin(false); setChecked(true); }
        return;
      }

      try {
        const res = await fetch("/api/manage-admin", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session?.access_token || ""}`,
          },
          body: JSON.stringify({ action: "check" }),
        });
        const data = await res.json().catch(() => ({}));
        if (active) setIsAdmin(res.ok && !!data.isAdmin);
      } catch {
        if (active) setIsAdmin(false);
      } finally {
        if (active) setChecked(true);
      }
    };

    check();
    return () => { active = false; };
  }, [currentUser]);

  return { isAdmin, checked };
};

export default useIsAdmin;