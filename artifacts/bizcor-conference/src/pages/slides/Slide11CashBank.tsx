export default function Slide11CashBank() {
  return (
    <div
      style={{
        width: "100vw",
        height: "100vh",
        overflow: "hidden",
        backgroundColor: "#FFFFFF",
        fontFamily: "'Plus Jakarta Sans', sans-serif",
        color: "#333333",
        position: "relative",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div
        style={{
          height: "15vh",
          backgroundColor: "#1C2541",
          color: "#FFFFFF",
          padding: "4vh 8vw",
          boxSizing: "border-box",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <h2 style={{ fontSize: "2.5vw", fontWeight: 700, margin: 0, letterSpacing: "-0.02em" }}>
          Cash aur Bank — Pura Hisaab
        </h2>
        <div style={{ fontFamily: "'DM Mono', monospace", fontSize: "0.9vw", opacity: 0.7, textTransform: "uppercase", letterSpacing: "0.1em" }}>
          bizcor erp
        </div>
      </div>

      <div
        style={{
          flex: 1,
          padding: "5vh 8vw",
          boxSizing: "border-box",
          display: "flex",
          flexDirection: "row",
          gap: "6vw",
        }}
      >
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "3vh" }}>
          <div style={{ display: "flex", gap: "2vw", alignItems: "flex-start" }}>
            <div style={{ fontFamily: "'DM Mono', monospace", color: "#E05C2A", fontSize: "1vw", fontWeight: 500, minWidth: "3vw", paddingTop: "0.3vh" }}>01</div>
            <div>
              <div style={{ fontSize: "1.4vw", fontWeight: 700, color: "#1C2541", marginBottom: "0.5vh" }}>Multiple Accounts</div>
              <div style={{ fontSize: "1.1vw", color: "#555555", lineHeight: 1.5 }}>Cash in Hand, Petty Cash, SBI, HDFC — sab alag alag</div>
            </div>
          </div>
          <div style={{ display: "flex", gap: "2vw", alignItems: "flex-start" }}>
            <div style={{ fontFamily: "'DM Mono', monospace", color: "#E05C2A", fontSize: "1vw", fontWeight: 500, minWidth: "3vw", paddingTop: "0.3vh" }}>02</div>
            <div>
              <div style={{ fontSize: "1.4vw", fontWeight: 700, color: "#1C2541", marginBottom: "0.5vh" }}>Expense Vouchers</div>
              <div style={{ fontSize: "1.1vw", color: "#555555", lineHeight: 1.5 }}>Rent, bijli, salary — cash ya bank se seedha deduct</div>
            </div>
          </div>
          <div style={{ display: "flex", gap: "2vw", alignItems: "flex-start" }}>
            <div style={{ fontFamily: "'DM Mono', monospace", color: "#E05C2A", fontSize: "1vw", fontWeight: 500, minWidth: "3vw", paddingTop: "0.3vh" }}>03</div>
            <div>
              <div style={{ fontSize: "1.4vw", fontWeight: 700, color: "#1C2541", marginBottom: "0.5vh" }}>Contra Entry</div>
              <div style={{ fontSize: "1.1vw", color: "#555555", lineHeight: 1.5 }}>Cash to bank ya bank to cash — ek entry mein</div>
            </div>
          </div>
        </div>

        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "2.5vh" }}>
          <div
            style={{
              backgroundColor: "#F5F7FA",
              padding: "3.5vh 3vw",
              borderTop: "0.4vh solid #1C2541",
            }}
          >
            <div style={{ fontFamily: "'DM Mono', monospace", color: "#888888", fontSize: "0.8vw", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "1.5vh" }}>Cash Book Report</div>
            <div style={{ fontSize: "1.3vw", fontWeight: 700, color: "#1C2541", lineHeight: 1.4 }}>Daily cash in/out</div>
            <div style={{ fontSize: "1vw", color: "#555555", marginTop: "0.8vh" }}>Running balance with every transaction</div>
          </div>

          <div
            style={{
              backgroundColor: "#F5F7FA",
              padding: "3.5vh 3vw",
              borderTop: "0.4vh solid #E05C2A",
            }}
          >
            <div style={{ fontFamily: "'DM Mono', monospace", color: "#888888", fontSize: "0.8vw", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "1.5vh" }}>Bank Statement Report</div>
            <div style={{ fontSize: "1.3vw", fontWeight: 700, color: "#1C2541", lineHeight: 1.4 }}>Per bank account</div>
            <div style={{ fontSize: "1vw", color: "#555555", marginTop: "0.8vh" }}>All transactions, reconciliation ready</div>
          </div>
        </div>
      </div>

      <div
        style={{
          height: "8vh",
          padding: "0 8vw",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          borderTop: "0.1vh solid #E0E0E0",
          fontFamily: "'DM Mono', monospace",
          fontSize: "0.8vw",
          color: "#888888",
          textTransform: "uppercase",
          letterSpacing: "0.08em",
        }}
      >
        <span>NAEWTGROUP.COM</span>
        <span>11</span>
      </div>
    </div>
  );
}
