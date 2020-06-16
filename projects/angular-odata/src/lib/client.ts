import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams, HttpResponse, HttpEvent } from '@angular/common/http';
import { Observable } from 'rxjs';
import { catchError } from 'rxjs/operators';

import { 
  PlainObject,
  ODataResource, 
  ODataBatchResource, 
  ODataMetadataResource, 
  ODataEntitySetResource, 
  ODataSingletonResource, 
  ODataFunctionResource, 
  ODataActionResource, 
  ODataEntityResource,
  SegmentOptionNames, 
  PathSegmentNames,
  ODataPathSegments,
  ODataSegment,
  ODataQueryOptions, 
} from './resources';
import { ODataSettings } from './models/settings';
import { IF_MATCH_HEADER, Parser, ACCEPT } from './types';
import { ODataModel, ODataCollection, ODataEntityConfig, ODataServiceConfig } from './models';
import { Types } from './utils';
import { PARSERS } from './parsers';

@Injectable()
export class ODataClient {
  constructor(protected http: HttpClient, protected settings: ODataSettings) { }

  endpointUrl(resource: ODataResource<any>) {
    let config = this.settings.findConfigForTypes(resource.types());
    return `${config.serviceRootUrl}${resource}`;
  }

  // Resolve Building Blocks
  entityConfigForType<T>(type: string): ODataEntityConfig<T> | null {
    let config = this.settings.configForType(type);
    return config.entityConfigForType<T>(type);
  }

  serviceConfigForType(type: string): ODataServiceConfig | null {
    let config = this.settings.configForType(type);
    return config.serviceConfigForType(type);
  }

  parserForType<T>(type: string): Parser<T> | null {
    let parser: Parser<T>;
    let config = this.settings.configForType(type);
    if (config)
      parser = config.parserForType(type) as Parser<T>;
    if (!parser && type in PARSERS) {
      parser = PARSERS[type] as Parser<T>;
    }
    return parser;
  }

  modelForType(type: string): typeof ODataModel {
    let config = this.settings.configForType(type);
    let Model = config.modelForType(type) as typeof ODataModel;
    return Model || ODataModel;
  }

  collectionForType(type: string): typeof ODataCollection {
    let config = this.settings.configForType(type);
    let Collection = config.collectionForType(type) as typeof ODataCollection;
    return Collection || ODataCollection;
  }

  fromJSON<T extends ODataResource<any>>(json: {segments: ODataSegment[], options: PlainObject}): T {
    let lastSegment = json.segments[json.segments.length - 1];
    let Ctor = (lastSegment.name === PathSegmentNames.entitySet && lastSegment.options && SegmentOptionNames.key in lastSegment.options) ? ODataEntityResource :
      {
        [PathSegmentNames.metadata]: ODataMetadataResource,
        [PathSegmentNames.batch]: ODataBatchResource,
        [PathSegmentNames.singleton]: ODataSingletonResource,
        [PathSegmentNames.entitySet]: ODataEntitySetResource,
        [PathSegmentNames.action]: ODataActionResource,
        [PathSegmentNames.function]: ODataFunctionResource
      }[lastSegment.name];
    return new Ctor(this, new ODataPathSegments(json.segments), new ODataQueryOptions(json.options)) as T;
  }

  // Requests
  metadata(): ODataMetadataResource {
    return ODataMetadataResource.factory(this);
  }

  batch(): ODataBatchResource {
    return ODataBatchResource.factory(this);
  }

  singleton<T>(name: string, type?: string) {
    return ODataSingletonResource.factory<T>(this, name, type, new ODataPathSegments(), new ODataQueryOptions());
  }

  entitySet<T>(name: string, type?: string): ODataEntitySetResource<T> {
    return ODataEntitySetResource.factory<T>(this, name, type, new ODataPathSegments(), new ODataQueryOptions());
  }

  // Unbound Action
  action<T>(name: string, returnType?: string): ODataActionResource<T> {
    return ODataActionResource.factory(this, name, returnType, new ODataPathSegments(), new ODataQueryOptions());
  }

  // Unbound Function
  function<T>(name: string, returnType?: string): ODataFunctionResource<T> {
    return ODataFunctionResource.factory<T>(this, name, returnType, new ODataPathSegments(), new ODataQueryOptions());
  }

  //Merge Headers
  mergeHttpHeaders(...headers: (HttpHeaders | { [header: string]: string | string[]; })[]): HttpHeaders {
    let attrs = {};
    headers.forEach(header => {
      if (header instanceof HttpHeaders) {
        const httpHeader = header as HttpHeaders;
        attrs = httpHeader.keys().reduce((acc, key) => Object.assign(acc, { [key]: httpHeader.getAll(key) }), attrs);
      } else if (typeof header === 'object')
        attrs = Object.assign(attrs, header);
    });
    return new HttpHeaders(attrs);
  }

  //Merge Params
  mergeHttpParams(...params: (HttpParams | { [param: string]: string | string[]; })[]): HttpParams {
    let attrs = {};
    params.forEach(param => {
      if (param instanceof HttpParams) {
        const httpParam = param as HttpParams;
        attrs = httpParam.keys().reduce((acc, key) => Object.assign(acc, { [key]: httpParam.getAll(key) }), attrs);
      } else if (typeof param === 'object')
        attrs = Object.assign(attrs, param);
    });
    return new HttpParams({ fromObject: attrs });
  }

  // Request headers, get, post, put, patch... etc
  request(method: string, resource: ODataResource<any>, options: {
    body?: any,
    etag?: string,
    config?: string,
    headers?: HttpHeaders | { [header: string]: string | string[] },
    observe?: 'body',
    params?: HttpParams | { [param: string]: string | string[] },
    reportProgress?: boolean,
    responseType: 'arraybuffer', 
    withCredentials?: boolean,
  }): Observable<ArrayBuffer>;

  request(method: string, resource: ODataResource<any>, options: {
    body?: any,
    etag?: string,
    config?: string,
    headers?: HttpHeaders | { [header: string]: string | string[] },
    observe?: 'body',
    params?: HttpParams | { [param: string]: string | string[] },
    reportProgress?: boolean,
    responseType: 'blob', 
    withCredentials?: boolean,
  }): Observable<Blob>;

  request(method: string, resource: ODataResource<any>, options: {
    body?: any,
    etag?: string,
    config?: string,
    headers?: HttpHeaders | { [header: string]: string | string[] },
    observe?: 'body',
    params?: HttpParams | { [param: string]: string | string[] },
    reportProgress?: boolean,
    responseType: 'text', 
    withCredentials?: boolean,
  }): Observable<string>;

  request(method: string, resource: ODataResource<any>, options: {
    body?: any,
    etag?: string,
    config?: string,
    headers?: HttpHeaders | { [header: string]: string | string[] },
    params?: HttpParams | { [param: string]: string | string[] },
    observe: 'events', 
    reportProgress?: boolean,
    responseType: 'arraybuffer', 
    withCredentials?: boolean,
  }): Observable<HttpEvent<ArrayBuffer>>;

