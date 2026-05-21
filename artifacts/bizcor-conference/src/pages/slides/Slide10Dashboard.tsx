export default function Slide10Dashboard() {
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
          Dashboard — Poori Picture, Ek Jagah
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
          flexDirection: "column",
          gap: "3vh",
        }}
      >
        <div style={{ display: "flex", gap: "3vw" }}>
          <div style={{ flex: 1, backgroundColor: "#F5F7FA", padding: "3vh 2.5vw", borderTop: "0.3vh solid #1C2541" }}>
            <div style={{ fontFamily: "'DM Mono', monospace", color: "#888888", fontSize: "0.75vw", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "1.2vh" }}>Sales Today</div>
            <div style={{ fontSize: "2.8vw", fontWeight: 800, color: "#1C2541" }}>Real-time</div>
          </div>
          <div style={{ flex: 1, backgroundColor: "#F5F7FA", padding: "3vh 2.5vw", borderTop: "0.3vh solid #E05C2A" }}>
            <div style={{ fontFamily: "'DM Mono', monospace", color: "#888888", fontSize: "0.75vw", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "1.2vh" }}>Receivables</div>
            <div style={{ fontSize: "2.8vw", fontWeight: 800, color: "#1C2541" }}>Outstanding</div>
          </div>
          <div style={{ flex: 1, backgroundColor: "#F5F7FA", padding: "3vh 2.5vw", borderTop: "0.3vh solid #5C6B89" }}>
            <div style={{ fontFamily: "'DM Mono', monospace", color: "#888888", fontSize: "0.75vw", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "1.2vh" }}>GST Payable</div>
            <div style={{ fontSize: "2.8vw", fontWeight: 800, color: "#1C2541" }}>Net balance</div>
          </div>
          <div style={{ flex: 1, backgroundColor: "#1C2541", padding: "3vh 2.5vw" }}>
            <div style={{ fontFamily: "'DM Mono', monospace", color: "rgba(255,255,255,0.5)", fontSize: "0.75vw", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "1.2vh" }}>Low Stock</div>
            <div style={{ fontSize: "2.8vw", fontWeight: 800, color: "#FFFFFF" }}>Alerts</div>
          </div>
        </div>

        <div style={{ display: "flex", gap: "3vw", flex: 1 }}>
          <div style={{ flex: 1.8, backgroundColor: "#F5F7FA", padding: "3vh 2.5vw" }}>
            <div style={{ fontFamily: "'DM Mono', monospace", color: "#888888", fontSize: "0.75vw", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "2vh" }}>12-Month Sales + Purchase Trend</div>
            <div style={{ display: "flex", gap: "0.6vw", alignItems: "flex-end", height: "10vh" }}>
              <div style={{ flex: 1, backgroundColor: "#1C2541", height: "60%" }} />
              <div style={{ flex: 1, backgroundColor: "#E0E4ED", height: "40%" }} />
              <div style={{ flex: 1, backgroundColor: "#1C2541", height: "75%" }} />
              <div style={{ flex: 1, backgroundColor: "#E0E4ED", height: "50%" }} />
              <div style={{ flex: 1, backgroundColor: "#1C2541", height: "65%" }} />
              <div style={{ flex: 1, backgroundColor: "#E0E4ED", height: "45%" }} />
              <div style={{ flex: 1, backgroundColor: "#1C2541", height: "80%" }} />
              <div style={{ flex: 1, backgroundColor: "#E0E4ED", height: "55%" }} />
              <div style={{ flex: 1, backgroundColor: "#1C2541", height: "90%" }} />
              <div style={{ flex: 1, backgroundColor: "#E0E4ED", height: "60%" }} />
              <div style={{ flex: 1, backgroundColor: "#E05C2A", height: "100%" }} />
              <div style={{ flex: 1, backgroundColor: "#E8C4B2", height: "70%" }} />
            </div>
            <div style={{ display: "flex", gap: "3vw", marginTop: "1.5vh" }}>
              <div style={{ display: "flex", gap: "0.8vw", alignItems: "center" }}>
                <div style={{ width: "1.2vw", height: "0.6vh", backgroundColor: "#1C2541" }} />
                <span style={{ fontSize: "0.9vw", color: "#555555" }}>Sales</span>
              </div>
              <div style={{ display: "flex", gap: "0.8vw", alignItems: "center" }}>
                <div style={{ width: "1.2vw", height: "0.6vh", backgroundColor: "#E0E4ED" }} />
                <span style={{ fontSize: "0.9vw", color: "#555555" }}>Purchases</span>
              </div>
            </div>
          </div>

          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "2.5vh" }}>
            <div style={{ backgroundColor: "#F5F7FA", padding: "2.5vh 2.5vw", flex: 1 }}>
              <div style={{ fontFamily: "'DM Mono', monospace", color: "#888888", fontSize: "0.75vw", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "1.2vh" }}>Top Customers</div>
              <div style={{ fontSize: "1.2vw", fontWeight: 600, color: "#1C2541", lineHeight: 1.5 }}>Revenue-wise ranking</div>
            </div>
            <div style={{ backgroundColor: "#1C2541", padding: "2.5vh 2.5vw", flex: 1 }}>
              <div style={{ fontFamily: "'DM Mono', monospace", color: "rgba(255,255,255,0.5)", fontSize: "0.75vw", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "1.2vh" }}>Period Filter</div>
              <div style={{ fontSize: "1.2vw", fontWeight: 600, color: "#FFFFFF", lineHeight: 1.5 }}>Today / Month / Year</div>
            </div>
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
        <span>10</span>
      </div>
    </div>
  );
}
