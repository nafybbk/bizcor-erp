import VoucherList from "@/components/VoucherList";

export default function InvoiceList() {
  return (
    <VoucherList
      voucherType="sales/invoices"
      title="Sales Invoices"
      createHref="/sales/invoices/new"
      viewHref={(id) => `/sales/invoices/${id}`}
      isIncome={true}
    />
  );
}
