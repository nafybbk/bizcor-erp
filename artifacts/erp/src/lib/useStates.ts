import { useState, useEffect } from "react";
import { api } from "./api";

export interface StateOption { name: string; code: string; }

export const ALL_STATES: StateOption[] = [
  { name: "Andhra Pradesh", code: "37" }, { name: "Arunachal Pradesh", code: "12" },
  { name: "Assam", code: "18" }, { name: "Bihar", code: "10" }, { name: "Chhattisgarh", code: "22" },
  { name: "Delhi", code: "07" }, { name: "Goa", code: "30" }, { name: "Gujarat", code: "24" },
  { name: "Haryana", code: "06" }, { name: "Himachal Pradesh", code: "02" },
  { name: "Jammu & Kashmir", code: "01" }, { name: "Jharkhand", code: "20" },
  { name: "Karnataka", code: "29" }, { name: "Kerala", code: "32" }, { name: "Ladakh", code: "38" },
  { name: "Madhya Pradesh", code: "23" }, { name: "Maharashtra", code: "27" },
  { name: "Manipur", code: "14" }, { name: "Meghalaya", code: "17" }, { name: "Mizoram", code: "15" },
  { name: "Nagaland", code: "13" }, { name: "Odisha", code: "21" }, { name: "Punjab", code: "03" },
  { name: "Rajasthan", code: "08" }, { name: "Sikkim", code: "11" }, { name: "Tamil Nadu", code: "33" },
  { name: "Telangana", code: "36" }, { name: "Tripura", code: "16" }, { name: "Uttar Pradesh", code: "09" },
  { name: "Uttarakhand", code: "05" }, { name: "West Bengal", code: "19" },
  { name: "Andaman & Nicobar Islands", code: "35" }, { name: "Chandigarh", code: "04" },
  { name: "Dadra & Nagar Haveli", code: "26" }, { name: "Daman & Diu", code: "25" },
  { name: "Lakshadweep", code: "31" }, { name: "Puducherry", code: "34" },
];

let _cache: StateOption[] | null = null;

export function useStates(): StateOption[] {
  const [states, setStates] = useState<StateOption[]>(_cache || ALL_STATES);

  useEffect(() => {
    if (_cache) { setStates(_cache); return; }
    api.get<any>("/masters/states")
      .then(r => {
        const data: any[] = r.data || [];
        if (data.length > 0) {
          const mapped = data
            .filter((s: any) => s.stateName && s.stateCode)
            .map((s: any) => ({ name: s.stateName, code: s.stateCode }));
          if (mapped.length > 0) {
            _cache = mapped;
            setStates(mapped);
          }
        }
      })
      .catch(() => {});
  }, []);

  return states;
}
