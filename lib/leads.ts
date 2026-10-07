import {z} from 'zod';
export const LeadSchema=z.object({id:z.string().min(1).max(80),name:z.string().trim().min(1,'Enter a client name.').max(120,'Client names must be 120 characters or fewer.')});
export type Lead=z.infer<typeof LeadSchema>&{revision:number};
