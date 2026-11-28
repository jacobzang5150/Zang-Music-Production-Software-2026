import {z} from 'zod';
export const settingsSchema=z.object({first:z.string().trim().min(1).max(80),last:z.string().trim().min(1).max(80),mode:z.enum(['dark','light']),palette:z.enum(['crimson','teal','violet']),font:z.enum(['studio','system','editorial']),autoFolders:z.boolean(),publicFolders:z.boolean(),folders:z.array(z.string().trim().min(1).max(80)).max(12).transform(v=>[...new Set(v)])});
export type StudioSettings=z.infer<typeof settingsSchema>;
export const defaults:StudioSettings={first:'',last:'',mode:'dark',palette:'crimson',font:'studio',autoFolders:false,publicFolders:false,folders:['EDITS','MIXES','MASTERS']};
