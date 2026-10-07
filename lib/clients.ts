import {z} from 'zod';
export const ClientSchema=z.object({id:z.string().min(1).max(80),name:z.string().trim().min(1,'Enter a client name.').max(120)});
export type Client=z.infer<typeof ClientSchema>&{revision:number};