  request(method: string, resource: ODataResource<any>, options: {
    body?: any,
    etag?: string,
    config?: string,
    headers?: HttpHeaders | { [header: string]: string | string[] },
    observe: 'events',
    params?: HttpParams | { [param: string]: string | string[] },
    reportProgress?: boolean,
    responseType: 'blob', 
    withCredentials?: boolean,
  }): Observable<HttpEvent<Blob>>;

  request(method: string, resource: ODataResource<any>, options: {
    body?: any,
    etag?: string,
    config?: string,
    headers?: HttpHeaders | { [header: string]: string | string[] },
    observe: 'events',
    params?: HttpParams | { [param: string]: string | string[] },
    reportProgress?: boolean,
    responseType: 'text', 
    withCredentials?: boolean,
  }): Observable<HttpEvent<string>>;

  request(method: string, resource: ODataResource<any>, options: {
    body?: any,
    etag?: string,
    config?: string,
    headers?: HttpHeaders | { [header: string]: string | string[] },
    reportProgress?: boolean,
    observe: 'events',
    params?: HttpParams | { [param: string]: string | string[] },
    responseType?: 'json',
    withCredentials?: boolean,
  }): Observable<HttpEvent<any>>;

  request<R>(method: string, resource: ODataResource<any>, options: {
    body?: any,
    etag?: string,
    config?: string,
    headers?: HttpHeaders | { [header: string]: string | string[] },
    reportProgress?: boolean,
    observe: 'events',
    params?: HttpParams | { [param: string]: string | string[] },
    responseType?: 'json',
    withCredentials?: boolean,
  }): Observable<HttpEvent<R>>;

  request(method: string, resource: ODataResource<any>, options: {
    body?: any,
    etag?: string,
    config?: string,
    headers?: HttpHeaders | { [header: string]: string | string[] },
    observe: 'response',
    params?: HttpParams | { [param: string]: string | string[] },
    reportProgress?: boolean,
    responseType: 'arraybuffer', 
    withCredentials?: boolean,
  }): Observable<HttpResponse<ArrayBuffer>>;

  request(method: string, resource: ODataResource<any>, options: {
    body?: any,
    etag?: string,
    config?: string,
    headers?: HttpHeaders | { [header: string]: string | string[] },
    observe: 'response',
    params?: HttpParams | { [param: string]: string | string[] },
    reportProgress?: boolean,
    responseType: 'blob', 
    withCredentials?: boolean,
  }): Observable<HttpResponse<Blob>>;

  request(method: string, resource: ODataResource<any>, options: {
    body?: any,
    etag?: string,
    config?: string,
    headers?: HttpHeaders | { [header: string]: string | string[] },
    observe: 'response',
    params?: HttpParams | { [param: string]: string | string[] },
    reportProgress?: boolean,
    responseType: 'text', withCredentials?: boolean,
  }): Observable<HttpResponse<string>>;

  request(method: string, resource: ODataResource<any>, options: {
    body?: any,
    etag?: string,
    config?: string,
    headers?: HttpHeaders | { [header: string]: string | string[] },
    reportProgress?: boolean,
    observe: 'response',
    params?: HttpParams | { [param: string]: string | string[] },
    responseType?: 'json',
    withCredentials?: boolean,
  }): Observable<HttpResponse<Object>>;

  request<R>(method: string, resource: ODataResource<any>, options: {
    body?: any,
    etag?: string,
    config?: string,
    headers?: HttpHeaders | { [header: string]: string | string[] },
    reportProgress?: boolean,
    observe: 'response',
    params?: HttpParams | { [param: string]: string | string[] },
    responseType?: 'json',
    withCredentials?: boolean,
  }): Observable<HttpResponse<R>>;

  request(method: string, resource: ODataResource<any>, options?: {
    body?: any,
    etag?: string,
    config?: string,
    headers?: HttpHeaders | { [header: string]: string | string[] },
    observe?: 'body',
    params?: HttpParams | { [param: string]: string | string[] },
    responseType?: 'json',
    reportProgress?: boolean,
    withCredentials?: boolean,
  }): Observable<Object>;

  request<R>(method: string, resource: ODataResource<any>, options?: {
    body?: any,
    etag?: string,
    config?: string,
    headers?: HttpHeaders | { [header: string]: string | string[] },
    observe?: 'body',
    params?: HttpParams | { [param: string]: string | string[] },
    responseType?: 'json',
    reportProgress?: boolean,
    withCredentials?: boolean,
  }): Observable<R>;

  request(method: string, resource: ODataResource<any>, options?: {
    body?: any,
    etag?: string,
    config?: string,
    headers?: HttpHeaders | { [header: string]: string | string[] },
    params?: HttpParams | { [param: string]: string | string[] },
    observe?: 'body' | 'events' | 'response',
    reportProgress?: boolean,
    responseType?: 'arraybuffer' | 'blob' | 'json' | 'text',
    withCredentials?: boolean
  }): Observable<any>;

  request(method: string, resource: ODataResource<any>, options: {
    body?: any | null,
    etag?: string,
    config?: string,
    headers?: HttpHeaders | { [header: string]: string | string[] },
    observe?: 'body' | 'events' | 'response',
    params?: HttpParams | { [param: string]: string | string[] },
    reportProgress?: boolean,
    responseType?: 'arraybuffer' | 'blob' | 'json' | 'text',
    withCredentials?: boolean
  } = {}): Observable<any> {

    let config = options.config ? 
      this.settings.config(options.config) : 
      this.settings.findConfigForTypes(resource.types());
    if (!config) throw new Error(`The types: '[${resource.types().join(", ")}]' does not belongs to any known configuration`);

    // The Url
    const [resourcePath, resourceParams] = resource.pathAndParams();
    const resourceUrl = `${config.serviceRootUrl}${resourcePath}`;

    // Headers
    let customHeaders = {};
    if (typeof options.etag === 'string')
      customHeaders[IF_MATCH_HEADER] = options.etag;
    // Metadata ?
    if (!Types.isUndefined(config.acceptMetadata) && options.responseType === 'json' && options.observe === 'body')
      customHeaders[ACCEPT] = `application/json;odata.metadata=${config.acceptMetadata}, text/plain, */*`;
    let headers = this.mergeHttpHeaders(config.headers, customHeaders, options.headers);

    // Params
    let params = this.mergeHttpParams(config.params, resourceParams, options.params);

    // Credentials ?
    let withCredentials = options.withCredentials;
    if (Types.isUndefined(withCredentials))
      withCredentials = config.withCredentials;

    // Call http request
    let res$ = this.http.request(method, resourceUrl, {
      body: options.body,
      headers: headers,
      observe: options.observe,
      params: params,
      reportProgress: options.reportProgress,
      responseType: options.responseType,
      withCredentials: withCredentials
    });

    return res$;
  }

  delete(resource: ODataResource<any>, options?: {
    etag?: string,
    config?: string,
    headers?: HttpHeaders | { [header: string]: string | string[] },
    observe?: 'body',
    params?: HttpParams | { [param: string]: string | string[] },
    reportProgress?: boolean,
    responseType: 'arraybuffer', withCredentials?: boolean,
  }): Observable<ArrayBuffer>;

