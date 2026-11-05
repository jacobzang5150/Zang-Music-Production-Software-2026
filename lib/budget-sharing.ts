import {z} from 'zod';
import type {Budget} from './budget.ts';
export type BudgetProject={id:string;client:string;name:string};
export type SavedBudget=Budget&{revision:number;budgetKey?:string;linkedProjects?:BudgetProject[];availableProjects?:BudgetProject[]};
export const BudgetLinkSchema=z.object({id:z.string().min(1).max(80),action:z.enum(['link','unlink']),targetId:z.string().min(1).max(80).optional(),revision:z.number().int().positive(),budgetKey:z.string().min(1).max(200)}).refine(p=>p.action!=='link'||!!p.targetId&&p.targetId!==p.id,'Choose another project.');
export function sameBudgetVersion(a:SavedBudget,b:SavedBudget){return a.budgetKey===b.budgetKey&&a.revision===b.revision}

export function budgetHeading(project:BudgetProject,budget?:SavedBudget|null):BudgetProject{
 const members=budget?.linkedProjects||[];
 if(members.length<2)return project;
 return {...project,client:[...new Set(members.map(p=>p.client))].join(' / '),name:members.map(p=>p.name).join(', ')};
}
