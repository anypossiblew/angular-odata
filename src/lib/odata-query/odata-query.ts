import { ODataService } from "../odata-service/odata.service";
import buildQuery from 'odata-query';
import { Utils } from '../utils/utils';
import { Observable } from 'rxjs';
import { ODataSet } from '../odata-response/odata-set';
import { HttpHeaders, HttpParams } from '@angular/common/http';
import { ODataQueryBatch } from './odata-query-batch';

export type PlainObject = { [property: string]: any };
export type Filter = string | PlainObject | Array<string | PlainObject>;
export type NestedExpandOptions = { [key: string]: Partial<ExpandQueryOptions>; };
export type Expand = string | NestedExpandOptions | Array<string | NestedExpandOptions>;
export enum StandardAggregateMethods {
  sum = "sum",
  min = "min",
  max = "max",
  average = "average",
  countdistinct = "countdistinct",
}
export type Aggregate = { [propertyName: string]: { with: StandardAggregateMethods, as: string } } | string;

export interface ExpandQueryOptions {
  select: string | string[];
  filter: Filter;
  orderBy: string | string[];
  top: number;
  expand: Expand;
}
export interface Transform {
  aggregate?: Aggregate | Aggregate[];
  filter?: Filter;
  groupBy?: GroupBy;
}
export interface GroupBy {
  properties: string[];
  transform?: Transform;
}
export interface QueryOptions extends ExpandQueryOptions {
  search: string;
  transform: PlainObject | PlainObject[];
  skip: number;
  key: string | number | PlainObject;
  count: boolean | Filter;
  action: string;
  func: string | { [functionName: string]: { [parameterName: string]: any } };
  format: string;
}

export interface Segment {
  type: string;
  name: string;
  options: PlainObject;
}

export class OptionHandler<T> {
  constructor(private o: PlainObject, private t: string) { }
  get name() {
    return this.t;
  }
  toJSON() {
    return this.o[this.t];
  }

  add(value: T) {
    if (!Array.isArray(this.o[this.t]))
      this.o[this.t] = [this.o[this.t]];
    this.o[this.t].push(value);
  }

  remove(value: T) {
    if (Array.isArray(this.o[this.t])) {
      this.o[this.t] = this.o[this.t].filter(v => v !== value);
      if (this.o[this.t].length === 1)
        this.o[this.t] = this.o[this.t][0];
    }
  }

  at(index: number) {
    if (Array.isArray(this.o[this.t])) {
      return this.o[this.t][index];
    }
  }

  get(name: string): T {
    if (!Array.isArray(this.o[this.t])) {
      return this.o[this.t][name];
    }
  }
  
  private assertObject(): PlainObject {
    if (typeof(this.o[this.t]) === 'object' && !Array.isArray(this.o[this.t]))
      return this.o[this.t];
    else if (!Array.isArray(this.o[this.t]))
      this.o[this.t] = [this.o[this.t]];
    let obj = this.o[this.t].find(v => typeof(v) === 'object');
    if (!obj) {
      obj = {};
      this.o[this.t].push(obj);
    }
    return obj;
  }

  set(name: string, value: T) {
    this.assertObject()[name] = value;
  }

  unset(name: string) {
    delete this.assertObject()[name];
    this.o[this.t] = this.o[this.t].filter(v => !Utils.isEmpty(v));
    if (this.o[this.t].length === 1)
      this.o[this.t] = this.o[this.t][0];
  }

  has(name: string) {
    return !!this.get(name);
  }

  assign(values: PlainObject) {
    Object.assign(this.assertObject(), values);
  }
}

export class SegmentHandler {
  constructor(private segment: Segment) {}
  get name() {
    return this.segment.name;
  }
  get type() {
    return this.segment.type;
  }
  options() {
    return new OptionHandler<string | number | PlainObject>(this.segment as PlainObject, "options");
  }
}

export type ODataObserve = 'body' | 'events' | 'response';

export class ODataQuery {
  // URL QUERY PARTS
  public static readonly SEPARATOR = '&';
  public static readonly PATHSEP = '/';

  // OPTIONS NAMES
  public static readonly SELECT = 'select';
  public static readonly FILTER = 'filter';
  public static readonly SEARCH = 'search';
  public static readonly GROUP_BY = 'groupBy';
  public static readonly TRANSFORM = 'transform';
  public static readonly ORDER_BY = 'orderBy';
  public static readonly TOP = 'top';
  public static readonly SKIP = 'skip';
  public static readonly EXPAND = 'expand';
  public static readonly FORMAT = 'format';