  delete(resource: ODataResource<any>, options?: {
    etag?: string,
    config?: string,
    headers?: HttpHeaders | { [header: string]: string | string[] },
    observe?: 'body',
    params?: HttpParams | { [param: string]: string | string[] },
    reportProgress?: boolean,
    responseType: 'blob', withCredentials?: boolean,
  }): Observable<Blob>;

  delete(resource: ODataResource<any>, options?: {
    etag?: string,
    config?: string,
    headers?: HttpHeaders | { [header: string]: string | string[] },
    observe?: 'body',
    params?: HttpParams | { [param: string]: string | string[] },
    reportProgress?: boolean,
    responseType: 'text', withCredentials?: boolean,
  }): Observable<string>;

  delete(resource: ODataResource<any>, options?: {
    etag?: string,
    config?: string,
    headers?: HttpHeaders | { [header: string]: string | string[] },
    observe: 'events',
    params?: HttpParams | { [param: string]: string | string[] },
    reportProgress?: boolean,
    responseType: 'arraybuffer', withCredentials?: boolean,
  }): Observable<HttpEvent<ArrayBuffer>>;

  delete(resource: ODataResource<any>, options?: {
    etag?: string,
    config?: string,
    headers?: HttpHeaders | { [header: string]: string | string[] },
    observe: 'events',
    params?: HttpParams | { [param: string]: string | string[] },
    reportProgress?: boolean,
    responseType: 'blob', withCredentials?: boolean,
  }): Observable<HttpEvent<Blob>>;

  delete(resource: ODataResource<any>, options?: {
    etag?: string,
    config?: string,
    headers?: HttpHeaders | { [header: string]: string | string[] },
    observe: 'events',
    params?: HttpParams | { [param: string]: string | string[] },
    reportProgress?: boolean,
    responseType: 'text', withCredentials?: boolean,
  }): Observable<HttpEvent<string>>;

  delete(resource: ODataResource<any>, options?: {
    etag?: string,
    config?: string,
    headers?: HttpHeaders | { [header: string]: string | string[] },
    observe: 'events',
    params?: HttpParams | { [param: string]: string | string[] },
    reportProgress?: boolean,
    responseType?: 'json',
    withCredentials?: boolean,
  }): Observable<HttpEvent<Object>>;

  delete<T>(resource: ODataResource<any>, options?: {
    etag?: string,
    config?: string,
    headers?: HttpHeaders | { [header: string]: string | string[] },
    observe: 'events',
    params?: HttpParams | { [param: string]: string | string[] },
    reportProgress?: boolean,
    responseType?: 'json',
    withCredentials?: boolean,
  }): Observable<HttpEvent<T>>;

  delete(resource: ODataResource<any>, options?: {
    etag?: string,
    config?: string,
    headers?: HttpHeaders | { [header: string]: string | string[] },
    observe: 'response',
    params?: HttpParams | { [param: string]: string | string[] },
    reportProgress?: boolean,
    responseType: 'arraybuffer', withCredentials?: boolean,
  }): Observable<HttpResponse<ArrayBuffer>>;

  delete(resource: ODataResource<any>, options?: {
    etag?: string,
    config?: string,
    headers?: HttpHeaders | { [header: string]: string | string[] },
    observe: 'response',
    params?: HttpParams | { [param: string]: string | string[] },
    reportProgress?: boolean,
    responseType: 'blob', withCredentials?: boolean,
  }): Observable<HttpResponse<Blob>>;

  delete(resource: ODataResource<any>, options?: {
    etag?: string,
    config?: string,
    headers?: HttpHeaders | { [header: string]: string | string[] },
    observe: 'response',
    params?: HttpParams | { [param: string]: string | string[] },
    reportProgress?: boolean,
    responseType: 'text', withCredentials?: boolean,
  }): Observable<HttpResponse<string>>;

  delete(resource: ODataResource<any>, options?: {
    etag?: string,
    config?: string,
    headers?: HttpHeaders | { [header: string]: string | string[] },
    observe: 'response',
    params?: HttpParams | { [param: string]: string | string[] },
    reportProgress?: boolean,
    responseType?: 'json',
    withCredentials?: boolean,
  }): Observable<HttpResponse<Object>>;

  delete<T>(resource: ODataResource<any>, options?: {
    etag?: string,
    config?: string,
    headers?: HttpHeaders | { [header: string]: string | string[] },
    observe: 'response',
    params?: HttpParams | { [param: string]: string | string[] },
    reportProgress?: boolean,
    responseType?: 'json',
    withCredentials?: boolean,
  }): Observable<HttpResponse<T>>;

  delete(resource: ODataResource<any>, options?: {
    etag?: string,
    config?: string,
    headers?: HttpHeaders | { [header: string]: string | string[] },
    observe?: 'body',
    params?: HttpParams | { [param: string]: string | string[] },
    reportProgress?: boolean,
    responseType?: 'json',
    withCredentials?: boolean,
  }): Observable<Object>;

  delete<T>(resource: ODataResource<any>, options?: {
    etag?: string,
    config?: string,
    headers?: HttpHeaders | { [header: string]: string | string[] },
    observe?: 'body',
    params?: HttpParams | { [param: string]: string | string[] },
    reportProgress?: boolean,
    responseType?: 'json',
    withCredentials?: boolean,
  }): Observable<T>;

  delete(resource: ODataResource<any>, options: {
    etag?: string,
    config?: string,
    headers?: HttpHeaders | { [header: string]: string | string[] },
    observe?: 'body' | 'events' | 'response',
    params?: HttpParams | { [param: string]: string | string[] },
    reportProgress?: boolean,
    responseType?: 'arraybuffer' | 'blob' | 'json' | 'text',
    withCredentials?: boolean,
  } = {}): Observable<any> {
    return this.request<any>('DELETE', resource, options as any);
  }

  get(resource: ODataResource<any>, options: {
    config?: string,
    headers?: HttpHeaders | { [header: string]: string | string[] },
    observe?: 'body',
    params?: HttpParams | { [param: string]: string | string[] },
    reportProgress?: boolean,
    responseType: 'arraybuffer', 
    withCredentials?: boolean,
  }): Observable<ArrayBuffer>;

  get(resource: ODataResource<any>, options: {
    config?: string,
    headers?: HttpHeaders | { [header: string]: string | string[] },
    observe?: 'body',
    params?: HttpParams | { [param: string]: string | string[] },
    reportProgress?: boolean,
    responseType: 'blob', 
    withCredentials?: boolean,
  }): Observable<Blob>;

  get(resource: ODataResource<any>, options: {
    config?: string,
    headers?: HttpHeaders | { [header: string]: string | string[] },
    observe?: 'body',
    params?: HttpParams | { [param: string]: string | string[] },
    reportProgress?: boolean,
    responseType: 'text', 
    withCredentials?: boolean,
  }): Observable<string>;

  get(resource: ODataResource<any>, options: {
    config?: string,
    headers?: HttpHeaders | { [header: string]: string | string[] },
    observe: 'events',
    params?: HttpParams | { [param: string]: string | string[] },
    reportProgress?: boolean,
    responseType: 'arraybuffer', 
    withCredentials?: boolean,
  }): Observable<HttpEvent<ArrayBuffer>>;

