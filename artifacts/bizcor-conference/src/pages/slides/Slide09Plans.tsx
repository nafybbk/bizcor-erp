export default function Slide09Plans() {
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
          Plans — Har Business Ke Liye
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
          gap: "3.5vh",
        }}
      >
        <div style={{ display: "flex", gap: "3vw" }}>
          <div
            style={{
              flex: 1,
              backgroundColor: "#F5F7FA",
              padding: "3.5vh 3vw",
              borderTop: "0.4vh solid #888888",
            }}
          >
            <div style={{ fontFamily: "'DM Mono', monospace", color: "#888888", fontSize: "0.8vw", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "1.5vh" }}>Free</div>
            <div style={{ fontSize: "1.8vw", fontWeight: 800, color: "#1C2541", marginBottom: "1vh" }}>Trial</div>
            <div style={{ fontSize: "1vw", color: "#555555", lineHeight: 1.5 }}>30 din — full features. Koi card nahi chahiye</div>
          </div>
          <div
            style={{
              flex: 1,
              backgroundColor: "#F5F7FA",
              padding: "3.5vh 3vw",
              borderTop: "0.4vh solid #5C6B89",
            }}
          >
            <div style={{ fontFamily: "'DM Mono', monospace", color: "#888888", fontSize: "0.8vw", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "1.5vh" }}>Starter</div>
            <div style={{ fontSize: "1.8vw", fontWeight: 800, color: "#1C2541", marginBottom: "1vh" }}>Small Business</div>
            <div style={{ fontSize: "1vw", color: "#555555", lineHeight: 1.5 }}>Single user, chhoti dukaan ke liye ideal</div>
          </div>
          <div
            style={{
              flex: 1,
              backgroundColor: "#1C2541",
              padding: "3.5vh 3vw",
              borderTop: "0.4vh solid #E05C2A",
            }}
          >
            <div style={{ fontFamily: "'DM Mono', monospace", color: "rgba(255,255,255,0.5)", fontSize: "0.8vw", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "1.5vh" }}>Professional</div>
            <div style={{ fontSize: "1.8vw", fontWeight: 800, color: "#FFFFFF", marginBottom: "1vh" }}>Multi-user</div>
            <div style={{ fontSize: "1vw", color: "rgba(255,255,255,0.65)", lineHeight: 1.5 }}>Full reports, staff management, GST filing</div>
          </div>
          <div
            style={{
              flex: 1,
              backgroundColor: "#F5F7FA",
              padding: "3.5vh 3vw",
              borderTop: "0.4vh solid #1C2541",
            }}
          >
            <div style={{ fontFamily: "'DM Mono', monospace", color: "#888888", fontSize: "0.8vw", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "1.5vh" }}>Enterprise</div>
            <div style={{ fontSize: "1.8vw", fontWeight: 800, color: "#1C2541", marginBottom: "1vh" }}>Unlimited</div>
            <div style={{ fontSize: "1vw", color: "#555555", lineHeight: 1.5 }}>Users unlimited, LAN + Cloud dono saath</div>
          </div>
        </div>

        <div
          style={{
            backgroundColor: "#F5F7FA",
            padding: "3vh 4vw",
            borderLeft: "0.4vw solid #E05C2A",
            display: "flex",
            flexDirection: "row",
            gap: "6vw",
            alignItems: "center",
          }}
        >
          <div style={{ fontSize: "1.2vw", fontWeight: 700, color: "#1C2541" }}>Sabhi plans mein shaamil:</div>
          <div style={{ display: "flex", gap: "4vw" }}>
            <div style={{ fontSize: "1.1vw", color: "#333333" }}>GST Filing</div>
            <div style={{ fontSize: "1.1vw", color: "#333333" }}>Inventory</div>
            <div style={{ fontSize: "1.1vw", color: "#333333" }}>Accounts</div>
            <div style={{ fontSize: "1.1vw", color: "#333333" }}>Support</div>
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
        <span>09</span>
      </div>
    </div>
  );
}