  // SEGMENT NAMES
  public static readonly METADATA = 'metadata';
  public static readonly ENTITY_SET = 'entitySet';
  public static readonly ENTITY_KEY = 'entityKey';
  public static readonly SINGLETON = 'singleton';
  public static readonly TYPE_NAME = 'typeName';
  public static readonly PROPERTY = 'property';
  public static readonly NAVIGATION_PROPERTY = 'navigationProperty';
  public static readonly REF = 'ref';
  public static readonly VALUE = 'value';
  public static readonly COUNT = 'count';
  public static readonly FUNCTION_CALL = 'functionCall';
  public static readonly ACTION_CALL = 'actionCall';

  // CUSTOM OPTIONS
  public static readonly CUSTOM = 'custom';

  // CONSTANT SEGMENTS
  public static readonly $METADATA = '$metadata';
  public static readonly $REF = '$ref';
  public static readonly $VALUE = '$value';
  public static readonly $COUNT = '$count';

  // VARIABLES
  private service: ODataService;
  private segments: Segment[];
  private options: PlainObject;

  constructor(
    service: ODataService,
    segments?: Segment[],
    options?: PlainObject
  ) {
    Utils.requireNotNullNorUndefined(service, 'odataService');
    this.service = service;
    this.segments = segments || [];
    this.options = options || {};
  }

  toString(): string {
    let path = this.path();
    let queryString = Object.entries(this.params())
      .map(e => `${e[0]}=${e[1]}`)
      .join("&");
    return queryString ? `${path}?${queryString}` : path
  }

  batch(): ODataQueryBatch {
    return new ODataQueryBatch(this.service);
  }

  // QUERY EXECUTION
  get<T>(options?: {
    headers?: HttpHeaders | {[header: string]: string | string[]},
    observe?: 'body',
    params?: HttpParams|{[param: string]: string | string[]},
    reportProgress?: boolean,
    responseType?: 'json',
    withCredentials?: boolean,
  }): Observable<T>;

  get<T>(options?: {
    headers?: HttpHeaders | {[header: string]: string | string[]},
    observe?: 'body',
    params?: HttpParams|{[param: string]: string | string[]},
    reportProgress?: boolean,
    responseType?: 'set',
    withCredentials?: boolean,
  }): Observable<ODataSet<T>>;

  get<P>(options?: {
    headers?: HttpHeaders | {[header: string]: string | string[]},
    observe?: 'body',
    params?: HttpParams|{[param: string]: string | string[]},
    reportProgress?: boolean,
    responseType?: 'property',
    withCredentials?: boolean,
  }): Observable<P>;

  get(options: {
    headers?: HttpHeaders | {[header: string]: string | string[]},
    observe?: ODataObserve,
    params?: HttpParams|{[param: string]: string | string[]},
    reportProgress?: boolean,
    responseType?: 'arraybuffer'|'blob'|'json'|'text'|'set'|'property',
    withCredentials?: boolean,
  } = {}): Observable<any> {
    return this.service.request("GET", this, options);
  }

  getSet<T>(options?: {
    headers?: HttpHeaders | {[header: string]: string | string[]},
    params?: HttpParams|{[param: string]: string | string[]},
    reportProgress?: boolean,
    withCredentials?: boolean,
  }): Observable<ODataSet<T>> {
    return this.get<T>({
      headers: options.headers,
      observe: 'body',
      params: options.params,
      responseType: 'set',
      reportProgress: options.reportProgress,
      withCredentials: options.withCredentials
    });
  }

  getProperty<P>(options?: {
    headers?: HttpHeaders | {[header: string]: string | string[]},
    params?: HttpParams|{[param: string]: string | string[]},
    reportProgress?: boolean,
    withCredentials?: boolean,
  }): Observable<P> {
    return this.get<P>({
      headers: options.headers,
      observe: 'body',
      params: options.params,
      responseType: 'property',
      reportProgress: options.reportProgress,
      withCredentials: options.withCredentials
    });
  }

  post<T>(body: any|null, options?: {
    headers?: HttpHeaders | {[header: string]: string | string[]},
    observe?: 'body',
    params?: HttpParams|{[param: string]: string | string[]},
    reportProgress?: boolean,
    responseType?: 'json',
    withCredentials?: boolean,
  }): Observable<T>;