  get(resource: ODataResource<any>, options: {
    config?: string,
    headers?: HttpHeaders | { [header: string]: string | string[] },
    observe: 'events',
    params?: HttpParams | { [param: string]: string | string[] },
    reportProgress?: boolean,
    responseType: 'blob', 
    withCredentials?: boolean,
  }): Observable<HttpEvent<Blob>>;

  get(resource: ODataResource<any>, options: {
    config?: string,
    headers?: HttpHeaders | { [header: string]: string | string[] },
    observe: 'events',
    params?: HttpParams | { [param: string]: string | string[] },
    reportProgress?: boolean,
    responseType: 'text', withCredentials?: boolean,
  }): Observable<HttpEvent<string>>;

  get(resource: ODataResource<any>, options: {
    config?: string,
    headers?: HttpHeaders | { [header: string]: string | string[] },
    observe: 'events',
    params?: HttpParams | { [param: string]: string | string[] },
    reportProgress?: boolean,
    responseType?: 'json',
    withCredentials?: boolean,
  }): Observable<HttpEvent<Object>>;

  get<T>(resource: ODataResource<any>, options: {
    config?: string,
    headers?: HttpHeaders | { [header: string]: string | string[] },
    observe: 'events',
    params?: HttpParams | { [param: string]: string | string[] },
    reportProgress?: boolean,
    responseType?: 'json',
    withCredentials?: boolean,
  }): Observable<HttpEvent<T>>;

  get(resource: ODataResource<any>, options: {
    config?: string,
    headers?: HttpHeaders | { [header: string]: string | string[] },
    observe: 'response',
    params?: HttpParams | { [param: string]: string | string[] },
    reportProgress?: boolean,
    responseType: 'arraybuffer', withCredentials?: boolean,
  }): Observable<HttpResponse<ArrayBuffer>>;

  get(resource: ODataResource<any>, options: {
    config?: string,
    headers?: HttpHeaders | { [header: string]: string | string[] },
    observe: 'response',
    params?: HttpParams | { [param: string]: string | string[] },
    reportProgress?: boolean,
    responseType: 'blob', withCredentials?: boolean,
  }): Observable<HttpResponse<Blob>>;

  get(resource: ODataResource<any>, options: {
    config?: string,
    headers?: HttpHeaders | { [header: string]: string | string[] },
    observe: 'response',
    params?: HttpParams | { [param: string]: string | string[] },
    reportProgress?: boolean,
    responseType: 'text', withCredentials?: boolean,
  }): Observable<HttpResponse<string>>;

  get(resource: ODataResource<any>, options: {
    config?: string,
    headers?: HttpHeaders | { [header: string]: string | string[] },
    observe: 'response',
    params?: HttpParams | { [param: string]: string | string[] },
    reportProgress?: boolean,
    responseType?: 'json',
    withCredentials?: boolean,
  }): Observable<HttpResponse<Object>>;

  get<T>(resource: ODataResource<any>, options: {
    config?: string,
    headers?: HttpHeaders | { [header: string]: string | string[] },
    observe: 'response',
    params?: HttpParams | { [param: string]: string | string[] },
    reportProgress?: boolean,
    responseType?: 'json',
    withCredentials?: boolean,
  }): Observable<HttpResponse<T>>;

  get(resource: ODataResource<any>, options?: {
    config?: string,
    headers?: HttpHeaders | { [header: string]: string | string[] },
    observe?: 'body',
    params?: HttpParams | { [param: string]: string | string[] },
    reportProgress?: boolean,
    responseType?: 'json',
    withCredentials?: boolean,
  }): Observable<Object>;

  get<T>(resource: ODataResource<any>, options?: {
    config?: string,
    headers?: HttpHeaders | { [header: string]: string | string[] },
    observe?: 'body',
    params?: HttpParams | { [param: string]: string | string[] },
    reportProgress?: boolean,
    responseType?: 'json',
    withCredentials?: boolean,
  }): Observable<T>;

  get(resource: ODataResource<any>, options: {
    config?: string,
    headers?: HttpHeaders | { [header: string]: string | string[] },
    observe?: 'body' | 'events' | 'response',
    params?: HttpParams | { [param: string]: string | string[] },
    reportProgress?: boolean,
    responseType?: 'arraybuffer' | 'blob' | 'json' | 'text',
    withCredentials?: boolean,
  } = {}): Observable<any> {
    return this.request<any>('GET', resource, options as any);
  }

  head(resource: ODataResource<any>, options: {
    config?: string,
    headers?: HttpHeaders | { [header: string]: string | string[] },
    observe?: 'body',
    params?: HttpParams | { [param: string]: string | string[] },
    reportProgress?: boolean,
    responseType: 'arraybuffer', 
    withCredentials?: boolean,
  }): Observable<ArrayBuffer>;

  head(resource: ODataResource<any>, options: {
    config?: string,
    headers?: HttpHeaders | { [header: string]: string | string[] },
    observe?: 'body',
    params?: HttpParams | { [param: string]: string | string[] },
    reportProgress?: boolean,
    responseType: 'blob', 
    withCredentials?: boolean,
  }): Observable<Blob>;

  head(resource: ODataResource<any>, options: {
    config?: string,
    headers?: HttpHeaders | { [header: string]: string | string[] },
    observe?: 'body',
    params?: HttpParams | { [param: string]: string | string[] },
    reportProgress?: boolean,
    responseType: 'text', 
    withCredentials?: boolean,
  }): Observable<string>;

  head(resource: ODataResource<any>, options: {
    config?: string,
    headers?: HttpHeaders | { [header: string]: string | string[] },
    observe: 'events',
    params?: HttpParams | { [param: string]: string | string[] },
    reportProgress?: boolean,
    responseType: 'arraybuffer', 
    withCredentials?: boolean,
  }): Observable<HttpEvent<ArrayBuffer>>;

  head(resource: ODataResource<any>, options: {
    config?: string,
    headers?: HttpHeaders | { [header: string]: string | string[] },
    observe: 'events',
    params?: HttpParams | { [param: string]: string | string[] },
    reportProgress?: boolean,
    responseType: 'blob', 
    withCredentials?: boolean,
  }): Observable<HttpEvent<Blob>>;

  head(resource: ODataResource<any>, options: {
    config?: string,
    headers?: HttpHeaders | { [header: string]: string | string[] },
    observe: 'events',
    params?: HttpParams | { [param: string]: string | string[] },
    reportProgress?: boolean,
    responseType: 'text', 
    withCredentials?: boolean,
  }): Observable<HttpEvent<string>>;

  head(resource: ODataResource<any>, options: {
    config?: string,
    headers?: HttpHeaders | { [header: string]: string | string[] },
    observe: 'events',
    params?: HttpParams | { [param: string]: string | string[] },
    reportProgress?: boolean,
    responseType?: 'json',
    withCredentials?: boolean,
  }): Observable<HttpEvent<Object>>;

  head<T>(resource: ODataResource<any>, options: {
    config?: string,
    headers?: HttpHeaders | { [header: string]: string | string[] },
    observe: 'events',
    params?: HttpParams | { [param: string]: string | string[] },
    reportProgress?: boolean,
    responseType?: 'json',
    withCredentials?: boolean,
  }): Observable<HttpEvent<T>>;

