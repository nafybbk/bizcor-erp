import VoucherList from "@/components/VoucherList";

export default function CreditNoteList() {
  return (
    <VoucherList
      voucherType="sales/credit-notes"
      title="Credit Notes"
      createHref="/sales/credit-notes/new"
      viewHref={(id) => `/sales/credit-notes/${id}`}
    />
  );
}