  post<T>(body: any|null, options?: {
    headers?: HttpHeaders | {[header: string]: string | string[]},
    observe?: 'body',
    params?: HttpParams|{[param: string]: string | string[]},
    reportProgress?: boolean,
    responseType?: 'set',
    withCredentials?: boolean,
  }): Observable<ODataSet<T>>;

  post<T>(body: any|null, options?: {
    headers?: HttpHeaders | {[header: string]: string | string[]},
    observe?: 'body',
    params?: HttpParams|{[param: string]: string | string[]},
    reportProgress?: boolean,
    responseType?: 'property',
    withCredentials?: boolean,
  }): Observable<T>;

  post(body: any|null, options: {
    headers?: HttpHeaders | {[header: string]: string | string[]},
    observe?: ODataObserve,
    params?: HttpParams|{[param: string]: string | string[]},
    reportProgress?: boolean,
    responseType?: 'arraybuffer'|'blob'|'json'|'text'|'set'|'property',
    withCredentials?: boolean,
  } = {}): Observable<any> {
    return this.service.request("POST", this, Object.assign(options, {body}));
  }

  patch(body: any|null, etag?: string, options: {
    headers?: HttpHeaders | {[header: string]: string | string[]},
    observe?: ODataObserve,
    params?: HttpParams|{[param: string]: string | string[]},
    reportProgress?: boolean,
    responseType?: 'arraybuffer'|'blob'|'json'|'text'|'set'|'property',
    withCredentials?: boolean,
  } = {}): Observable<any> {
    return this.service.request("PATCH", this, Object.assign(options, {body, etag}));
  }

  put<T>(body: any|null, etag?: string, options?: {
    headers?: HttpHeaders | {[header: string]: string | string[]},
    observe?: 'body',
    params?: HttpParams|{[param: string]: string | string[]},
    reportProgress?: boolean,
    responseType?: 'json',
    withCredentials?: boolean,
  }): Observable<T>;

  put(body: any|null, etag?: string, options: {
    headers?: HttpHeaders | {[header: string]: string | string[]},
    observe?: ODataObserve,
    params?: HttpParams|{[param: string]: string | string[]},
    reportProgress?: boolean,
    responseType?: 'arraybuffer'|'blob'|'json'|'text'|'set'|'property',
    withCredentials?: boolean,
  } = {}): Observable<any> {
    return this.service.request("PUT", this, Object.assign(options, {body, etag}));
  }

  delete (etag?: string, options: {
    headers?: HttpHeaders | {[header: string]: string | string[]},
    observe?: ODataObserve,
    params?: HttpParams|{[param: string]: string | string[]},
    reportProgress?: boolean,
    responseType?: 'arraybuffer'|'blob'|'json'|'text'|'set'|'property',
    withCredentials?: boolean,
  } = {}): Observable<any> {
    return this.service.request("DELETE", this, Object.assign(options, {etag}));
  }

  clone() {
    return new ODataQuery(this.service,
      this.segments.map(segment =>
        ({ type: segment.type, name: segment.name, options: Object.assign({}, segment.options) })),
      Object.assign({}, this.options));
  };

  toJSON() {
    return {
      segments: [...this.segments.map(segment => 
        ({ type: segment.type, name: segment.name, params: Object.assign({}, segment.options) }))],
      params: Object.assign({}, this.options)
    }
  }

  static fromJSON(
    service: ODataService, 
    json: {segments?: Segment[], params?: PlainObject}
  ) {
    return new ODataQuery(service, json.segments || [], json.params || {});
  }

  path(): string {
    let segments = this.segments
      .map(segment => {
        if (segment.type == ODataQuery.FUNCTION_CALL)
          return buildQuery({ func: { [segment.name]: segment.options } }).slice(1);
        return segment.name + buildQuery(segment.options);
      });
    return segments.join(ODataQuery.PATHSEP);
  }

  params(): PlainObject {
    let odata = [
      ODataQuery.SELECT,
      ODataQuery.FILTER,
      ODataQuery.SEARCH,
      ODataQuery.GROUP_BY,
      ODataQuery.TRANSFORM,
      ODataQuery.ORDER_BY,
      ODataQuery.TOP,
      ODataQuery.SKIP,
      ODataQuery.COUNT,
      ODataQuery.EXPAND,
      ODataQuery.FORMAT]
      .filter(key => !Utils.isEmpty(this.options[key]))
      .map(key => buildQuery({ [key]: this.options[key] }))
      .reduce((acc, param: string) => {
        let index = param.indexOf("=");
        let name = param.substr(1, index - 1);
        let values = param.substr(index + 1);
        return Object.assign(acc, {[name]: values});
      }, {});
    return Object.assign(odata, this.options[ODataQuery.CUSTOM] || {});
  }

