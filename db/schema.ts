import {sqliteTable,text,integer} from 'drizzle-orm/sqlite-core';
export const projects=sqliteTable('projects',{id:text('id').primaryKey(),owner:text('owner').notNull(),data:text('data').notNull(),revision:integer('revision').notNull().default(1)});
