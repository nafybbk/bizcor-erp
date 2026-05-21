export default function Slide02Problem() {
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
          Aaj Ka Problem
        </h2>
        <div style={{ fontFamily: "'DM Mono', monospace", fontSize: "0.9vw", opacity: 0.7, textTransform: "uppercase", letterSpacing: "0.1em" }}>
          bizcor erp
        </div>
      </div>

      <div
        style={{
          flex: 1,
          padding: "7vh 8vw",
          boxSizing: "border-box",
          display: "flex",
          flexDirection: "row",
          gap: "6vw",
          alignItems: "stretch",
        }}
      >
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "3.5vh" }}>
          <div style={{ display: "flex", gap: "2vw", alignItems: "flex-start" }}>
            <div style={{ fontFamily: "'DM Mono', monospace", color: "#E05C2A", fontSize: "1vw", fontWeight: 500, minWidth: "3vw", paddingTop: "0.4vh" }}>01</div>
            <div>
              <div style={{ fontSize: "1.5vw", fontWeight: 700, color: "#1C2541", marginBottom: "0.8vh" }}>Manual Ledgers aur Excel</div>
              <div style={{ fontSize: "1.1vw", color: "#555555", lineHeight: 1.6 }}>Har entry haath se, har mahine naya file — time waste aur galtiyon ka darr</div>
            </div>
          </div>

          <div style={{ display: "flex", gap: "2vw", alignItems: "flex-start" }}>
            <div style={{ fontFamily: "'DM Mono', monospace", color: "#E05C2A", fontSize: "1vw", fontWeight: 500, minWidth: "3vw", paddingTop: "0.4vh" }}>02</div>
            <div>
              <div style={{ fontSize: "1.5vw", fontWeight: 700, color: "#1C2541", marginBottom: "0.8vh" }}>GST Filing Ka Dard</div>
              <div style={{ fontSize: "1.1vw", color: "#555555", lineHeight: 1.6 }}>Har mahine manually data nikalna, CA ke paas bhejna — waqt aur paisa dono</div>
            </div>
          </div>

          <div style={{ display: "flex", gap: "2vw", alignItems: "flex-start" }}>
            <div style={{ fontFamily: "'DM Mono', monospace", color: "#E05C2A", fontSize: "1vw", fontWeight: 500, minWidth: "3vw", paddingTop: "0.4vh" }}>03</div>
            <div>
              <div style={{ fontSize: "1.5vw", fontWeight: 700, color: "#1C2541", marginBottom: "0.8vh" }}>Data Loss Ka Darr</div>
              <div style={{ fontSize: "1.1vw", color: "#555555", lineHeight: 1.6 }}>Ek baar PC kharab hua — saalon ka data gone. Koi backup nahi, koi recovery nahi</div>
            </div>
          </div>
        </div>

        <div style={{ width: "0.1vw", backgroundColor: "#E0E0E0", alignSelf: "stretch" }} />

        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "3.5vh" }}>
          <div style={{ display: "flex", gap: "2vw", alignItems: "flex-start" }}>
            <div style={{ fontFamily: "'DM Mono', monospace", color: "#E05C2A", fontSize: "1vw", fontWeight: 500, minWidth: "3vw", paddingTop: "0.4vh" }}>04</div>
            <div>
              <div style={{ fontSize: "1.5vw", fontWeight: 700, color: "#1C2541", marginBottom: "0.8vh" }}>Alag Alag Files</div>
              <div style={{ fontSize: "1.1vw", color: "#555555", lineHeight: 1.6 }}>Stock ka alag file, ledger alag, GST alag — koi central system nahi</div>
            </div>
          </div>

          <div style={{ display: "flex", gap: "2vw", alignItems: "flex-start" }}>
            <div style={{ fontFamily: "'DM Mono', monospace", color: "#E05C2A", fontSize: "1vw", fontWeight: 500, minWidth: "3vw", paddingTop: "0.4vh" }}>05</div>
            <div>
              <div style={{ fontSize: "1.5vw", fontWeight: 700, color: "#1C2541", marginBottom: "0.8vh" }}>Mehnga Software</div>
              <div style={{ fontSize: "1.1vw", color: "#555555", lineHeight: 1.6 }}>Bade brands ke software — chhote aur medium business ke budget se bahar</div>
            </div>
          </div>

          <div
            style={{
              marginTop: "auto",
              backgroundColor: "#F5F7FA",
              borderLeft: "0.4vw solid #E05C2A",
              padding: "2.5vh 2vw",
            }}
          >
            <div style={{ fontSize: "1.3vw", fontWeight: 600, color: "#1C2541", lineHeight: 1.5 }}>
              BizCor in sab problems ka ek solution hai.
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
        <span>02</span>
      </div>
    </div>
  );
}
