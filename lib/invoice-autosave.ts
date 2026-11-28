import type {SavedInvoice} from './invoice.ts';
/** Rebase edits made during an in-flight save onto its confirmed revision/amounts. */
export function rebaseInvoiceEdits(current:SavedInvoice,saved:SavedInvoice):SavedInvoice{
 const selected=new Map(current.lines.map(line=>[line.id,line.included]));
 return {...saved,billTo:current.billTo,amountReceived:current.amountReceived,lines:saved.lines.map(line=>({...line,included:selected.get(line.id)??line.included}))};
}
