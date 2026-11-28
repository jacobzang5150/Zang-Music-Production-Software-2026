import type {BudgetModel} from './budget-model';
export function preset(model:BudgetModel):BudgetModel{return {...model,estimate:null,notes:'',sessions:[],sections:model.sections.map(s=>({...s,rows:s.rows.map(r=>({...r,quantity:null}))}))}}
