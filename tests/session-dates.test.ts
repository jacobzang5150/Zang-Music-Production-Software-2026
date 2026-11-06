import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseSessionDate,sessionDateValue,sessionDateLabel,sessionCalendarDays,shiftSessionMonth} from '../lib/session-dates.ts';
test('selected dates preserve their local calendar day across DST and year boundaries',()=>{
 for(const value of ['2026-03-08','2026-11-01','2026-12-31','2027-01-01','2024-02-29','0001-01-01']){const date=parseSessionDate(value);assert.ok(date);assert.equal(sessionDateValue(date),value)}
});
test('invalid and legacy dates are never silently normalized or lost',()=>{
 for(const value of ['', '2026-02-29','2026-04-31','2026-13-01','2026-00-01','2026-01-00','0000-01-01','November 5 - studio'])assert.equal(parseSessionDate(value),null);
 assert.equal(sessionDateLabel('November 5 - studio'),'November 5 - studio');assert.equal(sessionDateLabel(''),'Select date');assert.equal(sessionDateLabel('2026-11-06'),'Nov 6, 2026');
});
test('calendar weeks include complete adjacent-month days in order',()=>{
 const days=sessionCalendarDays(parseSessionDate('2026-11-01')!);assert.equal(days.length,42);assert.equal(days[0].getDay(),0);
 assert.equal(sessionDateValue(days[0]),'2026-11-01');assert.equal(sessionDateValue(days[41]),'2026-12-12');
 assert.equal(new Set(days.map(sessionDateValue)).size,42);
});
test('month and year navigation clamps end-of-month dates safely',()=>{
 assert.equal(sessionDateValue(shiftSessionMonth(parseSessionDate('2026-01-31')!,1)),'2026-02-28');
 assert.equal(sessionDateValue(shiftSessionMonth(parseSessionDate('2024-01-31')!,1)),'2024-02-29');
 assert.equal(sessionDateValue(shiftSessionMonth(parseSessionDate('2024-02-29')!,12)),'2025-02-28');
 assert.equal(sessionDateValue(shiftSessionMonth(parseSessionDate('2026-01-31')!,-1)),'2025-12-31');
});
