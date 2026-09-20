import React, { useEffect, useState } from "react";
import { supabase } from "../../config/supabase";
import { CircularProgress } from "@mui/material";
import UtilityHeader from "./UtilityHeader";

const statusColors = {
  success: "#16a34a",
  failed: "#dc2626",
  pending: "#ca8a04",
};

const typeLabels = {
  recharge: "Mobile Recharge",
  bill_payment: "Bill Payment",
  giftcard: "Gift Card",
};

const TransactionHistory = () => {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTransactions = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("utility_transactions")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (!error) setTransactions(data || []);
      setLoading(false);
    };

    fetchTransactions();

    // Optional: live updates when a new transaction is inserted
    const channel = supabase
      .channel("utility_transactions_changes")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "utility_transactions" },
        (payload) => {
          setTransactions((prev) => [payload.new, ...prev]);
        }
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, []);

  if (loading) {
    return (
      <div style={{ textAlign: "center", marginTop: 40 }}>
        <CircularProgress />
      </div>
    );
  }

  if (transactions.length === 0) {
    return <p style={{ textAlign: "center", marginTop: 40 }}>No transactions yet.</p>;
  }

  return (
    <div className="transaction-history" style={{ maxWidth: 500, margin: "0 auto", padding: "80px 16px 24px" }}>
      <UtilityHeader title="Transaction History" />
      {transactions.map((txn) => (
        <div
          key={txn.id}
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "12px 0",
            borderBottom: "1px solid #eee",
          }}
        >
          <div>
            <div style={{ fontWeight: 600 }}>
              {typeLabels[txn.type] || txn.type} — {txn.operator}
            </div>
            <div style={{ fontSize: 12, color: "#888" }}>
              {new Date(txn.created_at).toLocaleString()}
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontWeight: 600 }}>₹{txn.amount}</div>
            <div style={{ fontSize: 12, color: statusColors[txn.status] || "#888" }}>
              {txn.status}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default TransactionHistory;