  head(resource: ODataResource<any>, options: {
    config?: string,
    headers?: HttpHeaders | { [header: string]: string | string[] },
    observe: 'response',
    params?: HttpParams | { [param: string]: string | string[] },
    reportProgress?: boolean,
    responseType: 'arraybuffer', 
    withCredentials?: boolean,
  }): Observable<HttpResponse<ArrayBuffer>>;

  head(resource: ODataResource<any>, options: {
    config?: string,
    headers?: HttpHeaders | { [header: string]: string | string[] },
    observe: 'response',
    params?: HttpParams | { [param: string]: string | string[] },
    reportProgress?: boolean,
    responseType: 'blob', 
    withCredentials?: boolean,
  }): Observable<HttpResponse<Blob>>;

  head(resource: ODataResource<any>, options: {
    config?: string,
    headers?: HttpHeaders | { [header: string]: string | string[] },
    observe: 'response',
    params?: HttpParams | { [param: string]: string | string[] },
    reportProgress?: boolean,
    responseType: 'text', 
    withCredentials?: boolean,
  }): Observable<HttpResponse<string>>;

  head(resource: ODataResource<any>, options: {
    config?: string,
    headers?: HttpHeaders | { [header: string]: string | string[] },
    observe: 'response',
    params?: HttpParams | { [param: string]: string | string[] },
    reportProgress?: boolean,
    responseType?: 'json',
    withCredentials?: boolean,
  }): Observable<HttpResponse<Object>>;

  head<T>(resource: ODataResource<any>, options: {
    config?: string,
    headers?: HttpHeaders | { [header: string]: string | string[] },
    observe: 'response',
    params?: HttpParams | { [param: string]: string | string[] },
    reportProgress?: boolean,
    responseType?: 'json',
    withCredentials?: boolean,
  }): Observable<HttpResponse<T>>;

  head(resource: ODataResource<any>, options?: {
    config?: string,
    headers?: HttpHeaders | { [header: string]: string | string[] },
    observe?: 'body',
    params?: HttpParams | { [param: string]: string | string[] },
    reportProgress?: boolean,
    responseType?: 'json',
    withCredentials?: boolean,
  }): Observable<Object>;

  head<T>(resource: ODataResource<any>, options?: {
    config?: string,
    headers?: HttpHeaders | { [header: string]: string | string[] },
    observe?: 'body',
    params?: HttpParams | { [param: string]: string | string[] },
    reportProgress?: boolean,
    responseType?: 'json',
    withCredentials?: boolean,
  }): Observable<T>;

  head(resource: ODataResource<any>, options: {
    config?: string,
    headers?: HttpHeaders | { [header: string]: string | string[] },
    observe?: 'body' | 'events' | 'response',
    params?: HttpParams | { [param: string]: string | string[] },
    reportProgress?: boolean,
    responseType?: 'arraybuffer' | 'blob' | 'json' | 'text',
    withCredentials?: boolean,
  } = {}): Observable<any> {
    return this.request<any>('HEAD', resource, options as any);
  }

  jsonp(resource: ODataResource<any>, callbackParam: string): Observable<Object>;

  jsonp<T>(resource: ODataResource<any>, callbackParam: string): Observable<T>;

  jsonp<T>(resource: ODataResource<any>, callbackParam: string): Observable<T> {
    return this.request<any>('JSONP', resource, {
      params: new HttpParams().append(callbackParam, 'JSONP_CALLBACK'),
      observe: 'body',
      responseType: 'json',
    });
  }

  options(resource: ODataResource<any>, options: {
    config?: string,
    headers?: HttpHeaders | { [header: string]: string | string[] },
    observe?: 'body',
    params?: HttpParams | { [param: string]: string | string[] },
    reportProgress?: boolean,
    responseType: 'arraybuffer', 
    withCredentials?: boolean,
  }): Observable<ArrayBuffer>;

  options(resource: ODataResource<any>, options: {
    config?: string,
    headers?: HttpHeaders | { [header: string]: string | string[] },
    observe?: 'body',
    params?: HttpParams | { [param: string]: string | string[] },
    reportProgress?: boolean,
    responseType: 'blob', 
    withCredentials?: boolean,
  }): Observable<Blob>;

  options(resource: ODataResource<any>, options: {
    config?: string,
    headers?: HttpHeaders | { [header: string]: string | string[] },
    observe?: 'body',
    params?: HttpParams | { [param: string]: string | string[] },
    reportProgress?: boolean,
    responseType: 'text', 
    withCredentials?: boolean,
  }): Observable<string>;

  options(resource: ODataResource<any>, options: {
    config?: string,
    headers?: HttpHeaders | { [header: string]: string | string[] },
    observe: 'events',
    params?: HttpParams | { [param: string]: string | string[] },
    reportProgress?: boolean,
    responseType: 'arraybuffer', 
    withCredentials?: boolean,
  }): Observable<HttpEvent<ArrayBuffer>>;

  options(resource: ODataResource<any>, options: {
    config?: string,
    headers?: HttpHeaders | { [header: string]: string | string[] },
    observe: 'events',
    params?: HttpParams | { [param: string]: string | string[] },
    reportProgress?: boolean,
    responseType: 'blob', 
    withCredentials?: boolean,
  }): Observable<HttpEvent<Blob>>;

  options(resource: ODataResource<any>, options: {
    config?: string,
    headers?: HttpHeaders | { [header: string]: string | string[] },
    observe: 'events',
    params?: HttpParams | { [param: string]: string | string[] },
    reportProgress?: boolean,
    responseType: 'text', 
    withCredentials?: boolean,
  }): Observable<HttpEvent<string>>;

  options(resource: ODataResource<any>, options: {
    config?: string,
    headers?: HttpHeaders | { [header: string]: string | string[] },
    observe: 'events',
    params?: HttpParams | { [param: string]: string | string[] },
    reportProgress?: boolean,
    responseType?: 'json',
    withCredentials?: boolean,
  }): Observable<HttpEvent<Object>>;

  options(resource: ODataResource<any>, options: {
    config?: string,
    headers?: HttpHeaders | { [header: string]: string | string[] },
    observe: 'events',
    params?: HttpParams | { [param: string]: string | string[] },
    reportProgress?: boolean,
    responseType?: 'json',
    withCredentials?: boolean,
  }): Observable<HttpEvent<Object>>;

  options<T>(resource: ODataResource<any>, options: {
    config?: string,
    headers?: HttpHeaders | { [header: string]: string | string[] },
    observe: 'events',
    params?: HttpParams | { [param: string]: string | string[] },
    reportProgress?: boolean,
    responseType?: 'json',
    withCredentials?: boolean,
  }): Observable<HttpEvent<T>>;

  options(resource: ODataResource<any>, options: {
    config?: string,
    headers?: HttpHeaders | { [header: string]: string | string[] },
    observe: 'response',
    params?: HttpParams | { [param: string]: string | string[] },
    reportProgress?: boolean,
    responseType: 'arraybuffer', withCredentials?: boolean,
  }): Observable<HttpResponse<ArrayBuffer>>;