  // Params
  protected wrapObject<T>(type: string, opts?: T | T[]) {
    if (Utils.isUndefined(this.options[type]))
      this.options[type] = {};
    if (!Utils.isUndefined(opts))
      this.options[type] = opts;
    return new OptionHandler<T>(this.options, type);
  }

  protected wrapValue<T>(type: string, opts?: T) {
    if (Utils.isUndefined(opts))
      return this.options[type];
    this.options[type] = opts;
  }

  protected hasOption(type) {
    return !Utils.isUndefined(this.options[type]);
  }
  protected removeOption(type) {
    delete this.options[type];
  }

  // Segments
  protected findSegment(type: string, name?: string) {
    return this.segments.find(s => 
      s.type === type && 
      (Utils.isUndefined(name) || s.name === name));
  }

  protected wrapSegment(type: string, name?: string) {
    let segment = this.findSegment(type, name);
    if (!segment && !Utils.isUndefined(name)) {
      segment = { type, name, options: {} } as Segment;
      this.segments.push(segment);
    }
    return new SegmentHandler(segment);
  }

  protected hasSegment(type: string, name?: string) {
    return !!this.findSegment(type, name);
  }

  protected removeSegment(type: string, name?: string) {
    let segment = this.findSegment(type, name);
    this.segments = this.segments.filter(s => s !== segment);
  }

  protected lastSegment(): SegmentHandler {
    if (this.segments.length > 0)
      return new SegmentHandler(this.segments[this.segments.length - 1]);
  }

  protected is(type: string) {
    return this.lastSegment().type === type;
  }

  // Options
  select(opts?: string | string[]) {
    return this.wrapObject<string>(ODataQuery.SELECT, typeof (opts) === 'string' ? [opts] : opts);
  }
  hasSelect() {
    return this.hasOption(ODataQuery.SELECT);
  }
  removeSelect() {
    this.removeOption(ODataQuery.SELECT);
  }
  search(opts?: string) {
    return this.wrapValue<string>(ODataQuery.SEARCH, opts);
  }
  hasSearch() {
    return this.hasOption(ODataQuery.SEARCH);
  }
  removeSearch() {
    this.removeOption(ODataQuery.SEARCH);
  }
  filter(opts?: Filter): OptionHandler<Filter> {
    opts = typeof (opts) === 'string' ? [opts] : opts;
    return this.wrapObject<Filter>(ODataQuery.FILTER, opts);
  }
  removeFilter() {
    this.removeOption(ODataQuery.FILTER);
  }
  groupBy(opts?: GroupBy) {
    return this.wrapObject(ODataQuery.GROUP_BY, opts);
  }
  removeGroupBy() {
    this.removeOption(ODataQuery.GROUP_BY);
  }
  transform(opts?: Transform) {
    return this.wrapObject(ODataQuery.TRANSFORM, opts);
  }
  removeTransform() {
    this.removeOption(ODataQuery.TRANSFORM);
  }
  orderBy(opts?: string | string[]) {
    opts = typeof (opts) === 'string' ? [opts] : opts;
    return this.wrapObject<string>(ODataQuery.ORDER_BY, opts);
  }
  removeOrderBy() { 
    this.removeOption(ODataQuery.ORDER_BY); 
  }
  expand(opts?: Expand): OptionHandler<Expand> {
    opts = typeof (opts) === 'string' ? [opts] : opts;
    return this.wrapObject<Expand>(ODataQuery.EXPAND, opts);
  }
  hasExpand() {
    return this.hasOption(ODataQuery.EXPAND);
  }
  removeExpand() {
    this.removeOption(ODataQuery.EXPAND);
  }
  format(opts?: string) {
    return this.wrapValue<string>(ODataQuery.FORMAT, opts);
  }
  removeFormat() {
    this.removeOption(ODataQuery.FORMAT);
  }
  top(opts?: number) {
    return this.wrapValue<number>(ODataQuery.TOP, opts);
  }
  removeTop() {
    this.removeOption(ODataQuery.TOP);
  }
  skip(opts?: number) {
    return this.wrapValue<number>(ODataQuery.SKIP, opts);
  }
  removeSkip() {
    this.removeOption(ODataQuery.SKIP);
  }
  countOption(opts?: boolean | Filter) {
    return this.wrapObject(ODataQuery.COUNT, opts);
  }
  removeCountOption() {
    this.removeOption(ODataQuery.COUNT);
  }
  customOption(opts?: PlainObject) {
    return this.wrapObject(ODataQuery.CUSTOM, opts);
  }
  removeCustomOption() {
    this.removeOption(ODataQuery.CUSTOM);
  }

