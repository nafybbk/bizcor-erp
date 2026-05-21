export default function Slide01Title() {
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
          height: "38vh",
          backgroundColor: "#1C2541",
          color: "#FFFFFF",
          padding: "5vh 8vw",
          boxSizing: "border-box",
          position: "relative",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontSize: "1vw", fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", opacity: 0.75, fontFamily: "'DM Mono', monospace" }}>
            BizCor ERP
          </div>
          <div style={{ fontSize: "1vw", fontWeight: 500, letterSpacing: "0.08em", opacity: 0.7, fontFamily: "'DM Mono', monospace" }}>
            naewtgroup.com
          </div>
        </div>

        <div>
          <h1
            style={{
              fontSize: "5.5vw",
              fontWeight: 800,
              margin: "0 0 1.5vh 0",
              letterSpacing: "-0.03em",
              lineHeight: 1.05,
            }}
          >
            BizCor ERP
          </h1>
          <p style={{ fontSize: "1.6vw", fontWeight: 400, margin: 0, opacity: 0.8, letterSpacing: "0.02em" }}>
            Smart Business Management — India ke liye
          </p>
        </div>

        <div
          style={{
            position: "absolute",
            bottom: "-3.5vw",
            right: "8vw",
            width: "7vw",
            height: "7vw",
            borderRadius: "50%",
            border: "0.2vw solid #1C2541",
            backgroundColor: "#FFFFFF",
            zIndex: 10,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              width: "5.5vw",
              height: "5.5vw",
              borderRadius: "50%",
              border: "0.1vw solid #1C2541",
              opacity: 0.4,
            }}
          />
        </div>
      </div>

      <div
        style={{
          flex: 1,
          padding: "7vh 8vw 4vh 8vw",
          boxSizing: "border-box",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
        }}
      >
        <div>
          <p
            style={{
              fontSize: "2vw",
              fontWeight: 400,
              color: "#555555",
              margin: "0 0 3vh 0",
              maxWidth: "55vw",
              lineHeight: 1.5,
            }}
          >
            GST Ready &nbsp;|&nbsp; Invoicing &nbsp;|&nbsp; Inventory &nbsp;|&nbsp; Accounts
          </p>
          <div style={{ display: "flex", gap: "1.5vw", alignItems: "center" }}>
            <div style={{ width: "3vw", height: "0.4vh", backgroundColor: "#E05C2A" }} />
            <div style={{ width: "1.5vw", height: "0.4vh", backgroundColor: "#1C2541", opacity: 0.3 }} />
            <div style={{ width: "0.8vw", height: "0.4vh", backgroundColor: "#1C2541", opacity: 0.2 }} />
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "2vh 8vw",
            fontFamily: "'DM Mono', monospace",
            fontSize: "0.95vw",
            maxWidth: "52vw",
            borderTop: "0.1vh solid #E0E0E0",
            paddingTop: "3vh",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: "0.8vh" }}>
            <span style={{ color: "#888888", fontSize: "0.8vw", textTransform: "uppercase", letterSpacing: "0.08em" }}>Versions:</span>
            <span style={{ fontWeight: 500, color: "#1C2541" }}>Cloud + LAN Desktop</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.8vh" }}>
            <span style={{ color: "#888888", fontSize: "0.8vw", textTransform: "uppercase", letterSpacing: "0.08em" }}>Audience:</span>
            <span style={{ fontWeight: 500, color: "#1C2541" }}>Indian Businesses</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.8vh" }}>
            <span style={{ color: "#888888", fontSize: "0.8vw", textTransform: "uppercase", letterSpacing: "0.08em" }}>Powered by:</span>
            <span style={{ fontWeight: 600, color: "#E05C2A" }}>NAEWTGROUP.COM</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.8vh" }}>
            <span style={{ color: "#888888", fontSize: "0.8vw", textTransform: "uppercase", letterSpacing: "0.08em" }}>Version:</span>
            <span style={{ fontWeight: 500, color: "#1C2541" }}>2026</span>
          </div>
        </div>
      </div>
    </div>
  );
}
