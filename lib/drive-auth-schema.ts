import {z} from 'zod';
export const DriveAuthSchema=z.object({id:z.literal('connection'),sealed:z.string().min(30).max(16000).regex(/^v1\.[A-Za-z0-9+/=]+\.[A-Za-z0-9+/=]+$/)});
