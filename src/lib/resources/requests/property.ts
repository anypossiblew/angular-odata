import { Observable } from 'rxjs';

import { ODataValueResource } from './value';

import { ODataResource } from '../resource';
import { ODataQueryOptions } from '../query-options';
import { ODataPathSegments, SegmentTypes } from '../path-segments';
import { ODataClient } from '../../client';
import { map } from 'rxjs/operators';
import { ODataValueAnnotations, ODataEntitiesAnnotations, ODataAnnotations } from '../responses';
import { $COUNT, Parser } from '../../types';
import { HttpValueOptions, HttpEntitiesOptions } from '../http-options';

export class ODataPropertyResource<T> extends ODataResource<T> {

  // Factory
  static factory<P>(name: string, client: ODataClient, opts?: {
      segments?: ODataPathSegments, 
      options?: ODataQueryOptions,
      parser?: Parser<P>}
  ) {
    let segments = opts && opts.segments || new ODataPathSegments();
    let options = opts && opts.options || new ODataQueryOptions();
    let parser = opts && opts.parser || null;

    segments.segment(SegmentTypes.property, name);
    options.clear();
    return new ODataPropertyResource<P>(client, segments, options, parser);
  }

  // Segments
  value() {
    return ODataValueResource.factory<T>(
      this.client, {
      segments: this.pathSegments.clone(),
      options: this.queryOptions.clone(),
      parser: this.parser
    });
  }

  property<P>(name: string) {
    return ODataPropertyResource.factory<P>(
      name,
      this.client, {
      segments: this.pathSegments.clone(),
      options: this.queryOptions.clone(),
      parser: this.parser ? this.parser.parserFor<P>(name) : null
    });
  }

  get(options?: HttpValueOptions): Observable<[T, ODataValueAnnotations]>;

  get(options?: HttpEntitiesOptions): Observable<[T[], ODataEntitiesAnnotations]>;

  get(options?: HttpValueOptions & HttpEntitiesOptions): Observable<any> {

    let params = options && options.params;
    if (options && options.withCount)
      params = this.client.mergeHttpParams(params, {[$COUNT]: 'true'})

    let res$ = this.client.get<T>(this, {
      headers: options && options.headers,
      observe: 'body',
      params: params,
      responseType: 'json',
      reportProgress: options && options.reportProgress,
      withCredentials: options && options.withCredentials
    });
    if (options && options.responseType) {
      switch (options.responseType) {
        case 'value':
          return res$.pipe(map((body: any) => this.toValue(body)));
        case 'entities':
          return res$.pipe(map((body: any) => this.toEntities(body)));
      }
    }
    return res$;
  }
}
