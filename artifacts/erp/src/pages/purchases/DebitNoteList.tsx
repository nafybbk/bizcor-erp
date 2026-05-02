import VoucherList from "@/components/VoucherList";

export default function DebitNoteList() {
  return (
    <VoucherList
      voucherType="purchases/debit-notes"
      title="Debit Notes"
      createHref="/purchases/debit-notes/new"
      viewHref={(id) => `/purchases/debit-notes/${id}`}
    />
  );
}