  options(resource: ODataResource<any>, options: {
    config?: string,
    headers?: HttpHeaders | { [header: string]: string | string[] },
    observe: 'response',
    params?: HttpParams | { [param: string]: string | string[] },
    reportProgress?: boolean,
    responseType: 'blob', withCredentials?: boolean,
  }): Observable<HttpResponse<Blob>>;

  options(resource: ODataResource<any>, options: {
    config?: string,
    headers?: HttpHeaders | { [header: string]: string | string[] },
    observe: 'response',
    params?: HttpParams | { [param: string]: string | string[] },
    reportProgress?: boolean,
    responseType: 'text', withCredentials?: boolean,
  }): Observable<HttpResponse<string>>;

  options(resource: ODataResource<any>, options: {
    config?: string,
    headers?: HttpHeaders | { [header: string]: string | string[] },
    observe: 'response',
    params?: HttpParams | { [param: string]: string | string[] },
    reportProgress?: boolean,
    responseType?: 'json',
    withCredentials?: boolean,
  }): Observable<HttpResponse<Object>>;

  options<T>(resource: ODataResource<any>, options: {
    config?: string,
    headers?: HttpHeaders | { [header: string]: string | string[] },
    observe: 'response',
    params?: HttpParams | { [param: string]: string | string[] },
    reportProgress?: boolean,
    responseType?: 'json',
    withCredentials?: boolean,
  }): Observable<HttpResponse<T>>;

  options(resource: ODataResource<any>, options?: {
    config?: string,
    headers?: HttpHeaders | { [header: string]: string | string[] },
    observe?: 'body',
    params?: HttpParams | { [param: string]: string | string[] },
    reportProgress?: boolean,
    responseType?: 'json',
    withCredentials?: boolean,
  }): Observable<Object>;

  options<T>(resource: ODataResource<any>, options?: {
    config?: string,
    headers?: HttpHeaders | { [header: string]: string | string[] },
    observe?: 'body',
    params?: HttpParams | { [param: string]: string | string[] },
    reportProgress?: boolean,
    responseType?: 'json',
    withCredentials?: boolean,
  }): Observable<T>;

  options(resource: ODataResource<any>, options: {
    config?: string,
    headers?: HttpHeaders | { [header: string]: string | string[] },
    observe?: 'body' | 'events' | 'response',
    params?: HttpParams | { [param: string]: string | string[] },
    reportProgress?: boolean,
    responseType?: 'arraybuffer' | 'blob' | 'json' | 'text',
    withCredentials?: boolean,
  } = {}): Observable<any> {
    return this.request<any>('OPTIONS', resource, options as any);
  }

  patch(resource: ODataResource<any>, body: any | null, options?: {
    etag?: string,
    config?: string,
    headers?: HttpHeaders | { [header: string]: string | string[] },
    observe?: 'body',
    params?: HttpParams | { [param: string]: string | string[] },
    reportProgress?: boolean,
    responseType: 'arraybuffer', 
    withCredentials?: boolean,
  }): Observable<ArrayBuffer>;

  patch(resource: ODataResource<any>, body: any | null, options?: {
    etag?: string,
    config?: string,
    headers?: HttpHeaders | { [header: string]: string | string[] },
    observe?: 'body',
    params?: HttpParams | { [param: string]: string | string[] },
    reportProgress?: boolean,
    responseType: 'blob', 
    withCredentials?: boolean,
  }): Observable<Blob>;

  patch(resource: ODataResource<any>, body: any | null, options?: {
    etag?: string,
    config?: string,
    headers?: HttpHeaders | { [header: string]: string | string[] },
    observe?: 'body',
    params?: HttpParams | { [param: string]: string | string[] },
    reportProgress?: boolean,
    responseType: 'text', 
    withCredentials?: boolean,
  }): Observable<string>;

  patch(resource: ODataResource<any>, body: any | null, options?: {
    etag?: string,
    config?: string,
    headers?: HttpHeaders | { [header: string]: string | string[] },
    observe: 'events',
    params?: HttpParams | { [param: string]: string | string[] },
    reportProgress?: boolean,
    responseType: 'arraybuffer', 
    withCredentials?: boolean,
  }): Observable<HttpEvent<ArrayBuffer>>;

  patch(resource: ODataResource<any>, body: any | null, options?: {
    etag?: string,
    config?: string,
    headers?: HttpHeaders | { [header: string]: string | string[] },
    observe: 'events',
    params?: HttpParams | { [param: string]: string | string[] },
    reportProgress?: boolean,
    responseType: 'blob', 
    withCredentials?: boolean,
  }): Observable<HttpEvent<Blob>>;

  patch(resource: ODataResource<any>, body: any | null, options?: {
    etag?: string,
    config?: string,
    headers?: HttpHeaders | { [header: string]: string | string[] },
    observe: 'events',
    params?: HttpParams | { [param: string]: string | string[] },
    reportProgress?: boolean,
    responseType: 'text', 
    withCredentials?: boolean,
  }): Observable<HttpEvent<string>>;

  patch(resource: ODataResource<any>, body: any | null, options?: {
    etag?: string,
    config?: string,
    headers?: HttpHeaders | { [header: string]: string | string[] },
    observe: 'events',
    params?: HttpParams | { [param: string]: string | string[] },
    reportProgress?: boolean,
    responseType?: 'json',
    withCredentials?: boolean,
  }): Observable<HttpEvent<Object>>;

  patch<T>(resource: ODataResource<any>, body: any | null, options?: {
    etag?: string,
    config?: string,
    headers?: HttpHeaders | { [header: string]: string | string[] },
    observe: 'events',
    params?: HttpParams | { [param: string]: string | string[] },
    reportProgress?: boolean,
    responseType?: 'json',
    withCredentials?: boolean,
  }): Observable<HttpEvent<T>>;

  patch(resource: ODataResource<any>, body: any | null, options?: {
    etag?: string,
    config?: string,
    headers?: HttpHeaders | { [header: string]: string | string[] },
    observe: 'response',
    params?: HttpParams | { [param: string]: string | string[] },
    reportProgress?: boolean,
    responseType: 'arraybuffer', withCredentials?: boolean,
  }): Observable<HttpResponse<ArrayBuffer>>;

  patch(resource: ODataResource<any>, body: any | null, options?: {
    etag?: string,
    config?: string,
    headers?: HttpHeaders | { [header: string]: string | string[] },
    observe: 'response',
    params?: HttpParams | { [param: string]: string | string[] },
    reportProgress?: boolean,
    responseType: 'blob', withCredentials?: boolean,
  }): Observable<HttpResponse<Blob>>;

  patch(resource: ODataResource<any>, body: any | null, options?: {
    etag?: string,
    config?: string,
    headers?: HttpHeaders | { [header: string]: string | string[] },
    observe: 'response',
    params?: HttpParams | { [param: string]: string | string[] },
    reportProgress?: boolean,
    responseType: 'text', withCredentials?: boolean,
  }): Observable<HttpResponse<string>>;

  patch(resource: ODataResource<any>, body: any | null, options?: {
    etag?: string,
    config?: string,
    headers?: HttpHeaders | { [header: string]: string | string[] },
    observe: 'response',
    params?: HttpParams | { [param: string]: string | string[] },
    reportProgress?: boolean,
    responseType?: 'json',
    withCredentials?: boolean,
  }): Observable<HttpResponse<Object>>;

