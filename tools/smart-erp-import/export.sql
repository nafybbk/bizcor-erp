-- ═══════════════════════════════════════════════════════════════════
--  SMART ERP → BizCor  |  Data Export Script
--  SSMS mein chalao:
--    1. Is script ko SSMS mein open karo
--    2. Database: AHK select karo (top-left dropdown)
--    3. Results to Text: Menu → Query → Results To → Results to Text  (Ctrl+T)
--    4. F5 dabao (Run)
--    5. Results pane mein right-click → Save Results As → ahk_export.json
--    6. Woh file import tool mein upload karo
-- ═══════════════════════════════════════════════════════════════════

SET NOCOUNT ON;

SELECT (
  SELECT TOP 1
    CompanyNameE  AS company,
    BranchName    AS branch,
    CurBrCode     AS branchCode
  FROM dbo.PrgSetup
  FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
) AS meta,

(
  SELECT
    h.DocNo        AS docNo,
    h.DateG        AS date,
    h.CustCode     AS partyCode,
    h.CustName     AS partyName,
    h.NetTotal     AS grandTotal,
    (
      SELECT
        d.ItemCode   AS itemCode,
        d.ItemNameE  AS itemName,
        d.Qty        AS qty,
        d.SalesPrice AS rate,
        d.DiscPer    AS discPer
      FROM dbo.TxDetailp d
      WHERE d.DocNo = h.DocNo
      FOR JSON PATH
    ) AS items
  FROM dbo.TxHeaderP h
  FOR JSON PATH
) AS salesInvoices,

(
  SELECT
    h.DocNo      AS docNo,
    h.DateG      AS date,
    h.SupCode    AS partyCode,
    h.SupName    AS partyName,
    h.TotalVal   AS grandTotal,
    h.RDocNo     AS supplierBillNo,
    (
      SELECT
        d.ItemCode  AS itemCode,
        d.ItemNameE AS itemName,
        d.Qty       AS qty,
        d.PurPrice  AS rate,
        d.DiscPer   AS discPer
      FROM dbo.pGRNTrx d
      WHERE d.DocNo = h.DocNo
      FOR JSON PATH
    ) AS items
  FROM dbo.pGRNHead h
  FOR JSON PATH
) AS purchaseBills,

(
  SELECT
    v.VouNo      AS vouNo,
    v.DateG      AS date,
    v.CustCode   AS partyCode,
    v.CustName   AS partyName,
    v.TotalAmt   AS amount,
    (
      SELECT
        d.InvNo          AS invNo,
        d.CurrentPayment AS amount
      FROM dbo.ReceiptVoucherDetP d
      WHERE d.VouNo = v.VouNo
      FOR JSON PATH
    ) AS allocations
  FROM dbo.ReceiptVoucher v
  FOR JSON PATH
) AS receipts,

(
  SELECT
    v.VouNo      AS vouNo,
    v.DateG      AS date,
    v.SupCode    AS partyCode,
    v.SupName    AS partyName,
    v.TotalAmt   AS amount,
    (
      SELECT
        d.InvNo          AS invNo,
        d.CurrentPayment AS amount
      FROM dbo.PaymentVoucherDetP d
      WHERE d.VouNo = v.VouNo
      FOR JSON PATH
    ) AS allocations
  FROM dbo.PaymentVoucher v
  FOR JSON PATH
) AS supplierPayments

FOR JSON PATH, WITHOUT_ARRAY_WRAPPER;
