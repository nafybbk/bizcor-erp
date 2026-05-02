import VoucherForm from "@/components/VoucherForm";

export default function InvoiceCreate() {
  return (
    <VoucherForm
      voucherType="sales/invoices"
      title="Sales Invoice"
      listHref="/sales/invoices"
    />
  );
}
