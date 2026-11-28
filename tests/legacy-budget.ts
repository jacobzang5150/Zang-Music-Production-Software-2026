import {createBudget as seed} from '../lib/budget.ts';
export * from '../lib/budget.ts';
export const createBudget=(p:Parameters<typeof seed>[0])=>seed(p,true);
