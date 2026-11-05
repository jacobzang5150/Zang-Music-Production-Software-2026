import {test} from 'node:test';
import assert from 'node:assert/strict';
import {BudgetSchema,createBudget} from '../lib/budget.ts';
import {signGatewayRequest,verifyGatewayRequest} from '../lib/gateway-auth.ts';
test('budget preserves supplied fields, numeric rates, empty quantities and dependent formulas',()=>{
 const a=createBudget({id:'test',client:'Artist',name:'Record'}),b=createBudget({id:'other',client:'B',name:'EP'});const cells=a.sheets[0].data as Record<string,unknown>[][];
 assert.equal(cells[0][0].v,'Artist - Record');
 assert.deepEqual(cells.slice(3,8).map(row=>row[0].v),['Producer/Engineer','Recording Studio Rental','Studio Musicians','Equipment Rental','Piano Tuning']);
 for(const [row,rate] of [[4,80],[8,200],[12,80],[13,100],[14,50],[15,75],[16,50],[17,25],[23,80],[24,80],[25,80],[26,100]])assert.equal(cells[row-1][4].v,rate);
 for(const row of [4,5,6,7,8,12,13,14,15,16,17,18,23,24,25,26]){assert.equal(cells[row-1][5].v,'');assert.equal(cells[row-1][6].f,`=E${row}*F${row}`)}
 assert.equal(cells[8][6].f,'=SUM(G4:G8)');assert.equal(cells[28][6].f,'=SUM(G9,G19,G27)');assert.equal((a.sheets[0].calcChain as unknown[]).length,20);
 cells[3][4].v=123;assert.equal((b.sheets[0].data as Record<string,unknown>[][])[3][4].v,80);assert.ok(BudgetSchema.safeParse(a).success);
});
test('budget rejects missing sheets and excessive payloads',()=>{assert.equal(BudgetSchema.safeParse({id:'x',sheets:[]}).success,false);assert.equal(BudgetSchema.safeParse({id:'x',sheets:[{name:'Budget',padding:'x'.repeat(2_000_000)}]}).success,false)});
test('large budget requests retain signed ownership and reject tampering',async()=>{
 const pair=await crypto.subtle.generateKey({name:'RSASSA-PKCS1-v1_5',modulusLength:2048,publicExponent:new Uint8Array([1,0,1]),hash:'SHA-256'},true,['sign','verify']);
 const priv=await crypto.subtle.exportKey('jwk',pair.privateKey),pub=await crypto.subtle.exportKey('jwk',pair.publicKey);
 const token=await signGatewayRequest(priv,{owner:'owner',resource:'budgets',action:'save',project:{cells:'x'.repeat(200000)}});assert.equal((await verifyGatewayRequest(pub,token)).owner,'owner');
 const parts=token.split('.');const p=JSON.parse(Buffer.from(parts[1],'base64url').toString());p.owner='other';parts[1]=Buffer.from(JSON.stringify(p)).toString('base64url');await assert.rejects(verifyGatewayRequest(pub,parts.join('.')));
});