  // Entity key
  entityKey(opts?: string | number | PlainObject) {
    if (this.isEntitySet() || this.isNavigationProperty()) {
      let segment = this.lastSegment();
      if (Utils.isUndefined(opts)) return segment.options().get("key");
      this.removeFilter();
      this.removeOrderBy();
      this.removeCountOption();
      this.removeSkip();
      this.removeTop();
      segment.options().set("key", opts);
    }
  }
  removeEntityKey() {
    let segment = this.lastSegment();
    if (segment)
      segment.options().unset("key");
  }
  hasEntityKey() {
    let segment = this.lastSegment();
    return (segment && segment.options().has("key"));
  }

  // Segments
  singleton(name: string) {
    return this.wrapSegment(ODataQuery.SINGLETON, name);
  }
  removeSingleton(name: string) {
    return this.removeSegment(ODataQuery.SINGLETON, name);
  }
  isSingleton() {
    return this.is(ODataQuery.SINGLETON);
  }
  entitySet(name: string) {
    return this.wrapSegment(ODataQuery.ENTITY_SET, name);
  }
  removeEntitySet(name: string) {
    return this.removeSegment(ODataQuery.ENTITY_SET, name);
  }
  isEntitySet() {
    return this.is(ODataQuery.ENTITY_SET);
  }
  isEntity() {
    return this.hasEntityKey();
  }
  action(name: string) {
    return this.wrapSegment(ODataQuery.ACTION_CALL, name);
  }
  isAction() {
    return this.is(ODataQuery.ACTION_CALL);
  }
  removeAction(name: string) {
    return this.removeSegment(ODataQuery.ACTION_CALL, name);
  }
  function(name: string) {
    return this.wrapSegment(ODataQuery.FUNCTION_CALL, name);
  }
  removeFunction(name: string) {
    return this.removeSegment(ODataQuery.FUNCTION_CALL, name);
  }
  isFunction() {
    return this.is(ODataQuery.FUNCTION_CALL);
  }
  property(name: string) {
    return this.wrapSegment(ODataQuery.PROPERTY, name);
  }
  removeProperty(name: string) {
    return this.removeSegment(ODataQuery.PROPERTY, name);
  }
  isProperty() {
    return this.is(ODataQuery.PROPERTY);
  }
  navigationProperty(name: string) {
    this.removeSelect();
    this.removeExpand();
    return this.wrapSegment(ODataQuery.NAVIGATION_PROPERTY, name);
  }
  removeNavigationProperty(name: string) {
    return this.removeSegment(ODataQuery.NAVIGATION_PROPERTY, name);
  }
  isNavigationProperty() {
    return this.is(ODataQuery.NAVIGATION_PROPERTY);
  }
  ref() {
    return this.wrapSegment(ODataQuery.REF, ODataQuery.$REF);
  }
  removeRef() {
    return this.removeSegment(ODataQuery.REF, ODataQuery.$REF);
  }
  isRef() {
    return this.is(ODataQuery.REF);
  }
  value() {
    return this.wrapSegment(ODataQuery.VALUE, ODataQuery.$VALUE);
  }
  removeValue() {
    return this.removeSegment(ODataQuery.VALUE, ODataQuery.$VALUE);
  }
  isValue() {
    return this.is(ODataQuery.VALUE);
  }
  countSegment() {
    return this.wrapSegment(ODataQuery.COUNT, ODataQuery.$COUNT);
  }
  removeCountSegment() {
    return this.removeSegment(ODataQuery.COUNT, ODataQuery.$COUNT);
  }
}

export class ODataSingleQuery<T> extends ODataQuery {}
export class ODataCollectionQuery<T> extends ODataQuery {}
export class ODataValueQuery<T> extends ODataQuery {}
export class ODataSingletonQuery<T> extends ODataQuery {}
export class ODataRefQuery<T> extends ODataQuery {}