  patch<T>(resource: ODataResource<any>, body: any | null, options?: {
    etag?: string,
    config?: string,
    headers?: HttpHeaders | { [header: string]: string | string[] },
    observe: 'response',
    params?: HttpParams | { [param: string]: string | string[] },
    reportProgress?: boolean,
    responseType?: 'json',
    withCredentials?: boolean,
  }): Observable<HttpResponse<T>>;

  patch(resource: ODataResource<any>, body: any | null, options?: {
    etag?: string,
    config?: string,
    headers?: HttpHeaders | { [header: string]: string | string[] },
    observe?: 'body',
    params?: HttpParams | { [param: string]: string | string[] },
    reportProgress?: boolean,
    responseType?: 'json',
    withCredentials?: boolean,
  }): Observable<Object>;

  patch<T>(resource: ODataResource<any>, body: any | null, options?: {
    etag?: string,
    config?: string,
    headers?: HttpHeaders | { [header: string]: string | string[] },
    observe?: 'body',
    params?: HttpParams | { [param: string]: string | string[] },
    reportProgress?: boolean,
    responseType?: 'json',
    withCredentials?: boolean,
  }): Observable<T>;

  patch(resource: ODataResource<any>, body: any | null, options: {
    etag?: string,
    config?: string,
    headers?: HttpHeaders | { [header: string]: string | string[] },
    observe?: 'body' | 'events' | 'response',
    params?: HttpParams | { [param: string]: string | string[] },
    reportProgress?: boolean,
    responseType?: 'arraybuffer' | 'blob' | 'json' | 'text',
    withCredentials?: boolean,
  } = {}): Observable<any> {
    return this.request<any>('PATCH', resource, Object.assign(options, {body}));
  }

  post(resource: ODataResource<any>, body: any | null, options: {
    config?: string,
    headers?: HttpHeaders | { [header: string]: string | string[] },
    observe?: 'body',
    params?: HttpParams | { [param: string]: string | string[] },
    reportProgress?: boolean,
    responseType: 'arraybuffer', 
    withCredentials?: boolean,
  }): Observable<ArrayBuffer>;

  post(resource: ODataResource<any>, body: any | null, options: {
    config?: string,
    headers?: HttpHeaders | { [header: string]: string | string[] },
    observe?: 'body',
    params?: HttpParams | { [param: string]: string | string[] },
    reportProgress?: boolean,
    responseType: 'blob', 
    withCredentials?: boolean,
  }): Observable<Blob>;

  post(resource: ODataResource<any>, body: any | null, options: {
    config?: string,
    headers?: HttpHeaders | { [header: string]: string | string[] },
    observe?: 'body',
    params?: HttpParams | { [param: string]: string | string[] },
    reportProgress?: boolean,
    responseType: 'text', 
    withCredentials?: boolean,
  }): Observable<string>;

  post(resource: ODataResource<any>, body: any | null, options: {
    config?: string,
    headers?: HttpHeaders | { [header: string]: string | string[] },
    observe: 'events',
    params?: HttpParams | { [param: string]: string | string[] },
    reportProgress?: boolean,
    responseType: 'arraybuffer', 
    withCredentials?: boolean,
  }): Observable<HttpEvent<ArrayBuffer>>;

  post(resource: ODataResource<any>, body: any | null, options: {
    config?: string,
    headers?: HttpHeaders | { [header: string]: string | string[] },
    observe: 'events',
    params?: HttpParams | { [param: string]: string | string[] },
    reportProgress?: boolean,
    responseType: 'blob', 
    withCredentials?: boolean,
  }): Observable<HttpEvent<Blob>>;

  post(resource: ODataResource<any>, body: any | null, options: {
    config?: string,
    headers?: HttpHeaders | { [header: string]: string | string[] },
    observe: 'events',
    params?: HttpParams | { [param: string]: string | string[] },
    reportProgress?: boolean,
    responseType: 'text', 
    withCredentials?: boolean,
  }): Observable<HttpEvent<string>>;

  post(resource: ODataResource<any>, body: any | null, options: {
    config?: string,
    headers?: HttpHeaders | { [header: string]: string | string[] },
    observe: 'events',
    params?: HttpParams | { [param: string]: string | string[] },
    reportProgress?: boolean,
    responseType?: 'json',
    withCredentials?: boolean,
  }): Observable<HttpEvent<Object>>;

  post<T>(resource: ODataResource<any>, body: any | null, options: {
    config?: string,
    headers?: HttpHeaders | { [header: string]: string | string[] },
    observe: 'events',
    params?: HttpParams | { [param: string]: string | string[] },
    reportProgress?: boolean,
    responseType?: 'json',
    withCredentials?: boolean,
  }): Observable<HttpEvent<T>>;

  post(resource: ODataResource<any>, body: any | null, options: {
    config?: string,
    headers?: HttpHeaders | { [header: string]: string | string[] },
    observe: 'response',
    params?: HttpParams | { [param: string]: string | string[] },
    reportProgress?: boolean,
    responseType: 'arraybuffer', 
    withCredentials?: boolean,
  }): Observable<HttpResponse<ArrayBuffer>>;

  post(resource: ODataResource<any>, body: any | null, options: {
    config?: string,
    headers?: HttpHeaders | { [header: string]: string | string[] },
    observe: 'response',
    params?: HttpParams | { [param: string]: string | string[] },
    reportProgress?: boolean,
    responseType: 'blob', 
    withCredentials?: boolean,
  }): Observable<HttpResponse<Blob>>;

  post(resource: ODataResource<any>, body: any | null, options: {
    config?: string,
    headers?: HttpHeaders | { [header: string]: string | string[] },
    observe: 'response',
    params?: HttpParams | { [param: string]: string | string[] },
    reportProgress?: boolean,
    responseType: 'text', 
    withCredentials?: boolean,
  }): Observable<HttpResponse<string>>;

  post(resource: ODataResource<any>, body: any | null, options: {
    config?: string,
    headers?: HttpHeaders | { [header: string]: string | string[] },
    observe: 'response',
    params?: HttpParams | { [param: string]: string | string[] },
    reportProgress?: boolean,
    responseType?: 'json',
    withCredentials?: boolean,
  }): Observable<HttpResponse<Object>>;

  post<T>(resource: ODataResource<any>, body: any | null, options: {
    config?: string,
    headers?: HttpHeaders | { [header: string]: string | string[] },
    observe: 'response',
    params?: HttpParams | { [param: string]: string | string[] },
    reportProgress?: boolean,
    responseType?: 'json',
    withCredentials?: boolean,
  }): Observable<HttpResponse<T>>;

  post(resource: ODataResource<any>, body: any | null, options?: {
    config?: string,
    headers?: HttpHeaders | { [header: string]: string | string[] },
    observe?: 'body',
    params?: HttpParams | { [param: string]: string | string[] },
    reportProgress?: boolean,
    responseType?: 'json',
    withCredentials?: boolean,
  }): Observable<Object>;

