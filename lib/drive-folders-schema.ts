import {z} from 'zod';
const driveId=z.string().regex(/^[\w-]+$/).max(200);
export const DriveFolderSchema=z.object({
 id:z.string().regex(/^[a-f0-9]{64}$/),account:driveId,folderId:driveId,
 parent:driveId,name:z.string().trim().min(1).max(200),mayCreate:z.boolean(),
});
export type FolderReservation=z.infer<typeof DriveFolderSchema>;
export const DriveLinkSchema=z.object({projectId:z.string().min(1).max(80),reservationId:z.string().regex(/^[a-f0-9]{64}$/),expectedUrl:z.string().max(2048)});
