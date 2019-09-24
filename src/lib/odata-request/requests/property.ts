import { HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

import { ODataValueRequest } from './value';

import { ODataRequest } from '../request';
import { Segments } from '../types';
import { ODataOptions } from '../options';
import { ODataSegments } from '../segments';
import { ODataService } from '../../odata-service';

export class ODataPropertyRequest<P> extends ODataRequest {

  static factory<T>(name: string, service: ODataService, segments?: ODataSegments, options?: ODataOptions) {
    segments = segments || new ODataSegments();
    options = options || new ODataOptions();

    segments.segment(Segments.property, name);
    return new ODataPropertyRequest<T>(service, segments, options);
  }

  value() {
    return ODataValueRequest.factory<P>(this.service, this.segments.clone());
  }

  get(options?: {
    headers?: HttpHeaders | {[header: string]: string | string[]},
    params?: HttpParams|{[param: string]: string | string[]},
    reportProgress?: boolean,
    withCredentials?: boolean,
  }): Observable<P> {
    return super.get({
      headers: options && options.headers,
      observe: 'body',
      params: options && options.params,
      responseType: 'property',
      reportProgress: options && options.reportProgress,
      withCredentials: options && options.withCredentials
    });
  }
}