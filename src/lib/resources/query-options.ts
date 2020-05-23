import buildQuery, { alias, Alias } from './builder';
import { PlainObject } from './builder';
//import buildQuery from 'odata-query';

import { isoStringToDate, Types, escapeIllegalChars } from '../utils/index';

export enum QueryOptionTypes {
  // System options
  select = 'select',
  filter = 'filter',
  search = 'search',
  transform = 'transform',
  orderBy = 'orderBy',
  top = 'top',
  skip = 'skip',
  skiptoken = 'skiptoken',
  expand = 'expand',
  format = 'format',
  // Custom options
  custom = 'custom',
  // Parameter aliases
  aliases = 'aliases'
}

export class ODataQueryOptions {
  // URL QUERY PARTS
  public static readonly PARAM_SEPARATOR = '&';
  public static readonly VALUE_SEPARATOR = '=';

  options?: PlainObject;

  constructor(options?: PlainObject) {
    this.options = options || {};
  }

  // Params
  params(): PlainObject {
    let options = [
      QueryOptionTypes.select,
      QueryOptionTypes.filter,
      QueryOptionTypes.search,
      QueryOptionTypes.transform,
      QueryOptionTypes.orderBy,
      QueryOptionTypes.top,
      QueryOptionTypes.skip,
      QueryOptionTypes.skiptoken,
      QueryOptionTypes.expand,
      QueryOptionTypes.format,
      QueryOptionTypes.aliases]
        .filter(key => !Types.isEmpty(this.options[key]))
        .reduce((acc, key) => Object.assign(acc, {[key]: this.options[key]}), {});

    let query = buildQuery(options);
    let params = (query)? query
      .split(ODataQueryOptions.PARAM_SEPARATOR)
      .reduce((acc, param: string) => {
        let index = param.indexOf(ODataQueryOptions.VALUE_SEPARATOR);
        let name = param.substr(1, index - 1);
        let values = param.substr(index + 1);
        return Object.assign(acc, {[name]: values});
      }, {}) : {};

    // Custom
    let custom = this.options[QueryOptionTypes.custom] || {};
    Object.assign(params, custom);

    return params;
  }

  toJSON() {
    return isoStringToDate(JSON.parse(JSON.stringify(this.options)));
  }

  clone() {
    return new ODataQueryOptions(this.toJSON());
  }

  // Option Handler
  option<T>(type: QueryOptionTypes, opts?: T) {
    if (!Types.isUndefined(opts))
      this.options[type] = opts;
    return new OptionHandler<T>(this.options, type);
  }

  // Query Options tools
  has(type: QueryOptionTypes) {
    return !Types.isUndefined(this.options[type]);
  }

  remove(...types: QueryOptionTypes[]) {
    types.forEach(type => this.option(type).clear());
  }

  keep(...types: QueryOptionTypes[]) {
    this.options = Object.keys(this.options)
      .filter((k: QueryOptionTypes) => types.indexOf(k) !== -1)
      .reduce((acc, k) => Object.assign(acc, { [k]: this.options[k] }), {});
  }

  // Aliases
  alias(name: string, value?: any): Alias {
    let aliases = (this.options[QueryOptionTypes.aliases] || (this.options[QueryOptionTypes.aliases] = [])) as Alias[];
    let a = aliases.find(a => a.name === name);
    if (Types.isUndefined(value)) {
      return a;
    } else if (a === undefined) {
      a = alias(name, value);
      aliases.push(a);
    } else {
      a.value = value;
    }
    return a;
  }

  // Clear
  clear() {
    this.options = {};
  }
}

export class OptionHandler<T> {
  constructor(private o: PlainObject, private t: QueryOptionTypes) { }

  get name() {
    return this.t;
  }

  toJSON() {
    return this.o[this.t];
  }

  // Primitive value
  value() {
    return this.o[this.t];
  }

  // Array
  private assertArray(): Array<any> {
    if (!Types.isArray(this.o[this.t]))
      this.o[this.t] = !Types.isUndefined(this.o[this.t]) ? [this.o[this.t]] : [];
    return this.o[this.t];
  }

  push(value: T) {
    this.assertArray().push(value);
  }

  remove(value: T) {
    this.o[this.t] = this.assertArray().filter(v => v !== value);
    // If only one... down to value
    if (this.o[this.t].length === 1)
      this.o[this.t] = this.o[this.t][0];
  }

  at(index: number) {
    return this.assertArray()[index];
  }

  // Hash map
  private assertObject(): PlainObject {
    if (!Types.isArray(this.o[this.t]) && Types.isObject(this.o[this.t])) {
      return this.o[this.t];
    }
    let arr = this.assertArray();
    let obj = arr.find(v => Types.isObject(v));
    if (!obj) {
      obj = {};
      arr.push(obj);
    }
    return obj;
  }

  set(name: string, value: T) {
    this.assertObject()[name] = value;
  }

  get(name: string): T {
    if (!Types.isArray(this.o[this.t])) {
      return this.o[this.t][name];
    }
  }

  unset(name: string) {
    delete this.assertObject()[name];
    if (Types.isArray(this.o[this.t])) {
      this.o[this.t] = this.o[this.t].filter(v => !Types.isEmpty(v));
      if (this.o[this.t].length === 1)
        this.o[this.t] = this.o[this.t][0];
    }
  }

  has(name: string) {
    return !!this.get(name);
  }

  assign(values: PlainObject) {
    Object.assign(this.assertObject(), values);
  }

  clear() {
    delete this.o[this.t];
  }
}