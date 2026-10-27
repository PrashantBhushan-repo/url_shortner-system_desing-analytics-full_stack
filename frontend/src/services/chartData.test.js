import assert from 'node:assert/strict';
import { test } from 'node:test';
import { pieBreakdown } from './chartData.js';

test('pie data combines duplicate categories and excludes invalid counts', () => {
  const data=pieBreakdown([{device:'Mobile',count:3},{device:'Mobile',count:'2'},{device:null,count:1},{device:'Bot',count:-1},{device:'Broken',count:'bad'}],'device');
  assert.equal(data.total,6);
  assert.deepEqual(data.slices.map(({name,value})=>({name,value})),[{name:'Mobile',value:5},{name:'Unknown',value:1}]);
});
test('small categories group without losing counts', () => {
  const data=pieBreakdown(Array.from({length:10},(_,i)=>({name:`Source ${i}`,count:i+1})));
  assert.equal(data.total,55); assert.equal(data.slices.length,6);
  assert.equal(data.slices.at(-1).name,'Remaining categories');
  assert.equal(data.slices.reduce((sum,item)=>sum+item.value,0),55);
});
test('empty activity never creates a fictional slice', () => {
  assert.deepEqual(pieBreakdown([{name:'Mobile',count:0}]),{total:0,slices:[]});
});
