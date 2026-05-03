import { useEffect, useState } from "react";
import { api, fmt } from "@/lib/api";
import { Loader2, Download } from "lucide-react";
import PartySelect from "@/components/PartySelect";

export default function PartyLedger() {
  const [parties, setParties] = useState<any[]>([]);
  const [selectedParty, setSelectedParty] = useState<any>(null);
  const [ledger, setLedger] = useState<any>(null);
  const [partySearch, setPartySearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  useEffect(() => {
    api.get<any>("/parties?limit=200").then(r => setParties(r.data || [])).catch(console.error);
  }, []);

  const loadLedger = (partyId: number) => {
    setLoading(true);
    const params = new URLSearchParams();
    if (fromDate) params.set("fromDate", fromDate);
    if (toDate) params.set("toDate", toDate);
    api.get<any>(`/accounting/ledger/${partyId}?${params}`)
      .then(setLedger).catch(console.error).finally(() => setLoading(false));
  };

  const selectParty = (p: any) => {
    setSelectedParty(p);
    setPartySearch(p.name);
    loadLedger(p.id);
  };

  useEffect(() => {
    if (selectedParty) loadLedger(selectedParty.id);
  }, [fromDate, toDate]);


  return (
    <div className="max-w-5xl space-y-4">
      <h1 className="text-2xl font-bold text-gray-900">Party Ledger</h1>

      <div className="bg-white rounded-xl border border-gray-200 p-5 flex flex-wrap gap-4">
        <div className="flex-1 min-w-48">
          <label className="block text-sm font-medium text-gray-700 mb-1">Select Party</label>
          <PartySelect
            parties={parties}
            value={partySearch}
            onSelect={selectParty}
            placeholder="Search party..."
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">From Date</label>
          <input type="date" className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={fromDate} onChange={e => setFromDate(e.target.value)} />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">To Date</label>
          <input type="date" className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={toDate} onChange={e => setToDate(e.target.value)} />
        </div>
      </div>

      {loading && <div className="flex items-center justify-center h-48"><Loader2 className="w-5 h-5 animate-spin text-blue-500" /></div>}

      {ledger && !loading && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-gray-900">{ledger.party?.name}</h2>
              {ledger.party?.gstin && <div className="text-xs text-gray-400 font-mono">GSTIN: {ledger.party.gstin}</div>}
            </div>
            <div className="text-right">
              <div className="text-sm text-gray-500">Closing Balance</div>
              <div className={`text-lg font-bold ${ledger.closingBalance >= 0 ? "text-blue-700" : "text-green-700"}`}>
                {fmt.currency(Math.abs(ledger.closingBalance))} {ledger.closingBalance >= 0 ? "Dr" : "Cr"}
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-600">
                <tr>
                  <th className="text-left px-4 py-3 font-medium">Date</th>
                  <th className="text-left px-4 py-3 font-medium">Type</th>
                  <th className="text-left px-4 py-3 font-medium">Reference</th>
                  <th className="text-right px-4 py-3 font-medium">Debit (Dr)</th>
                  <th className="text-right px-4 py-3 font-medium">Credit (Cr)</th>
                  <th className="text-right px-4 py-3 font-medium">Balance</th>
                </tr>
              </thead>
              <tbody>
                <tr className="bg-blue-50">
                  <td className="px-4 py-2.5 text-gray-600" colSpan={3}>Opening Balance</td>
                  <td className="px-4 py-2.5 text-right font-medium">{ledger.openingBalance >= 0 ? fmt.currency(ledger.openingBalance) : ""}</td>
                  <td className="px-4 py-2.5 text-right font-medium">{ledger.openingBalance < 0 ? fmt.currency(-ledger.openingBalance) : ""}</td>
                  <td className="px-4 py-2.5 text-right font-semibold">
                    {fmt.currency(Math.abs(ledger.openingBalance))} {ledger.openingBalance >= 0 ? "Dr" : "Cr"}
                  </td>
                </tr>
                {(ledger.entries || []).map((e: any, i: number) => (
                  <tr key={i} className="border-t border-gray-50 hover:bg-gray-50">
                    <td className="px-4 py-2.5 text-gray-600">{fmt.date(e.date)}</td>
                    <td className="px-4 py-2.5 capitalize text-xs text-gray-500">{e.voucherType?.replace(/_/g, " ")}</td>
                    <td className="px-4 py-2.5 font-mono text-xs text-blue-600">{e.voucherNumber}</td>
                    <td className="px-4 py-2.5 text-right text-blue-700">{e.debit > 0 ? fmt.currency(e.debit) : ""}</td>
                    <td className="px-4 py-2.5 text-right text-green-700">{e.credit > 0 ? fmt.currency(e.credit) : ""}</td>
                    <td className="px-4 py-2.5 text-right font-semibold text-gray-900">
                      {fmt.currency(Math.abs(e.balance))} {e.balance >= 0 ? "Dr" : "Cr"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!selectedParty && !loading && (
        <div className="text-center py-16 text-gray-400 bg-white rounded-xl border border-gray-200">
          <div className="text-4xl mb-3">📒</div>
          <div className="font-medium">Select a party to view their ledger</div>
        </div>
      )}
    </div>
  );
}
