import assert from 'node:assert/strict';
import {CreativeFactory,createRuleBasedCopyGenerator} from './creative-factory.mjs';
let renders=0;
const factory=new CreativeFactory({copyGenerator:createRuleBasedCopyGenerator(),visualRenderer:async({concept})=>{renders++;return{id:`asset-${renders}`,url:`https://assets.test/${renders}.jpg`,concept}}});
const c=await factory.create({campaign:{products:['P1']},product:{name:'Кресло'},audience:{segment:'новосёлы'},angle:'уют',format:'image',channel:'eineiro_market'});assert.equal(c.renderStatus,'ready');assert.ok(c.assetUrl);assert.ok(c.headline.includes('Кресло'));
const m=await factory.mutate({parent:{variant:'A',channel:'eineiro_market',format:'image'},performance:{ctr:.01,conversion:.05},campaign:{products:['P1']},product:{name:'Кресло'}});assert.equal(m.renderStatus,'ready');assert.equal(renders,2);
console.log('EINEIRO creative factory tests: OK');