  post<T>(resource: ODataResource<any>, body: any | null, options?: {
    config?: string,
    headers?: HttpHeaders | { [header: string]: string | string[] },
    observe?: 'body',
    params?: HttpParams | { [param: string]: string | string[] },
    reportProgress?: boolean,
    responseType?: 'json',
    withCredentials?: boolean,
  }): Observable<T>;

  post(resource: ODataResource<any>, body: any | null, options: {
    config?: string,
    headers?: HttpHeaders | { [header: string]: string | string[] },
    observe?: 'body' | 'events' | 'response',
    params?: HttpParams | { [param: string]: string | string[] },
    reportProgress?: boolean,
    responseType?: 'arraybuffer' | 'blob' | 'json' | 'text',
    withCredentials?: boolean,
  } = {}): Observable<any> {
    return this.request<any>('POST', resource, Object.assign(options, {body}));
  }

  put(resource: ODataResource<any>, body: any | null, options?: {
    etag?: string,
    config?: string,
    headers?: HttpHeaders | { [header: string]: string | string[] },
    observe?: 'body',
    params?: HttpParams | { [param: string]: string | string[] },
    reportProgress?: boolean,
    responseType: 'arraybuffer', 
    withCredentials?: boolean,
  }): Observable<ArrayBuffer>;

  put(resource: ODataResource<any>, body: any | null, options?: {
    etag?: string,
    config?: string,
    headers?: HttpHeaders | { [header: string]: string | string[] },
    observe?: 'body',
    params?: HttpParams | { [param: string]: string | string[] },
    reportProgress?: boolean,
    responseType: 'blob', 
    withCredentials?: boolean,
  }): Observable<Blob>;

  put(resource: ODataResource<any>, body: any | null, options?: {
    etag?: string,
    config?: string,
    headers?: HttpHeaders | { [header: string]: string | string[] },
    observe?: 'body',
    params?: HttpParams | { [param: string]: string | string[] },
    reportProgress?: boolean,
    responseType: 'text', 
    withCredentials?: boolean,
  }): Observable<string>;

  put(resource: ODataResource<any>, body: any | null, options?: {
    etag?: string,
    config?: string,
    headers?: HttpHeaders | { [header: string]: string | string[] },
    observe: 'events',
    params?: HttpParams | { [param: string]: string | string[] },
    reportProgress?: boolean,
    responseType: 'arraybuffer', 
    withCredentials?: boolean,
  }): Observable<HttpEvent<ArrayBuffer>>;

  put(resource: ODataResource<any>, body: any | null, options?: {
    etag?: string,
    config?: string,
    headers?: HttpHeaders | { [header: string]: string | string[] },
    observe: 'events',
    params?: HttpParams | { [param: string]: string | string[] },
    reportProgress?: boolean,
    responseType: 'blob', 
    withCredentials?: boolean,
  }): Observable<HttpEvent<Blob>>;

  put(resource: ODataResource<any>, body: any | null, options?: {
    etag?: string,
    config?: string,
    headers?: HttpHeaders | { [header: string]: string | string[] },
    observe: 'events',
    params?: HttpParams | { [param: string]: string | string[] },
    reportProgress?: boolean,
    responseType: 'text', 
    withCredentials?: boolean,
  }): Observable<HttpEvent<string>>;

  put(resource: ODataResource<any>, body: any | null, options?: {
    etag?: string,
    config?: string,
    headers?: HttpHeaders | { [header: string]: string | string[] },
    observe: 'events',
    params?: HttpParams | { [param: string]: string | string[] },
    reportProgress?: boolean,
    responseType?: 'json',
    withCredentials?: boolean,
  }): Observable<HttpEvent<Object>>;

  put<T>(resource: ODataResource<any>, body: any | null, options?: {
    etag?: string,
    config?: string,
    headers?: HttpHeaders | { [header: string]: string | string[] },
    observe: 'events',
    params?: HttpParams | { [param: string]: string | string[] },
    reportProgress?: boolean,
    responseType?: 'json',
    withCredentials?: boolean,
  }): Observable<HttpEvent<T>>;

  put(resource: ODataResource<any>, body: any | null, options?: {
    etag?: string,
    config?: string,
    headers?: HttpHeaders | { [header: string]: string | string[] },
    observe: 'response',
    params?: HttpParams | { [param: string]: string | string[] },
    reportProgress?: boolean,
    responseType: 'arraybuffer', withCredentials?: boolean,
  }): Observable<HttpResponse<ArrayBuffer>>;

  put(resource: ODataResource<any>, body: any | null, options?: {
    etag?: string,
    config?: string,
    headers?: HttpHeaders | { [header: string]: string | string[] },
    observe: 'response',
    params?: HttpParams | { [param: string]: string | string[] },
    reportProgress?: boolean,
    responseType: 'blob', withCredentials?: boolean,
  }): Observable<HttpResponse<Blob>>;

  put(resource: ODataResource<any>, body: any | null, options?: {
    etag?: string,
    config?: string,
    headers?: HttpHeaders | { [header: string]: string | string[] },
    observe: 'response',
    params?: HttpParams | { [param: string]: string | string[] },
    reportProgress?: boolean,
    responseType: 'text', withCredentials?: boolean,
  }): Observable<HttpResponse<string>>;

  put(resource: ODataResource<any>, body: any | null, options?: {
    etag?: string,
    config?: string,
    headers?: HttpHeaders | { [header: string]: string | string[] },
    observe: 'response',
    params?: HttpParams | { [param: string]: string | string[] },
    reportProgress?: boolean,
    responseType?: 'json',
    withCredentials?: boolean,
  }): Observable<HttpResponse<Object>>;

  put<T>(resource: ODataResource<any>, body: any | null, options?: {
    etag?: string,
    config?: string,
    headers?: HttpHeaders | { [header: string]: string | string[] },
    observe: 'response',
    params?: HttpParams | { [param: string]: string | string[] },
    reportProgress?: boolean,
    responseType?: 'json',
    withCredentials?: boolean,
  }): Observable<HttpResponse<T>>;

  put(resource: ODataResource<any>, body: any | null, options?: {
    etag?: string,
    config?: string,
    headers?: HttpHeaders | { [header: string]: string | string[] },
    observe?: 'body',
    params?: HttpParams | { [param: string]: string | string[] },
    reportProgress?: boolean,
    responseType?: 'json',
    withCredentials?: boolean,
  }): Observable<Object>;

  put<T>(resource: ODataResource<any>, body: any | null, options?: {
    etag?: string,
    config?: string,
    headers?: HttpHeaders | { [header: string]: string | string[] },
    observe?: 'body',
    params?: HttpParams | { [param: string]: string | string[] },
    reportProgress?: boolean,
    responseType?: 'json',
    withCredentials?: boolean,
  }): Observable<T>;

  put(resource: ODataResource<any>, body: any | null, options: {
    etag?: string,
    config?: string,
    headers?: HttpHeaders | { [header: string]: string | string[] },
    observe?: 'body' | 'events' | 'response',
    params?: HttpParams | { [param: string]: string | string[] },
    reportProgress?: boolean,
    responseType?: 'arraybuffer' | 'blob' | 'json' | 'text',
    withCredentials?: boolean,
  } = {}): Observable<any> {
    return this.request<any>('PUT', resource, Object.assign(options, {body}));
  }
}