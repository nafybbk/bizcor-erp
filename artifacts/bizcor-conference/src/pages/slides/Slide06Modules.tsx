export default function Slide06Modules() {
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
          Invoicing + Inventory + Accounts
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
          gap: "3vw",
        }}
      >
        <div
          style={{
            flex: 1,
            backgroundColor: "#F5F7FA",
            padding: "4vh 3vw",
            borderTop: "0.4vh solid #1C2541",
            display: "flex",
            flexDirection: "column",
            gap: "2.5vh",
          }}
        >
          <div style={{ fontFamily: "'DM Mono', monospace", color: "#888888", fontSize: "0.8vw", textTransform: "uppercase", letterSpacing: "0.1em" }}>Vouchers</div>
          <div style={{ fontSize: "1.6vw", fontWeight: 800, color: "#1C2541", lineHeight: 1.1 }}>Invoicing</div>
          <div style={{ display: "flex", flexDirection: "column", gap: "1.2vh" }}>
            <div style={{ fontSize: "1.1vw", color: "#333333", lineHeight: 1.4 }}>Sales Invoice (SI-XXXX)</div>
            <div style={{ fontSize: "1.1vw", color: "#333333", lineHeight: 1.4 }}>Credit Note (CN-XXXX)</div>
            <div style={{ fontSize: "1.1vw", color: "#333333", lineHeight: 1.4 }}>Purchase Bill (PB-XXXX)</div>
            <div style={{ fontSize: "1.1vw", color: "#333333", lineHeight: 1.4 }}>Debit Note (DN-XXXX)</div>
          </div>
          <div style={{ marginTop: "auto", fontSize: "1vw", color: "#555555", lineHeight: 1.5 }}>
            GST-inclusive toggle, transport charges, shipping address
          </div>
        </div>

        <div
          style={{
            flex: 1,
            backgroundColor: "#F5F7FA",
            padding: "4vh 3vw",
            borderTop: "0.4vh solid #E05C2A",
            display: "flex",
            flexDirection: "column",
            gap: "2.5vh",
          }}
        >
          <div style={{ fontFamily: "'DM Mono', monospace", color: "#888888", fontSize: "0.8vw", textTransform: "uppercase", letterSpacing: "0.1em" }}>Stock</div>
          <div style={{ fontSize: "1.6vw", fontWeight: 800, color: "#1C2541", lineHeight: 1.1 }}>Inventory</div>
          <div style={{ display: "flex", flexDirection: "column", gap: "1.2vh" }}>
            <div style={{ fontSize: "1.1vw", color: "#333333", lineHeight: 1.4 }}>Real-time stock levels</div>
            <div style={{ fontSize: "1.1vw", color: "#333333", lineHeight: 1.4 }}>Average rate + stock value</div>
            <div style={{ fontSize: "1.1vw", color: "#333333", lineHeight: 1.4 }}>Low stock alerts</div>
            <div style={{ fontSize: "1.1vw", color: "#333333", lineHeight: 1.4 }}>Opening + purchased - sold</div>
          </div>
          <div style={{ marginTop: "auto", fontSize: "1vw", color: "#555555", lineHeight: 1.5 }}>
            Items with HSN, GST rate, purchase + sale price
          </div>
        </div>

        <div
          style={{
            flex: 1,
            backgroundColor: "#1C2541",
            padding: "4vh 3vw",
            borderTop: "0.4vh solid #FFFFFF",
            display: "flex",
            flexDirection: "column",
            gap: "2.5vh",
            color: "#FFFFFF",
          }}
        >
          <div style={{ fontFamily: "'DM Mono', monospace", color: "rgba(255,255,255,0.5)", fontSize: "0.8vw", textTransform: "uppercase", letterSpacing: "0.1em" }}>Finance</div>
          <div style={{ fontSize: "1.6vw", fontWeight: 800, color: "#FFFFFF", lineHeight: 1.1 }}>Accounts</div>
          <div style={{ display: "flex", flexDirection: "column", gap: "1.2vh" }}>
            <div style={{ fontSize: "1.1vw", color: "rgba(255,255,255,0.85)", lineHeight: 1.4 }}>Party Ledger — running balance</div>
            <div style={{ fontSize: "1.1vw", color: "rgba(255,255,255,0.85)", lineHeight: 1.4 }}>Trial Balance</div>
            <div style={{ fontSize: "1.1vw", color: "rgba(255,255,255,0.85)", lineHeight: 1.4 }}>Outstanding Receivables</div>
            <div style={{ fontSize: "1.1vw", color: "rgba(255,255,255,0.85)", lineHeight: 1.4 }}>Receipts + Payments</div>
          </div>
          <div style={{ marginTop: "auto", fontSize: "1vw", color: "rgba(255,255,255,0.5)", lineHeight: 1.5 }}>
            Bill-wise allocation, auto status update
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
        <span>06</span>
      </div>
    </div>
  );
}
