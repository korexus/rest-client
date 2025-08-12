import { expect } from 'chai';
import { isObject, objectMap } from './objectHelpers';

describe('isObject', () => {
  it('should return true for an object', () => {
    const check = isObject({});
    expect(check).to.be.true;
  });

  it('should return false for an array', () => {
    const check = isObject([]);
    expect(check).to.be.false;
  });

  it('should return false for a function', () => {
    const check = isObject(() => {});
    expect(check).to.be.false;
  });

  it('should return false for a string', () => {
    const check = isObject('');
    expect(check).to.be.false;
  });

  it('should return false for a number', () => {
    const check = isObject(3);
    expect(check).to.be.false;
  });
});

describe('object map', () => {
  it('should return original object unchanged', () => {
    const obj = { a: 1, b: 'c', key: null };
    const identityTransform = ([k, v]: [string, any]) => [k, v];
    const mapped = objectMap(obj, identityTransform);
    expect(mapped).to.deep.equal({ a: 1, b: 'c', key: null });
  });

  it('should allow changing the values', () => {
    const obj = { a: 1, b: 2, c: 3 };
    const double = ([k, v]: [string, any]) => [k, v * 2];
    const mapped = objectMap(obj, double);
    expect(mapped).to.deep.equal({ a: 2, b: 4, c: 6 });
  });

  it('should allow remapping the keys', () => {
    const obj = { a: 1, b: 2, c: 3 };
    const rename = ([k, v]: [string, any]) => [`${k}1`, v];
    const mapped = objectMap(obj, rename);
    expect(mapped).to.deep.equal({ a1: 1, b1: 2, c1: 3 });
  });
});
